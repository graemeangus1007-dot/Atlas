import { describe, expect, it, vi } from "vitest";
import {
  VercelDeploymentProvider,
  uploadPreparedFilesBySha,
} from "@/lib/deployment/vercel-provider";
import type { VercelApiClient } from "@/lib/deployment/vercel-api";
import type { PublishArtifact } from "@/lib/publishing/types";
import {
  measureCreateDeploymentBodyBytes,
  sha1Hex,
  VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES,
  VERCEL_FILE_UPLOAD_LIMIT_BYTES,
  type ArtifactAssetResolver,
  type VercelFileReference,
} from "@/lib/deployment/vercel-files";
import {
  isStaticNoFrameworkDeployment,
  STATIC_SITE_PROJECT_SETTINGS,
  type VercelCreateStaticDeploymentBody,
} from "@/lib/deployment/vercel-static-deployment";

function makeArtifact(fingerprint = "fp-vercel"): PublishArtifact {
  return {
    version: 1,
    slug: "olive-branch",
    templateId: "modern",
    fingerprint,
    files: [
      {
        path: "index.html",
        content: "<!doctype html><html><body>Hi</body></html>",
        contentType: "text/html",
      },
      {
        path: "styles.css",
        content: "body{margin:0}",
        contentType: "text/css",
      },
      {
        path: "atlas-manifest.json",
        content: '{"version":1}',
        contentType: "application/json",
      },
    ],
    assets: [],
  };
}

const noopResolver: ArtifactAssetResolver = {
  downloadProjectMedia: async () => new Uint8Array(),
  fetchExternal: async () => new Uint8Array(),
};

function makeApi(
  overrides: Partial<VercelApiClient> = {},
): VercelApiClient {
  return {
    uploadFile: overrides.uploadFile ?? (async () => undefined),
    createDeployment:
      overrides.createDeployment ??
      (async () => ({
        id: "dpl_default",
        url: "default.vercel.app",
        readyState: "READY",
      })),
    getDeployment:
      overrides.getDeployment ??
      (async () => ({
        id: "dpl_default",
        url: "default.vercel.app",
        readyState: "READY",
      })),
  };
}

function makeProvider(api: VercelApiClient, resolver = noopResolver) {
  return new VercelDeploymentProvider({
    config: {
      token: "test-secret-token-do-not-leak",
      projectId: "prj_test",
    },
    api,
    assetResolver: resolver,
    pollIntervalMs: 0,
    pollTimeoutMs: 5_000,
    sleep: async () => undefined,
    now: () => new Date("2026-07-25T12:00:00.000Z"),
  });
}

