import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildAnalyticsSummary,
  hashVisitorId,
  recordAnalyticsEvent,
  renderAnalyticsScript,
  validateAnalyticsCollect,
  type AnalyticsDbClient,
} from "@/lib/analytics";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { defaultProjectContact } from "@/lib/contact";
import type { BusinessProject } from "@/types/business-project";
import type { SiteVisitRow } from "@/lib/analytics/types";
import type { Database } from "@/lib/supabase/types";

type RecordEventArgs =
  Database["public"]["Functions"]["atlas_record_analytics_event"]["Args"];
type RecordEventResult =
  Database["public"]["Functions"]["atlas_record_analytics_event"]["Returns"];

function isRecordEventArgs(args: unknown): args is RecordEventArgs {
  return (
    typeof args === "object" &&
    args !== null &&
    "p_event" in args &&
    "p_project_id" in args &&
    "p_session_id" in args &&
    "p_visitor_id" in args &&
    "p_page_path" in args
  );
}

/** RPC-only test double — structurally matches AnalyticsDbClient. */
function mockRpcClient(
  impl: (args: RecordEventArgs) => Promise<RecordEventResult>,
): AnalyticsDbClient {
  return {
    async rpc(fn, args) {
      if (fn === "atlas_record_analytics_event" && isRecordEventArgs(args)) {
        return { data: await impl(args), error: null };
      }
      return {
        data: null,
        error: { message: `unexpected rpc: ${String(fn)}` },
      };
    },
    from() {
      throw new Error("from() should not be called when RPC succeeds");
    },
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

describe("successful visit collection", () => {
  it("records a pageview via RPC and returns visit id", async () => {
    const impl = vi.fn(async (_args: RecordEventArgs) => ({
      ok: true,
      visit_id: "33333333-3333-4333-8333-333333333333",
      created_visit: true,
      created_page_view: true,
    }));

    const validated = validateAnalyticsCollect({
      event: "pageview",
      projectId: "11111111-1111-4111-8111-111111111111",
      sessionId: "sessiontoken99",
      visitorId: "22222222-2222-4222-8222-222222222222",
      pagePath: "/",
      referrer: "https://www.google.com/",
      utmSource: "google",
      userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const result = await recordAnalyticsEvent(mockRpcClient(impl), {
      ...validated.data,
      ownerId: "44444444-4444-4444-8444-444444444444",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.visitId).toBe("33333333-3333-4333-8333-333333333333");
    expect(impl).toHaveBeenCalledWith(
      expect.objectContaining({
        p_event: "pageview",
        p_project_id: "11111111-1111-4111-8111-111111111111",
        p_visitor_id: hashVisitorId("22222222-2222-4222-8222-222222222222"),
      }),
    );
  });

  it("creates an additional page view for an existing session", async () => {
    const impl = vi.fn(async (_args: RecordEventArgs) => ({
      ok: true,
      visit_id: "33333333-3333-4333-8333-333333333333",
      created_visit: false,
      created_page_view: true,
    }));

    const validated = validateAnalyticsCollect({
      event: "pageview",
      projectId: "11111111-1111-4111-8111-111111111111",
      sessionId: "sessiontoken99",
      visitorId: "22222222-2222-4222-8222-222222222222",
      pagePath: "/menu",
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const result = await recordAnalyticsEvent(mockRpcClient(impl), {
      ...validated.data,
      ownerId: "owner",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(impl.mock.calls[0]?.[0]?.p_page_path).toBe("/menu");
  });
});

describe("dashboard summary", () => {
  it("aggregates collected visits for the owner project", () => {
    const visits: SiteVisitRow[] = [
      {
        id: "a",
        project_id: "11111111-1111-4111-8111-111111111111",
        owner_id: "owner",
        session_id: "s1",
        visitor_id: "vh1",
        page_path: "/",
        referrer: "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        country: "",
        region: "",
        city: "",
        device_type: "desktop",
        browser: "Chrome",
        operating_system: "Windows",
        screen_size: "1920x1080",
        language: "en",
        duration_seconds: 20,
        bounced: false,
        created_at: "2026-07-26T12:00:00.000Z",
      },
    ];
    const summary = buildAnalyticsSummary(
      visits,
      [],
      new Date("2026-07-26T15:00:00Z"),
    );
    expect(summary.visitorsToday).toBe(1);
    expect(summary.visitorsThisMonth).toBe(1);
  });
});

describe("RLS behavior contracts", () => {
  it("keeps anon insert + owner select; no public select", () => {
    const m1 = readFileSync(
      resolve(__dirname, "../../supabase/migrations/20260801_analytics.sql"),
      "utf8",
    );
    const m2 = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260802_analytics_collect_rpc.sql",
      ),
      "utf8",
    );
    expect(m1).toContain("Public can insert site visits");
    expect(m1).toContain("Owners can select own site visits");
    expect(m1).not.toContain("Public can select site visits");
    expect(m2).toContain("atlas_record_analytics_event");
    expect(m2).toContain("security definer");
    expect(m2).toContain("to anon, authenticated, service_role");
  });

  it("collect route logs pipeline stages and allows anon writer", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/analytics/collect/route.ts"),
      "utf8",
    );
    expect(source).toContain('logAnalytics("api_reached"');
    expect(source).toContain('logAnalytics("validation_passed"');
    expect(source).toContain("createAnonClient");
    expect(source).toContain("recordAnalyticsEvent");
  });
});

describe("published preview integration", () => {
  it("injects analytics beacon with project id and collect URL", () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const origin = "https://atlas.example.com";
    const script = renderAnalyticsScript({
      apiBaseUrl: origin,
      projectId,
    });
    expect(script).toContain("script_loaded");
    expect(script).toContain("beacon_sent");
    expect(script).toContain(`${origin}/api/analytics/collect`);

    const artifact = buildStaticSite(sampleProject(), {
      atlasOrigin: origin,
      projectId,
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain("data-atlas-analytics");
    expect(html).toContain(projectId);
    expect(html).toContain("/api/analytics/collect");
    expect(html).not.toContain("localhost");
  });

  it("skips injection without project id (prevents empty beacons)", () => {
    const artifact = buildStaticSite(sampleProject(), {
      atlasOrigin: "https://atlas.example.com",
      projectId: null,
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).not.toContain("data-atlas-analytics");
  });
});
