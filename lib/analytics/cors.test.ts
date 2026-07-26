import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

function mockClient() {
  return { rpc, from };
}

vi.mock("@/lib/supabase/service", () => ({
  tryCreateServiceClient: () => mockClient(),
}));

vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => mockClient(),
}));

import { OPTIONS, POST } from "@/app/api/analytics/collect/route";
import {
  ANALYTICS_CORS_HEADERS,
  ANALYTICS_CORS_METHODS,
  analyticsCorsHeaderRecord,
  evaluateAnalyticsOriginSync,
  isAtlasVercelPreviewOrigin,
  parseRequestOrigin,
  resolveAnalyticsCorsOrigin,
} from "@/lib/analytics/cors";

describe("analytics CORS origin allowlist", () => {
  it("allows valid Atlas Vercel preview origins", () => {
    const origin = "https://atlas-sites-abc123.vercel.app";
    expect(isAtlasVercelPreviewOrigin(origin)).toBe(true);
    expect(evaluateAnalyticsOriginSync(origin)).toEqual({
      allowed: true,
      origin,
      reason: "vercel_preview",
    });
  });

  it("allows valid custom domains after verification lookup", async () => {
    const origin = "https://www.northforge.example";
    const decision = await resolveAnalyticsCorsOrigin(origin, {
      projectId: "11111111-1111-4111-8111-111111111111",
      domainClient: {
        findVerifiedHostname: vi.fn().mockResolvedValue(true),
      },
    });
    expect(decision).toEqual({
      allowed: true,
      origin,
      reason: "custom_domain",
    });
  });

  it("blocks unrelated origins", async () => {
    expect(evaluateAnalyticsOriginSync("https://evil.example")).toEqual({
      allowed: false,
      reason: "blocked",
    });
    expect(isAtlasVercelPreviewOrigin("http://atlas-sites.vercel.app")).toBe(
      false,
    );

    const decision = await resolveAnalyticsCorsOrigin(
      "https://phishing.example",
      {
        projectId: "11111111-1111-4111-8111-111111111111",
        domainClient: {
          findVerifiedHostname: vi.fn().mockResolvedValue(false),
        },
      },
    );
    expect(decision.allowed).toBe(false);
  });

  it("builds CORS header record without wildcard", () => {
    const headers = analyticsCorsHeaderRecord(
      "https://atlas-sites-abc.vercel.app",
    );
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://atlas-sites-abc.vercel.app",
    );
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
    expect(headers["Access-Control-Allow-Methods"]).toBe(ANALYTICS_CORS_METHODS);
    expect(headers["Access-Control-Allow-Headers"]).toBe(ANALYTICS_CORS_HEADERS);
    expect(headers.Vary).toBe("Origin");
  });
});

describe("collect route CORS integration", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "project_owner_id") {
        return {
          data: "44444444-4444-4444-8444-444444444444",
          error: null,
        };
      }
      return {
        data: {
          ok: true,
          visit_id: "33333333-3333-4333-8333-333333333333",
          created_visit: true,
          created_page_view: true,
        },
        error: null,
      };
    });

    // Domain lookup chain — default: no verified custom domain.
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const statusIn = vi.fn(() => ({ limit, eq: vi.fn(() => ({ limit, maybeSingle })), maybeSingle }));
    const eqHostname = vi.fn(() => ({
      in: statusIn,
      eq: vi.fn(() => ({ in: statusIn, limit, maybeSingle })),
      limit,
      maybeSingle,
    }));
    from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: eqHostname,
      })),
    }));
  });

  it("OPTIONS preflight returns CORS headers for preview origin", async () => {
    const origin = "https://atlas-sites-preview123.vercel.app";
    const response = await OPTIONS(
      new Request("https://atlas.example.com/api/analytics/collect", {
        method: "OPTIONS",
        headers: { Origin: origin },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
  });

  it("OPTIONS rejects unrelated origins without Allow-Origin", async () => {
    const response = await OPTIONS(
      new Request("https://atlas.example.com/api/analytics/collect", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("POST success includes CORS headers for preview origin", async () => {
    const origin = "https://atlas-sites-preview123.vercel.app";
    const projectId = "11111111-1111-4111-8111-111111111111";

    const response = await POST(
      new Request("https://atlas.example.com/api/analytics/collect", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "pageview",
          projectId,
          sessionId: "sessiontoken99",
          visitorId: "22222222-2222-4222-8222-222222222222",
          pagePath: "/",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
    const json = (await response.json()) as { ok?: boolean };
    expect(json.ok).toBe(true);
  });

  it("POST error responses still include CORS headers for allowed origins", async () => {
    const origin = "https://atlas-sites-preview123.vercel.app";
    const response = await POST(
      new Request("https://atlas.example.com/api/analytics/collect", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: "{not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
});

describe("parseRequestOrigin", () => {
  it("normalizes valid origins and rejects junk", () => {
    expect(parseRequestOrigin("https://shop.example.com")).toBe(
      "https://shop.example.com",
    );
    expect(parseRequestOrigin("javascript:alert(1)")).toBeNull();
    expect(parseRequestOrigin(null)).toBeNull();
  });
});
