import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublishableAtlasOrigin,
  getPublicAtlasOrigin,
  isLocalhostOrigin,
  resetAppUrlWarningStateForTests,
  resolvePublicAppUrl,
  validateAppUrlAtStartup,
} from "@/lib/app-url";
import { defaultProjectContact } from "@/lib/contact";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { rewritePublishedFormOrigins } from "@/lib/publishing/rewrite-form-origin";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(): BusinessProject {
  return {
    businessName: "Olive Branch Cafe",
    businessType: "Other",
    description: "Coffee",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact",
    services: [],
    contact: {
      ...defaultProjectContact("Olive Branch Cafe"),
      formId: "form_abc123",
      formEnabled: true,
    },
    templateId: "modern",
    pages: [],
    primaryColor: "#111111",
    secondaryColor: "#222222",
    accentColor: "#3db8a8",
    backgroundColor: "#0b0f14",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    heroOverlay: 40,
    siteWidth: "wide",
    theme: "dark",
    logo: null,
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: [],
    status: "ready",
    publish: null,
  };
}

afterEach(() => {
  resetAppUrlWarningStateForTests();
  vi.restoreAllMocks();
});

describe("resolvePublicAppUrl", () => {
  it("prefers APP_URL over NEXT_PUBLIC_APP_URL", () => {
    const resolved = resolvePublicAppUrl({
      APP_URL: "https://app.atlas.example",
      NEXT_PUBLIC_APP_URL: "https://public.atlas.example",
      NODE_ENV: "production",
    });
    expect(resolved).toEqual({
      origin: "https://app.atlas.example",
      source: "APP_URL",
      isLocalhost: false,
    });
  });

  it("allows localhost only in local development", () => {
    const dev = resolvePublicAppUrl({
      NODE_ENV: "development",
    });
    expect(dev?.origin).toBe("http://localhost:3000");
    expect(dev?.source).toBe("development-localhost");

    const prod = resolvePublicAppUrl({
      NODE_ENV: "production",
    });
    expect(prod).toBeNull();

    const vercel = resolvePublicAppUrl({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_URL: "atlas-git-main.vercel.app",
    });
    expect(vercel?.origin).toBe("https://atlas-git-main.vercel.app");
    expect(vercel?.isLocalhost).toBe(false);
  });

  it("never treats Vercel runtime as localhost fallback", () => {
    const resolved = resolvePublicAppUrl({
      NODE_ENV: "development",
      VERCEL: "1",
    });
    expect(resolved).toBeNull();
    expect(getPublicAtlasOrigin({ NODE_ENV: "development", VERCEL: "1" })).toBe(
      "",
    );
  });

  it("warns when application URL is missing outside local development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    validateAppUrlAtStartup({ NODE_ENV: "production" });
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain("APP_URL");
  });
});

describe("published contact forms — no localhost in deploy artifacts", () => {
  it("localhost only appears via getPublicAtlasOrigin in development", () => {
    expect(
      getPublicAtlasOrigin({ NODE_ENV: "development" }),
    ).toBe("http://localhost:3000");

    // Publishable origin never returns localhost (even in development).
    expect(
      getPublishableAtlasOrigin({
        NODE_ENV: "development",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toBe("");
  });

  it("deployed previews never contain localhost when APP_URL is configured", () => {
    const origin = getPublishableAtlasOrigin({
      NODE_ENV: "production",
      VERCEL: "1",
      APP_URL: "https://atlas.example.com",
    });
    expect(origin).toBe("https://atlas.example.com");
    expect(isLocalhostOrigin(origin)).toBe(false);

    const html = buildStaticSite(sampleProject(), {
      atlasOrigin: origin,
    }).files.find((f) => f.path === "index.html")!.content;

    expect(html).toContain(
      "https://atlas.example.com/api/forms/form_abc123/submit",
    );
    expect(html).not.toContain("localhost");
    expect(html).not.toContain("127.0.0.1");
  });

  it("production sites use the configured application origin", () => {
    const origin = getPublishableAtlasOrigin({
      NODE_ENV: "production",
      APP_URL: "https://app.atlas.example",
    });
    const artifact = buildStaticSite(sampleProject(), { atlasOrigin: origin });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain(
      'var endpoint="https://app.atlas.example/api/forms/form_abc123/submit"',
    );
  });

  it("production without APP_URL does not embed localhost", () => {
    const origin = getPublishableAtlasOrigin({
      NODE_ENV: "production",
      VERCEL: "1",
    });
    expect(origin).toBe("");

    const html = buildStaticSite(sampleProject(), {
      atlasOrigin: origin,
    }).files.find((f) => f.path === "index.html")!.content;

    expect(html).not.toContain("localhost");
    expect(html).not.toContain("/api/forms/");
  });

  it("rewrites localhost form endpoints before deploy", () => {
    const dirty = buildStaticSite(sampleProject(), {
      atlasOrigin: "http://localhost:3000",
    });
    expect(
      dirty.files.find((f) => f.path === "index.html")!.content,
    ).toContain("localhost:3000");

    const clean = rewritePublishedFormOrigins(
      dirty,
      "https://atlas.example.com",
    );
    const html = clean.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain(
      "https://atlas.example.com/api/forms/form_abc123/submit",
    );
    expect(html).not.toContain("localhost");
    expect(clean.fingerprint).not.toBe(dirty.fingerprint);
  });
});
