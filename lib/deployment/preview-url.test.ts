import { describe, expect, it } from "vitest";
import {
  canReusePreviousPreviewUrl,
  isMockPreviewUrl,
  isRealHostedPreviewUrl,
  isSupabaseStoragePreviewUrl,
  isUsableVisitPreviewUrl,
  isVercelPreviewUrl,
  resolveVisitPreviewUrl,
  sanitizePublishRecord,
} from "@/lib/deployment/preview-url";
import { VercelDeploymentProvider } from "@/lib/deployment/vercel-provider";
import { toPublishRecord } from "@/types/publishing";
import type { PublishResult } from "@/types/publishing";
import type { BusinessProject } from "@/types/business-project";
import { rowToBusinessProject } from "@/lib/supabase/projects";
import type { ProjectRow } from "@/lib/supabase/types";

describe("preview URL helpers", () => {
  it("detects mock preview.atlas.site URLs", () => {
    expect(isMockPreviewUrl("https://olive-branch.preview.atlas.site")).toBe(
      true,
    );
    expect(isMockPreviewUrl("https://preview.atlas.site")).toBe(true);
    expect(
      isMockPreviewUrl(
        "https://abc.supabase.co/storage/v1/object/public/site-previews/u/s/index.html",
      ),
    ).toBe(false);
  });

  it("detects Supabase site-previews Storage URLs", () => {
    expect(
      isSupabaseStoragePreviewUrl(
        "https://xyz.supabase.co/storage/v1/object/public/site-previews/user/slug/index.html",
      ),
    ).toBe(true);
    expect(
      isSupabaseStoragePreviewUrl("https://olive-branch.preview.atlas.site"),
    ).toBe(false);
  });

  it("detects Vercel *.vercel.app URLs", () => {
    expect(isVercelPreviewUrl("https://olive-branch-abc.vercel.app")).toBe(
      true,
    );
    expect(isVercelPreviewUrl("https://olive-branch.preview.atlas.site")).toBe(
      false,
    );
  });

  it("blocks reusing mock URLs on the supabase-preview provider", () => {
    expect(
      canReusePreviousPreviewUrl(
        "supabase-preview",
        "https://olive-branch.preview.atlas.site",
      ),
    ).toBe(false);
    expect(
      canReusePreviousPreviewUrl(
        "mock-local",
        "https://olive-branch.preview.atlas.site",
      ),
    ).toBe(true);
  });

  it("only reuses Vercel URLs for the vercel provider", () => {
    expect(
      canReusePreviousPreviewUrl(
        "vercel",
        "https://site-abc.vercel.app",
        "vercel",
      ),
    ).toBe(true);
    expect(
      canReusePreviousPreviewUrl(
        "vercel",
        "https://olive-branch.preview.atlas.site",
        "mock-local",
      ),
    ).toBe(false);
  });
});

describe("Visit Preview URL resolution", () => {
  it("uses the persisted Vercel deployment URL", () => {
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing-abc123.vercel.app",
        providerId: "vercel",
      }),
    ).toBe("https://joes-plumbing-abc123.vercel.app");
  });

  it("rejects legacy fake preview.atlas.site URLs even when persisted provider is mock-local", () => {
    // Active provider is Vercel — stale mock-local stamp must not keep the fake URL.
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing.preview.atlas.site",
        providerId: "vercel",
      }),
    ).toBeNull();
    expect(
      isUsableVisitPreviewUrl(
        "https://joes-plumbing.preview.atlas.site",
        "mock-local",
      ),
    ).toBe(true);
    // Unknown/active vercel context: reject mock.
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing.preview.atlas.site",
        providerId: null,
      }),
    ).toBeNull();
  });

  it("prefers latest publish-version preview_url over a fake deployment URL", () => {
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing.preview.atlas.site",
        latestVersionPreviewUrl: "https://joes-plumbing-xyz.vercel.app",
        providerId: "vercel",
      }),
    ).toBe("https://joes-plumbing-xyz.vercel.app");
  });

  it("keeps production custom domain separate from preview URL", () => {
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing-abc.vercel.app",
        publishUrl: "https://joesplumbing.com",
        providerId: "vercel",
        productionHostname: "joesplumbing.com",
      }),
    ).toBe("https://joes-plumbing-abc.vercel.app");

    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joesplumbing.com",
        publishUrl: "https://joesplumbing.com",
        providerId: "vercel",
        productionHostname: "joesplumbing.com",
      }),
    ).toBeNull();
  });

  it("allows mock preview URLs only for mock-local", () => {
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://demo.preview.atlas.site",
        providerId: "mock-local",
      }),
    ).toBe("https://demo.preview.atlas.site");
    expect(isRealHostedPreviewUrl("https://demo.preview.atlas.site")).toBe(
      false,
    );
  });
});

