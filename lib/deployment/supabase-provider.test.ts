import { describe, expect, it, vi } from "vitest";
import {
  getDeploymentProviderId,
  createDeploymentProvider,
} from "@/lib/deployment/create-provider";
import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";
import { SupabasePreviewDeploymentProvider } from "@/lib/deployment/supabase-provider";
import type { PreviewStorageGateway } from "@/lib/deployment/preview-paths";
import {
  buildPreviewObjectPath,
  collectPreviewUploads,
} from "@/lib/deployment/preview-paths";
import {
  isTransientDeploymentError,
  withRetry,
} from "@/lib/deployment/retry";
import type { PublishArtifact } from "@/lib/publishing/types";

function makeArtifact(fingerprint = "fp-real"): PublishArtifact {
  return {
    version: 1,
    slug: "olive-branch",
    templateId: "modern",
    fingerprint,
    files: [
      {
        path: "index.html",
        content: "<!DOCTYPE html><html><body>Hi</body></html>\n",
        contentType: "text/html; charset=utf-8",
      },
      {
        path: "styles.css",
        content: "body{margin:0}\n",
        contentType: "text/css; charset=utf-8",
      },
    ],
    assets: [
      {
        path: "assets/hero.png",
        role: "hero",
        contentType: "image/png",
        alt: "Hero",
        source: {
          type: "storage",
          storagePath: "user/project/hero.png",
          mimeType: "image/png",
        },
      },
    ],
  };
}

function createGateway(
  overrides: Partial<PreviewStorageGateway> = {},
): PreviewStorageGateway & {
  uploads: Array<{ path: string; contentType: string }>;
  probes: string[];
} {
  const uploads: Array<{ path: string; contentType: string }> = [];
  const probes: string[] = [];
  let probeCount = 0;

  return {
    uploads,
    probes,
    async getUserId() {
      return "user-123";
    },
    async uploadPreviewObject(path, _body, contentType) {
      uploads.push({ path, contentType });
    },
    async downloadProjectMedia() {
      return new Blob(["img"], { type: "image/png" });
    },
    async fetchExternal() {
      return new Blob(["ext"], { type: "image/jpeg" });
    },
    getPublicUrl(path) {
      return `https://example.supabase.co/storage/v1/object/public/site-previews/${path}`;
    },
    async probePublicUrl(url) {
      probes.push(url);
      probeCount += 1;
      return probeCount >= 2;
    },
    ...overrides,
  };
}

describe("deployment provider selection (client-safe)", () => {
  it("parses supabase overrides but only constructs mock on the client", () => {
    expect(getDeploymentProviderId("supabase")).toBe("supabase");
    expect(getDeploymentProviderId("supabase-preview")).toBe("supabase");
    // Real Supabase / Vercel providers are created server-side only.
    expect(createDeploymentProvider("supabase")).toBeInstanceOf(
      MockDeploymentProvider,
    );
    expect(new SupabasePreviewDeploymentProvider()).toBeInstanceOf(
      SupabasePreviewDeploymentProvider,
    );
  });

  it("defaults to mock when override is empty", () => {
    expect(getDeploymentProviderId("")).toBe("mock");
    expect(createDeploymentProvider("")).toBeInstanceOf(MockDeploymentProvider);
  });
});

describe("retry helpers", () => {
  it("detects transient errors", () => {
    expect(isTransientDeploymentError(new Error("Failed to fetch"))).toBe(
      true,
    );
    expect(
      isTransientDeploymentError(
        Object.assign(new Error("boom"), { status: 503 }),
      ),
    ).toBe(true);
    expect(isTransientDeploymentError(new Error("invalid artifact"))).toBe(
      false,
    );
  });

  it("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);
    const value = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error("temporar"), { status: 503 });
        }
        return "ok";
      },
      { retries: 3, baseDelayMs: 10, sleep },
    );

    expect(value).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalled();
  });
});

