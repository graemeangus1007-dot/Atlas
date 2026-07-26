import { describe, expect, it } from "vitest";
import {
  canReusePreviousPreviewUrl,
  isMockPreviewUrl,
  isSupabaseStoragePreviewUrl,
  isVercelPreviewUrl,
} from "@/lib/deployment/preview-url";

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
