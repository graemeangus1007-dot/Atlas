import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  attributeTrafficSource,
  buildAnalyticsPages,
  buildAnalyticsSources,
  buildAnalyticsSummary,
  buildDeviceBreakdown,
  buildRecentVisits,
  computeBounced,
  hashVisitorId,
  normalizeSessionId,
  renderAnalyticsScript,
  sanitizeReferrer,
  validateAnalyticsCollect,
} from "@/lib/analytics";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { defaultProjectContact } from "@/lib/contact";
import type { BusinessProject } from "@/types/business-project";
import type { SiteVisitRow } from "@/lib/analytics/types";

function visit(
  overrides: Partial<SiteVisitRow> & Pick<SiteVisitRow, "id" | "visitor_id">,
): SiteVisitRow {
  return {
    project_id: "11111111-1111-4111-8111-111111111111",
    owner_id: "22222222-2222-4222-8222-222222222222",
    session_id: `sess_${overrides.id}`,
    page_path: "/",
    referrer: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    country: "US",
    region: "",
    city: "",
    device_type: "desktop",
    browser: "Chrome",
    operating_system: "Windows",
    screen_size: "1920x1080",
    language: "en-US",
    duration_seconds: 30,
    bounced: false,
    created_at: "2026-07-26T12:00:00.000Z",
    ...overrides,
  };
}