describe("Vercel deployment URL persistence", () => {
  it("persists the provider *.vercel.app URL on the publish record", () => {
    const snapshot = {
      businessName: "Joe's Plumbing",
      publish: null,
    } as unknown as BusinessProject;

    const result: PublishResult = {
      slug: "joes-plumbing",
      url: "https://joes-plumbing-abc.vercel.app",
      publishedAt: "2026-07-27T00:00:00.000Z",
      snapshot,
      artifact: {
        fingerprint: "fp1",
        templateId: "modern",
        files: [{ path: "index.html", content: "<html></html>" }],
      } as PublishResult["artifact"],
      deployment: {
        id: "dep_joes-plumbing_fp1",
        status: "ready",
        slug: "joes-plumbing",
        previewUrl: "https://joes-plumbing-abc.vercel.app",
        artifactFingerprint: "fp1",
        provider: "vercel",
        createdAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
        readyAt: "2026-07-27T00:00:00.000Z",
        error: null,
        reused: false,
      },
    };

    const record = toPublishRecord(result);
    expect(record.deployment?.previewUrl).toBe(
      "https://joes-plumbing-abc.vercel.app",
    );
    expect(record.url).toBe("https://joes-plumbing-abc.vercel.app");
    expect(record.url).not.toContain("preview.atlas.site");
  });

  it("never persists mock URLs under Vercel", () => {
    const snapshot = {
      businessName: "Joe's Plumbing",
      publish: null,
    } as unknown as BusinessProject;

    const result: PublishResult = {
      slug: "joes-plumbing",
      url: "https://joes-plumbing.preview.atlas.site",
      publishedAt: "2026-07-27T00:00:00.000Z",
      snapshot,
      artifact: {
        fingerprint: "fp1",
        templateId: "modern",
        files: [{ path: "index.html", content: "<html></html>" }],
      } as PublishResult["artifact"],
      deployment: {
        id: "dep_bad",
        status: "ready",
        slug: "joes-plumbing",
        previewUrl: "https://joes-plumbing.preview.atlas.site",
        artifactFingerprint: "fp1",
        provider: "vercel",
        createdAt: "2026-07-27T00:00:00.000Z",
        updatedAt: "2026-07-27T00:00:00.000Z",
        readyAt: "2026-07-27T00:00:00.000Z",
        error: null,
        reused: false,
      },
    };

    const record = toPublishRecord(result);
    expect(record.deployment?.previewUrl).toBe("");
    expect(isMockPreviewUrl(record.url)).toBe(false);
  });
});

