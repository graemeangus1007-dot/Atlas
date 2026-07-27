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
import { apiErrorPayload, getRequestId } from "@/lib/api";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { extractClientIp, hashIp } from "@/lib/leads/ip";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createAnonClient } from "@/lib/supabase/anon";
import { tryCreateServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function jsonWithCors(
  body: unknown,
  status: number,
  allowedOrigin: string | null,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  const response = NextResponse.json(body, { status });
  applyAnalyticsCorsHeaders(response.headers, allowedOrigin);
  response.headers.set("x-request-id", requestId);
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

function collectError(
  code: string,
  message: string,
  status: number,
  allowedOrigin: string | null,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  return jsonWithCors(
    apiErrorPayload(code, message, requestId),
    status,
    allowedOrigin,
    requestId,
    extraHeaders,
  );
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
  const requestId = getRequestId(request);
  let allowedOrigin: string | null = null;

  try {
    logAnalytics("api_reached", {
      method: "POST",
      requestId,
      contentLength: Number(request.headers.get("content-length") || "0"),
    });

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > ANALYTICS_COLLECT_MAX_BODY_BYTES) {
      // Origin not project-scoped yet — use sync/preview or custom without project.
      const early = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = early.allowed ? early.origin : null;
      return collectError(
        "payload_too_large",
        "Payload too large.",
        413,
        allowedOrigin,
        requestId,
      );
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
        return collectError(
          "payload_too_large",
          "Payload too large.",
          413,
          allowedOrigin,
          requestId,
        );
      }
      body = JSON.parse(text) as AnalyticsCollectPayload;
    } catch {
      const early = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = early.allowed ? early.origin : null;
      logAnalytics("validation_failed", { error: "invalid_json", requestId });
      return collectError(
        "invalid_json",
        "Invalid JSON.",
        400,
        allowedOrigin,
        requestId,
      );
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
        requestId,
      });
      return new NextResponse(
        JSON.stringify(
          apiErrorPayload("cors_blocked", "Origin not allowed.", requestId),
        ),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
        },
      );
    }

    allowedOrigin = corsDecision.origin;

    if (!rate.allowed) {
      logAnalytics("rate_limited", { scope: "ip", requestId });
      return collectError(
        "rate_limited",
        "Too many requests.",
        429,
        allowedOrigin,
        requestId,
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
    }

    if (!validated.ok) {
      logAnalytics("validation_failed", {
        error: validated.error,
        requestId,
      });
      return collectError(
        "validation_failed",
        validated.error,
        400,
        allowedOrigin,
        requestId,
      );
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
      requestId,
    });

    const visitorRate = checkDomainRateLimit(
      `analytics:collect:visitor:${validated.data.visitorIdHash}`,
      {
        limit: ANALYTICS_COLLECT_RATE_LIMIT,
        windowMs: ANALYTICS_COLLECT_RATE_WINDOW_MS,
      },
    );
    if (!visitorRate.allowed) {
      logAnalytics("rate_limited", { scope: "visitor", requestId });
      return collectError(
        "rate_limited",
        "Too many requests.",
        429,
        allowedOrigin,
        requestId,
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
        requestId,
      });
      return collectError(
        "unknown_project",
        "Unknown project.",
        404,
        allowedOrigin,
        requestId,
      );
    }

    const result = await recordAnalyticsEvent(client, {
      ...validated.data,
      ownerId,
    });

    if (!result.ok) {
      return collectError(
        "collect_failed",
        result.error,
        500,
        allowedOrigin,
        requestId,
      );
    }

    logAnalytics("collect_ok", {
      event: validated.data.event,
      projectId: validated.data.projectId,
      writerKind,
      requestId,
    });

    return jsonWithCors({ ok: true }, 200, allowedOrigin, requestId);
  } catch (err) {
    logAnalytics("collect_error", {
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      requestId,
    });
    captureException({
      error: err,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "analytics.collect" },
      },
    });
    // Best-effort CORS on unexpected errors for allowed preview origins.
    if (!allowedOrigin) {
      const fallback = await resolveAnalyticsCorsOrigin(originHeader, {
        domainClient: createSupabaseAnalyticsDomainClient(getDbClient()),
      });
      allowedOrigin = fallback.allowed ? fallback.origin : null;
    }
    return collectError(
      "collect_failed",
      "Analytics collection failed.",
      500,
      allowedOrigin,
      requestId,
    );
  }
}
