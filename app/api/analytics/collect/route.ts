import { NextResponse } from "next/server";
import {
  ANALYTICS_COLLECT_MAX_BODY_BYTES,
  ANALYTICS_COLLECT_RATE_LIMIT,
  ANALYTICS_COLLECT_RATE_WINDOW_MS,
  recordAnalyticsEvent,
  resolveProjectOwnerId,
  validateAnalyticsCollect,
  type AnalyticsCollectPayload,
} from "@/lib/analytics";
import {
  applyAnalyticsCorsHeaders,
  createSupabaseAnalyticsDomainClient,
  resolveAnalyticsCorsOrigin,
} from "@/lib/analytics/cors";
import { logAnalytics } from "@/lib/analytics/log";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { extractClientIp, hashIp } from "@/lib/leads/ip";
import { createAnonClient } from "@/lib/supabase/anon";
import { tryCreateServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function jsonWithCors(
  body: unknown,
  status: number,
  allowedOrigin: string | null,
  extraHeaders?: Record<string, string>,
) {
  const response = NextResponse.json(body, { status });
  applyAnalyticsCorsHeaders(response.headers, allowedOrigin);
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

function getDbClient() {
  return tryCreateServiceClient() ?? createAnonClient();
}

/**
 * OPTIONS /api/analytics/collect — CORS preflight for published sites.
 */
export async function OPTIONS(request: Request) {
  const originHeader = request.headers.get("origin");
  const client = getDbClient();
  const decision = await resolveAnalyticsCorsOrigin(originHeader, {
    domainClient: createSupabaseAnalyticsDomainClient(client),
  });

  if (!decision.allowed) {
    logAnalytics("cors_blocked", {
      method: "OPTIONS",
      reason: decision.reason,
    });
    return new NextResponse(null, { status: 403 });
  }

  logAnalytics("cors_preflight_ok", {
    reason: decision.reason,
  });

  const response = new NextResponse(null, { status: 204 });
  applyAnalyticsCorsHeaders(response.headers, decision.origin);
  return response;
}

/**
 * POST /api/analytics/collect
 * Public beacon from published sites. Never stores IP addresses.
 */
export async function POST(request: Request) {
  const originHeader = request.headers.get("origin");
  let allowedOrigin: string | null = null;

  try {
    logAnalytics("api_reached", {
      method: "POST",
      contentLength: Number(request.headers.get("content-length") || "0"),
    });

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > ANALYTICS_COLLECT_MAX_BODY_BYTES) {
      // Origin not project-scoped yet — use sync/preview or custom without project.
      const early = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = early.allowed ? early.origin : null;
      return jsonWithCors({ error: "Payload too large." }, 413, allowedOrigin);
    }

    // Rate-limit in memory using a hashed IP — hash is never persisted.
    const ipHash = hashIp(extractClientIp(request)) || "unknown";
    const rate = checkDomainRateLimit(`analytics:collect:${ipHash}`, {
      limit: ANALYTICS_COLLECT_RATE_LIMIT,
      windowMs: ANALYTICS_COLLECT_RATE_WINDOW_MS,
    });

    let body: AnalyticsCollectPayload;
    try {
      const text = await request.text();
      if (text.length > ANALYTICS_COLLECT_MAX_BODY_BYTES) {
        const early = await resolveAnalyticsCorsOrigin(originHeader, {
          domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
        });
        allowedOrigin = early.allowed ? early.origin : null;
        return jsonWithCors({ error: "Payload too large." }, 413, allowedOrigin);
      }
      body = JSON.parse(text) as AnalyticsCollectPayload;
    } catch {
      const early = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = early.allowed ? early.origin : null;
      logAnalytics("validation_failed", { error: "invalid_json" });
      return jsonWithCors({ error: "Invalid JSON." }, 400, allowedOrigin);
    }

    const validated = validateAnalyticsCollect(body, {
      userAgentHeader: request.headers.get("user-agent"),
    });

    const client = getDbClient();
    const domainClient = createSupabaseAnalyticsDomainClient(client);
    const projectIdForCors = validated.ok ? validated.data.projectId : null;

    const corsDecision = await resolveAnalyticsCorsOrigin(originHeader, {
      projectId: projectIdForCors,
      domainClient,
    });

    if (!corsDecision.allowed) {
      logAnalytics("cors_blocked", {
        method: "POST",
        reason: corsDecision.reason,
        projectId: projectIdForCors,
      });
      return new NextResponse(JSON.stringify({ error: "Origin not allowed." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    allowedOrigin = corsDecision.origin;

    if (!rate.allowed) {
      logAnalytics("rate_limited", { scope: "ip" });
      return jsonWithCors(
        { error: "Too many requests." },
        429,
        allowedOrigin,
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
    }

    if (!validated.ok) {
      logAnalytics("validation_failed", { error: validated.error });
      return jsonWithCors({ error: validated.error }, 400, allowedOrigin);
    }

    logAnalytics("validation_passed", {
      event: validated.data.event,
      projectId: validated.data.projectId,
      pagePath: validated.data.pagePath,
      deviceType: validated.data.deviceType,
      browser: validated.data.browser,
      visitorIdHash: validated.data.visitorIdHash,
      sessionId: validated.data.sessionId,
      corsReason: corsDecision.reason,
    });

    const visitorRate = checkDomainRateLimit(
      `analytics:collect:visitor:${validated.data.visitorIdHash}`,
      {
        limit: ANALYTICS_COLLECT_RATE_LIMIT,
        windowMs: ANALYTICS_COLLECT_RATE_WINDOW_MS,
      },
    );
    if (!visitorRate.allowed) {
      logAnalytics("rate_limited", { scope: "visitor" });
      return jsonWithCors(
        { error: "Too many requests." },
        429,
        allowedOrigin,
        { "Retry-After": String(visitorRate.retryAfterSeconds) },
      );
    }

    const writerKind = tryCreateServiceClient() ? "service" : "anon";

    const ownerId = await resolveProjectOwnerId(
      client,
      validated.data.projectId,
    );
    if (!ownerId) {
      logAnalytics("insert_failed", {
        error: "unknown_project",
        projectId: validated.data.projectId,
        writerKind,
      });
      return jsonWithCors({ error: "Unknown project." }, 404, allowedOrigin);
    }

    const result = await recordAnalyticsEvent(client, {
      ...validated.data,
      ownerId,
    });

    if (!result.ok) {
      return jsonWithCors({ error: result.error }, 500, allowedOrigin);
    }

    logAnalytics("collect_ok", {
      event: validated.data.event,
      projectId: validated.data.projectId,
      writerKind,
    });

    return jsonWithCors({ ok: true }, 200, allowedOrigin);
  } catch (err) {
    logAnalytics("collect_error", {
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    // Best-effort CORS on unexpected errors for allowed preview origins.
    if (!allowedOrigin) {
      const fallback = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = fallback.allowed ? fallback.origin : null;
    }
    return jsonWithCors(
      { error: "Analytics collection failed." },
      500,
      allowedOrigin,
    );
  }
}