describe("legacy heal + force redeploy", () => {
  it("sanitizes/heals project publish from latest publish-version URL", () => {
    const healed = sanitizePublishRecord(
      {
        slug: "joes-plumbing",
        url: "https://joes-plumbing.preview.atlas.site",
        publishedAt: "2026-01-01T00:00:00.000Z",
        snapshot: {} as BusinessProject,
        deployment: {
          id: "dep_old",
          status: "ready" as const,
          previewUrl: "https://joes-plumbing.preview.atlas.site",
          artifactFingerprint: "fp-old",
          provider: "mock-local",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          readyAt: "2026-01-01T00:00:00.000Z",
        },
      },
      {
        activeProviderId: "vercel",
        latestVersionPreviewUrl: "https://joes-plumbing-new.vercel.app",
      },
    );

    expect(healed?.deployment?.previewUrl).toBe(
      "https://joes-plumbing-new.vercel.app",
    );
    expect(healed?.deployment?.provider).toBe("vercel");
    expect(isMockPreviewUrl(healed?.url)).toBe(false);
  });

  it("discards fake URLs on project reload when no heal URL exists", () => {
    const row = {
      id: "p1",
      owner_id: "u1",
      name: "Joe's Plumbing",
      business_name: "Joe's Plumbing",
      business_type: "Contractor",
      description: "",
      goals: [],
      content: {
        publish: {
          slug: "joes-plumbing",
          url: "https://joes-plumbing.preview.atlas.site",
          publishedAt: "2026-01-01T00:00:00.000Z",
          snapshot: null,
          deployment: {
            id: "dep_old",
            status: "ready",
            previewUrl: "https://joes-plumbing.preview.atlas.site",
            artifactFingerprint: "fp",
            provider: "mock-local",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            readyAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
      branding: {},
      template: "modern",
      media: [],
      status: "published",
      published_url: "https://joes-plumbing.preview.atlas.site",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } as unknown as ProjectRow;

    const project = rowToBusinessProject(row);
    expect(isMockPreviewUrl(project.publish?.deployment?.previewUrl)).toBe(
      false,
    );
    expect(project.publish?.deployment?.previewUrl).toBe("");
  });

  it("Force Redeploy replaces a legacy mock URL with a new Vercel URL", async () => {
    const api = {
      createDeployment: async () => ({
        id: "dpl_forced",
        url: "joes-plumbing-forced.vercel.app",
        readyState: "READY",
      }),
      getDeployment: async () => ({
        id: "dpl_forced",
        url: "joes-plumbing-forced.vercel.app",
        readyState: "READY",
      }),
      uploadFile: async () => undefined,
    };

    const provider = new VercelDeploymentProvider({
      config: {
        token: "tok",
        projectId: "prj_test",
      },
      api: api as never,
      assetResolver: {
        downloadProjectMedia: async () => new Uint8Array(),
        fetchExternal: async () => new Uint8Array(),
      },
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      sleep: async () => undefined,
      pollIntervalMs: 0,
      pollTimeoutMs: 1000,
    });

    const artifact = {
      version: 1 as const,
      slug: "joes-plumbing",
      templateId: "modern" as const,
      fingerprint: "fp-same",
      files: [
        {
          path: "index.html",
          content: "<html></html>",
          contentType: "text/html",
        },
      ],
      assets: [],
    };

    const result = await provider.deploy({
      slug: "joes-plumbing",
      artifact,
      force: true,
      previousDeployment: {
        id: "dep_old",
        previewUrl: "https://joes-plumbing.preview.atlas.site",
        artifactFingerprint: "fp-same",
        provider: "mock-local",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        readyAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deployment.reused).toBe(false);
    expect(result.deployment.previewUrl).toBe(
      "https://joes-plumbing-forced.vercel.app",
    );
    expect(isMockPreviewUrl(result.deployment.previewUrl)).toBe(false);
  });

  it("stale context merge does not restore the fake URL when a real URL is present", () => {
    const stale = {
      slug: "joes-plumbing",
      url: "https://joes-plumbing.preview.atlas.site",
      publishedAt: "2026-01-01T00:00:00.000Z",
      snapshot: {} as BusinessProject,
      deployment: {
        id: "dep_old",
        status: "ready" as const,
        previewUrl: "https://joes-plumbing.preview.atlas.site",
        artifactFingerprint: "fp",
        provider: "mock-local",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        readyAt: "2026-01-01T00:00:00.000Z",
      },
    };

    const fresh = {
      ...stale,
      url: "https://joes-plumbing-abc.vercel.app",
      deployment: {
        ...stale.deployment!,
        previewUrl: "https://joes-plumbing-abc.vercel.app",
        provider: "vercel",
      },
    };

    // Simulate a bad merge that reintroduces the stale fake URL as a sibling field.
    const merged = {
      ...fresh,
      url: stale.url,
    };

    const resolved = resolveVisitPreviewUrl({
      deploymentPreviewUrl: merged.deployment?.previewUrl,
      publishUrl: merged.url,
      providerId: "vercel",
    });

    expect(resolved).toBe("https://joes-plumbing-abc.vercel.app");
    expect(resolved).not.toContain("preview.atlas.site");
  });
});
