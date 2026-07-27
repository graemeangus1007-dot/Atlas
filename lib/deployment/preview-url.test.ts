import { describe, expect, it } from "vitest";
import {
  canReusePreviousPreviewUrl,
  isMockPreviewUrl,
  isRealHostedPreviewUrl,
  isSupabaseStoragePreviewUrl,
  isUsableVisitPreviewUrl,
  isVercelPreviewUrl,
  resolveVisitPreviewUrl,
} from "@/lib/deployment/preview-url";
import { toPublishRecord } from "@/types/publishing";
import type { PublishResult } from "@/types/publishing";
import type { BusinessProject } from "@/types/business-project";

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
    expect(
      isVercelPreviewUrl(
        "https://xyz.supabase.co/storage/v1/object/public/site-previews/u/s/index.html",
      ),
    ).toBe(false);
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
        "supabase-preview",
        "https://xyz.supabase.co/storage/v1/object/public/site-previews/u/s/index.html",
      ),
    ).toBe(true);
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
    expect(
      canReusePreviousPreviewUrl(
        "vercel",
        "https://xyz.supabase.co/storage/v1/object/public/site-previews/u/s/index.html",
        "supabase-preview",
      ),
    ).toBe(false);
  });

  it("blocks provider mismatches even when URL shape matches", () => {
    expect(
      canReusePreviousPreviewUrl(
        "vercel",
        "https://site-abc.vercel.app",
        "supabase-preview",
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

  it("rejects legacy fake preview.atlas.site URLs for Vercel", () => {
    expect(
      resolveVisitPreviewUrl({
        deploymentPreviewUrl: "https://joes-plumbing.preview.atlas.site",
        providerId: "vercel",
      }),
    ).toBeNull();
    expect(
      isUsableVisitPreviewUrl(
        "https://joes-plumbing.preview.atlas.site",
        "vercel",
      ),
    ).toBe(false);
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

    // Custom domain must never be returned as the Visit Preview target.
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

  it("strips invented preview.atlas.site hosts from non-mock publish records", () => {
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