describe("SupabasePreviewDeploymentProvider", () => {
  it("uploads files, polls until ready, and returns a public preview URL", async () => {
    const gateway = createGateway();
    const provider = new SupabasePreviewDeploymentProvider({
      gateway,
      pollIntervalMs: 0,
      pollTimeoutMs: 5_000,
      uploadRetries: 1,
      sleep: async () => undefined,
      now: () => new Date("2026-07-24T18:00:00.000Z"),
    });

    const statuses: string[] = [];
    const result = await provider.deploy(
      { slug: "olive-branch", artifact: makeArtifact("fp42") },
      (event) => {
        statuses.push(event.status);
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.deployment.provider).toBe("supabase-preview");
    expect(result.deployment.status).toBe("ready");
    expect(result.deployment.previewUrl).toBe(
      gateway.getPublicUrl(
        buildPreviewObjectPath("user-123", "olive-branch", "index.html"),
      ),
    );
    expect(result.deployment.previewUrl).toContain(
      "/storage/v1/object/public/site-previews/",
    );
    expect(result.deployment.previewUrl).not.toContain("preview.atlas.site");
    expect(result.deployment.readyAt).toBe("2026-07-24T18:00:00.000Z");
    expect(statuses).toContain("queued");
    expect(statuses).toContain("uploading");
    expect(statuses).toContain("deploying");
    expect(statuses).toContain("ready");

    const paths = gateway.uploads.map((item) => item.path);
    expect(paths).toContain(
      buildPreviewObjectPath("user-123", "olive-branch", "index.html"),
    );
    expect(paths).toContain(
      buildPreviewObjectPath("user-123", "olive-branch", "assets/hero.png"),
    );
    expect(gateway.probes.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves fingerprint deduplication for Storage URLs", async () => {
    const gateway = createGateway();
    const provider = new SupabasePreviewDeploymentProvider({
      gateway,
      pollIntervalMs: 0,
      sleep: async () => undefined,
    });

    const first = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("same"),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const uploadsAfterFirst = gateway.uploads.length;
    const second = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("same"),
      previousDeployment: {
        id: first.deployment.id,
        previewUrl: first.deployment.previewUrl,
        artifactFingerprint: "same",
        createdAt: first.deployment.createdAt,
        updatedAt: first.deployment.updatedAt,
        readyAt: first.deployment.readyAt,
      },
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.deployment.reused).toBe(true);
    expect(gateway.uploads.length).toBe(uploadsAfterFirst);
  });

  it("does not reuse a mock preview.atlas.site URL (redeploys to Storage)", async () => {
    const gateway = createGateway();
    const provider = new SupabasePreviewDeploymentProvider({
      gateway,
      pollIntervalMs: 0,
      sleep: async () => undefined,
    });

    const result = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("same"),
      previousDeployment: {
        id: "dep_olive-branch_same",
        previewUrl: "https://olive-branch.preview.atlas.site",
        artifactFingerprint: "same",
        createdAt: "2026-07-24T12:00:00.000Z",
        updatedAt: "2026-07-24T12:00:00.000Z",
        readyAt: "2026-07-24T12:00:00.000Z",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deployment.reused).toBe(false);
    expect(result.deployment.previewUrl).toContain(
      "/storage/v1/object/public/site-previews/",
    );
    expect(result.deployment.previewUrl).not.toContain("preview.atlas.site");
    expect(gateway.uploads.length).toBeGreaterThan(0);
  });

  it("fails after poll timeout", async () => {
    const gateway = createGateway({
      async probePublicUrl() {
        return false;
      },
    });
    const provider = new SupabasePreviewDeploymentProvider({
      gateway,
      pollIntervalMs: 0,
      pollTimeoutMs: 0,
      sleep: async () => undefined,
    });

    const result = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("deploy_failed");
    expect(result.error.retryable).toBe(true);
    expect(result.deployment?.status).toBe("failed");
  });

  it("retries transient upload failures", async () => {
    const uploads: Array<{ path: string; contentType: string }> = [];
    let indexAttempts = 0;

    const gateway = createGateway({
      async uploadPreviewObject(path, _body, contentType) {
        if (path.endsWith("index.html")) {
          indexAttempts += 1;
          if (indexAttempts === 1) {
            throw Object.assign(new Error("network timeout"), { status: 503 });
          }
        }
        uploads.push({ path, contentType });
      },
    });

    const provider = new SupabasePreviewDeploymentProvider({
      gateway,
      pollIntervalMs: 0,
      uploadRetries: 2,
      sleep: async () => undefined,
    });

    const result = await provider.deploy({
      slug: "olive-branch",
      artifact: makeArtifact("retry-me"),
    });

    expect(result.ok).toBe(true);
    expect(indexAttempts).toBe(2);
    expect(uploads.some((item) => item.path.endsWith("index.html"))).toBe(
      true,
    );
  });
});

describe("collectPreviewUploads", () => {
  it("merges files and storage assets without duplicating inline paths", async () => {
    const gateway = createGateway();
    const uploads = await collectPreviewUploads(makeArtifact(), gateway);
    const paths = uploads.map((item) => item.relativePath);
    expect(paths).toContain("index.html");
    expect(paths).toContain("assets/hero.png");
  });
});