function sampleProject(): BusinessProject {
  return {
    businessName: "Olive Branch Cafe",
    businessType: "Coffee Shop",
    description: "Coffee",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact",
    services: [],
    contact: {
      ...defaultProjectContact("Olive Branch Cafe"),
      formId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
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

describe("session + visitor tracking", () => {
  it("creates hashed visitor ids and validates session tokens", () => {
    const hash = hashVisitorId("11111111-1111-4111-8111-111111111111");
    expect(hash).toBeTruthy();
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("11111111");

    expect(normalizeSessionId("abcd1234ef")).toBe("abcd1234ef");
    expect(normalizeSessionId("bad session")).toBeNull();
    expect(normalizeSessionId("short")).toBeNull();
  });

  it("validates collect payloads and records page paths", () => {
    const result = validateAnalyticsCollect(
      {
        event: "pageview",
        projectId: "11111111-1111-4111-8111-111111111111",
        sessionId: "sessiontoken12",
        visitorId: "11111111-1111-4111-8111-111111111111",
        pagePath: "/about",
        referrer: "https://www.google.com/search?q=cafe",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring",
        language: "en-US",
        screenSize: "1440x900",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      {},
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pagePath).toBe("/about");
    expect(result.data.deviceType).toBe("desktop");
    expect(result.data.browser).toBe("Chrome");
    expect(result.data.referrer).toBe("https://www.google.com/search");
    expect(result.data.referrer).not.toContain("q=cafe");
  });
});

describe("bounce detection", () => {
  it("marks single short sessions as bounced", () => {
    expect(computeBounced({ pageViewCount: 1, durationSeconds: 5 })).toBe(true);
    expect(computeBounced({ pageViewCount: 1, durationSeconds: 20 })).toBe(
      false,
    );
    expect(computeBounced({ pageViewCount: 2, durationSeconds: 5 })).toBe(
      false,
    );
  });
});

describe("traffic attribution", () => {
  it("attributes google / social / direct / referral", () => {
    expect(
      attributeTrafficSource({
        referrer: "",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("direct");
    expect(
      attributeTrafficSource({
        referrer: "https://www.google.com/",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("google");
    expect(
      attributeTrafficSource({
        referrer: "https://www.facebook.com/",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("facebook");
    expect(
      attributeTrafficSource({
        referrer: "https://news.example.com/story",
        utmSource: "",
        utmMedium: "",
      }),
    ).toBe("referral");
    expect(
      attributeTrafficSource({
        referrer: "",
        utmSource: "linkedin",
        utmMedium: "social",
      }),
    ).toBe("linkedin");
  });
});

describe("dashboard queries + lead attribution", () => {
  it("aggregates visitors, pages, sources, and conversions", () => {
    const visits = [
      visit({
        id: "a",
        visitor_id: "v1",
        page_path: "/",
        referrer: "https://www.google.com/",
        created_at: "2026-07-26T10:00:00.000Z",
      }),
      visit({
        id: "b",
        visitor_id: "v1",
        page_path: "/menu",
        referrer: "https://www.google.com/",
        created_at: "2026-07-26T10:05:00.000Z",
      }),
      visit({
        id: "c",
        visitor_id: "v2",
        page_path: "/",
        utm_source: "facebook",
        device_type: "mobile",
        browser: "Safari",
        bounced: true,
        duration_seconds: 4,
        created_at: "2026-07-26T11:00:00.000Z",
      }),
    ];

    const leads = [
      {
        id: "l1",
        created_at: "2026-07-26T10:10:00.000Z",
        landing_page: "/",
        referrer: "https://www.google.com/",
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "spring",
        session_id: "sess_a",
        visitor_id: "v1",
      },
    ];

    const now = new Date("2026-07-26T15:00:00.000Z");
    const summary = buildAnalyticsSummary(visits, leads, now);
    expect(summary.visitorsToday).toBe(2);
    expect(summary.totalLeads).toBe(1);
    expect(summary.bounceRate).toBeGreaterThan(0);

    const pages = buildAnalyticsPages(visits, leads, "visits");
    expect(pages[0]?.pagePath).toBe("/");
    expect(pages.find((p) => p.pagePath === "/")?.conversionRate).toBeGreaterThan(
      0,
    );

    const sources = buildAnalyticsSources(visits, leads);
    expect(sources.find((s) => s.source === "google")?.visits).toBe(2);
    expect(sources.find((s) => s.source === "facebook")?.leads).toBe(0);
    expect(sources.find((s) => s.source === "google")?.leads).toBe(1);

    const devices = buildDeviceBreakdown(visits);
    expect(devices.devices.find((d) => d.device === "desktop")?.count).toBe(2);
    expect(devices.browsers.find((b) => b.browser === "Chrome")?.count).toBe(2);

    const recent = buildRecentVisits(visits, leads, 10);
    expect(recent.some((r) => r.converted)).toBe(true);
    expect(summary.leadsByCampaign[0]?.campaign).toBe("spring");
    expect(summary.topConvertingPages.length).toBeGreaterThan(0);
  });
});

describe("privacy rules", () => {
  it("never stores raw IPs and sanitizes referrer query strings", () => {
    expect(sanitizeReferrer("https://evil.example/path?email=a@b.com")).toBe(
      "https://evil.example/path",
    );
    expect(sanitizeReferrer("javascript:alert(1)")).toBe("");

    const migration = readFileSync(
      resolve(__dirname, "../../supabase/migrations/20260801_analytics.sql"),
      "utf8",
    );
    expect(migration).toContain("site_visits");
    expect(migration).toContain("page_views");
    expect(migration).not.toContain("ip_hash");
    expect(migration).not.toContain("ip_address");
    expect(migration).toContain("Never store raw IP");
    expect(migration).toContain("Public can insert site visits");
    expect(migration).toContain("Owners can select own site visits");
    expect(migration).not.toContain("Public can select site visits");
  });

  it("hashes visitor ids before persistence contracts", () => {
    const collect = readFileSync(
      resolve(__dirname, "../../app/api/analytics/collect/route.ts"),
      "utf8",
    );
    expect(collect).toContain("hashIp");
    expect(collect).toContain("validateAnalyticsCollect");
    expect(collect).toContain("recordAnalyticsEvent");
    // IP hash used for rate limit only — never inserted into analytics tables.
    expect(collect).not.toContain("ip_hash");
    expect(collect).not.toContain("ip_address");
  });
});

describe("API validation + RLS contracts", () => {
  it("owner routes require auth + project ownership", () => {
    for (const name of [
      "summary",
      "pages",
      "sources",
      "devices",
      "recent",
    ]) {
      const source = readFileSync(
        resolve(__dirname, `../../app/api/analytics/${name}/route.ts`),
        "utf8",
      );
      expect(source).toContain("requireAnalyticsOwner");
    }

    const auth = readFileSync(
      resolve(__dirname, "./auth.ts"),
      "utf8",
    );
    expect(auth).toContain('eq("owner_id", user.id)');
    expect(auth).toContain("checkDomainRateLimit");
  });

  it("rejects invalid collect events", () => {
    const bad = validateAnalyticsCollect({
      event: "click",
      projectId: "not-a-uuid",
      sessionId: "x",
      visitorId: "y",
    });
    expect(bad.ok).toBe(false);
  });
});

describe("publish injects analytics script", () => {
  it("embeds collect endpoint for preview/production origins", () => {
    const script = renderAnalyticsScript({
      apiBaseUrl: "https://atlas.example.com",
      projectId: "11111111-1111-4111-8111-111111111111",
    });
    expect(script).toContain("/api/analytics/collect");
    expect(script).toContain("atlas_vid");
    expect(script).toContain("atlas_sid");
    expect(script).toContain("utm_source");

    const artifact = buildStaticSite(sampleProject(), {
      atlasOrigin: "https://atlas.example.com",
      projectId: "11111111-1111-4111-8111-111111111111",
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain("data-atlas-analytics");
    expect(html).toContain(
      "https://atlas.example.com/api/analytics/collect",
    );
    expect(html).not.toContain("localhost");
  });
});