describe("VercelDeploymentProvider", () => {
  it("uploads files by SHA then creates a deployment with file/sha/size refs only", async () => {
    const uploaded: Array<{ sha: string; size: number }> = [];
    let capturedFiles: VercelFileReference[] = [];
    let createBodyBytes = 0;
    let capturedBody: VercelCreateStaticDeploymentBody | null = null;

    const api = makeApi({
      uploadFile: async (input) => {
        uploaded.push({ sha: input.sha, size: input.size });
      },
      createDeployment: async (body) => {
        createBodyBytes = measureCreateDeploymentBodyBytes(body);
        capturedFiles = body.files;
        capturedBody = body;
        expect(isStaticNoFrameworkDeployment(body)).toBe(true);
        expect(body.projectSettings).toEqual(STATIC_SITE_PROJECT_SETTINGS);
        expect(body.projectSettings.framework).not.toBe("nextjs");
        for (const file of body.files) {
          expect(file).toEqual(
            expect.objectContaining({
              file: expect.any(String),
              sha: expect.any(String),
              size: expect.any(Number),
            }),
          );
          expect(file).not.toHaveProperty("data");
          expect(file).not.toHaveProperty("encoding");
        }
        return {
          id: "dpl_abc",
          url: "olive-branch-xyz.vercel.app",
          readyState: "QUEUED",
        };
      },
      getDeployment: vi
        .fn()
        .mockResolvedValueOnce({
          id: "dpl_abc",
          url: "olive-branch-xyz.vercel.app",
          readyState: "BUILDING",
        })
        .mockResolvedValueOnce({
          id: "dpl_abc",
          url: "olive-branch-xyz.vercel.app",
          readyState: "READY",
        }),
    });

    const provider = makeProvider(api);
    const statuses: string[] = [];
    const result = await provider.deploy(
      { slug: "olive-branch", artifact: makeArtifact() },
      (e) => statuses.push(e.status),
    );

    expect(result.ok).toBe(true);
    expect(result.deployment?.previewUrl).toBe(
      "https://olive-branch-xyz.vercel.app",
    );
    expect(uploaded.length).toBeGreaterThan(0);
    expect(capturedFiles.some((f) => f.file === "index.html")).toBe(true);
    expect(capturedFiles.some((f) => f.file === "styles.css")).toBe(true);
    expect(capturedFiles.some((f) => f.file === "atlas-manifest.json")).toBe(
      true,
    );
    expect(capturedFiles.some((f) => f.file === "vercel.json")).toBe(true);
    expect(createBodyBytes).toBeLessThan(VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES);
    expect(capturedBody?.projectSettings.buildCommand).toBe("");
    expect(JSON.stringify(capturedBody)).not.toMatch(/"framework"\s*:\s*"nextjs"/);
    expect(statuses).toContain("uploading");
    expect(statuses).toContain("deploying");
    expect(statuses).toContain("ready");
  });

  it("deploys a site larger than 10 MB because create-deployment stays small", async () => {
    const largeBytes = new Uint8Array(11 * 1024 * 1024);
    largeBytes.fill(7);
    const largeSha = sha1Hex(largeBytes);

    const artifact: PublishArtifact = {
      ...makeArtifact("fp-large"),
      assets: [
        {
          path: "assets/hero.jpg",
          role: "hero",
          contentType: "image/jpeg",
          alt: "Hero",
          source: {
            type: "storage",
            storagePath: "user/projects/hero.jpg",
            mimeType: "image/jpeg",
          },
        },
      ],
    };

    const resolver: ArtifactAssetResolver = {
      downloadProjectMedia: async () => largeBytes,
      fetchExternal: async () => new Uint8Array(),
    };

    let createBodyBytes = 0;
    let uploadedLarge = false;
    const api = makeApi({
      uploadFile: async (input) => {
        if (input.sha === largeSha) {
          uploadedLarge = true;
          expect(input.size).toBe(largeBytes.byteLength);
          expect(input.bytes.byteLength).toBeGreaterThan(10 * 1024 * 1024);
        }
      },
      createDeployment: async (body) => {
        createBodyBytes = measureCreateDeploymentBodyBytes(body);
        const hero = body.files.find((f) => f.file === "assets/hero.jpg");
        expect(hero).toEqual({
          file: "assets/hero.jpg",
          sha: largeSha,
          size: largeBytes.byteLength,
        });
        // Prove the final JSON does not embed image bytes / base64.
        const serialized = JSON.stringify(body);
        expect(serialized.includes("data")).toBe(false);
        expect(serialized.length).toBeLessThan(50_000);
        expect(createBodyBytes).toBeLessThan(VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES);
        // Content payload alone exceeds the old inline 10 MB limit.
        expect(largeBytes.byteLength).toBeGreaterThan(
          VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES,
        );
        return {
          id: "dpl_large",
          url: "large-site.vercel.app",
          readyState: "READY",
        };
      },
    });

    const result = await makeProvider(api, resolver).deploy({
      slug: "olive-branch",
      artifact,
    });

    expect(result.ok).toBe(true);
    expect(uploadedLarge).toBe(true);
    expect(createBodyBytes).toBeLessThan(10_000);
    expect(result.deployment?.previewUrl).toBe("https://large-site.vercel.app");
  });

  it("reuses identical SHA uploads within one deployment", async () => {
    const shared = new Uint8Array([1, 2, 3, 4, 5]);
    const sha = sha1Hex(shared);
    const uploads: string[] = [];

    await uploadPreparedFilesBySha(
      makeApi({
        uploadFile: async (input) => {
          uploads.push(input.sha);
        },
      }),
      [
        { file: "assets/a.jpg", bytes: shared, sha, size: shared.byteLength },
        { file: "assets/b.jpg", bytes: shared, sha, size: shared.byteLength },
      ],
    );

    expect(uploads).toEqual([sha]);
  });

  it("rejects a single file over the upload size limit with a clear message", async () => {
    const tooBig = new Uint8Array(VERCEL_FILE_UPLOAD_LIMIT_BYTES + 1);
    const artifact: PublishArtifact = {
      ...makeArtifact("fp-toobig"),
      assets: [
        {
          path: "assets/huge.bin",
          role: "hero",
          contentType: "application/octet-stream",
          alt: "Huge",
          source: {
            type: "storage",
            storagePath: "user/huge.bin",
            mimeType: "application/octet-stream",
          },
        },
      ],
    };

    const result = await makeProvider(
      makeApi(),
      {
        downloadProjectMedia: async () => tooBig,
        fetchExternal: async () => new Uint8Array(),
      },
    ).deploy({ slug: "olive-branch", artifact });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/exceeds the .* MB per-file upload limit/i);
    expect(result.error.message).toContain("assets/huge.bin");
  });

  it("polls until READY", async () => {
    const getDeployment = vi
      .fn()
      .mockResolvedValueOnce({
        id: "dpl_1",
        url: "a.vercel.app",
        readyState: "INITIALIZING",
      })
      .mockResolvedValueOnce({
        id: "dpl_1",
        url: "a.vercel.app",
        readyState: "DEPLOYING",
      })
      .mockResolvedValueOnce({
        id: "dpl_1",
        url: "a.vercel.app",
        readyState: "READY",
      });

    const provider = makeProvider(
      makeApi({
        createDeployment: async () => ({
          id: "dpl_1",
          url: "a.vercel.app",
          readyState: "QUEUED",
        }),
        getDeployment,
      }),
    );

    const result = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("fp-poll"),
    });

    expect(result.ok).toBe(true);
    expect(getDeployment).toHaveBeenCalledTimes(3);
  });

  it("fails when Vercel reports ERROR (without leaking the token)", async () => {
    const token = "test-secret-token-do-not-leak";
    const failing = makeProvider(
      makeApi({
        createDeployment: async () => ({
          id: "dpl_err",
          url: "fail.vercel.app",
          readyState: "BUILDING",
        }),
        getDeployment: async () => ({
          id: "dpl_err",
          readyState: "ERROR",
          readyStateReason: `Auth failed for ${token}`,
        }),
      }),
    );

    const result = await failing.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("fp-fail"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("deploy_failed");
    expect(result.error.message).not.toContain(token);
    expect(result.error.message).toContain("[redacted]");
  });

  it("reuses a prior Vercel deployment with matching fingerprint", async () => {
    const api = makeApi({
      createDeployment: vi.fn(),
      uploadFile: vi.fn(),
    });
    const result = await makeProvider(api).deploy({
      slug: "olive-branch",
      artifact: makeArtifact("fp-reuse"),
      previousDeployment: {
        id: "dep_olive-branch_fp-reuse",
        previewUrl: "https://olive-branch-abc.vercel.app",
        artifactFingerprint: "fp-reuse",
        provider: "vercel",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        readyAt: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.deployment?.reused).toBe(true);
    expect(api.createDeployment).not.toHaveBeenCalled();
    expect(api.uploadFile).not.toHaveBeenCalled();
  });

  it("does not reuse mock or Supabase URLs (provider mismatch)", async () => {
    const createDeployment = vi.fn(async () => ({
      id: "dpl_new",
      url: "fresh.vercel.app",
      readyState: "READY",
    }));
    const provider = makeProvider(makeApi({ createDeployment }));

    const mockPrev = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("fp-mismatch"),
      previousDeployment: {
        id: "dep_old",
        previewUrl: "https://olive-branch.preview.atlas.site",
        artifactFingerprint: "fp-mismatch",
        provider: "mock-local",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        readyAt: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(mockPrev.ok).toBe(true);
    expect(mockPrev.deployment?.reused).toBeFalsy();
    expect(createDeployment).toHaveBeenCalled();
  });

  it("honors force redeploy even when fingerprint matches", async () => {
    const createDeployment = vi.fn(async () => ({
      id: "dpl_force",
      url: "forced.vercel.app",
      readyState: "READY",
    }));
    const result = await makeProvider(makeApi({ createDeployment })).deploy({
      slug: "olive-branch",
      artifact: makeArtifact("fp-force"),
      force: true,
      previousDeployment: {
        id: "dep_olive-branch_fp-force",
        previewUrl: "https://old.vercel.app",
        artifactFingerprint: "fp-force",
        provider: "vercel",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        readyAt: "2026-07-01T00:00:00.000Z",
      },
    });

    expect(result.deployment?.reused).toBeFalsy();
    expect(result.deployment?.previewUrl).toBe("https://forced.vercel.app");
    expect(createDeployment).toHaveBeenCalled();
  });
});
