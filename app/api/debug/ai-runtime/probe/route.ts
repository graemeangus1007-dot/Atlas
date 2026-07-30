/**
 * TEMPORARY Sprint 28.0B diagnostic — remove after production verification.
 * POST /api/debug/ai-runtime/probe
 */

import {
  apiError,
  apiJson,
  getRequestId,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import { runOpenAiRuntimeProbe } from "@/lib/ai/design-critique-provider";
import { getAiProviderId } from "@/lib/ai/provider";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** TEMPORARY: delete this route after OpenAI critique verification passes. */
export const AI_RUNTIME_PROBE_ROUTE_TEMPORARY = true;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:probe:${user.id}`, {
      limit: 6,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    if (getAiProviderId() !== "openai") {
      return apiJson(
        {
          success: false,
          category: "provider_unavailable",
          message: "AI_PROVIDER is not openai.",
          requestId,
          openaiRequestId: null,
        },
        { requestId, status: 200 },
      );
    }

    const result = await runOpenAiRuntimeProbe({ atlasRequestId: requestId });
    if (result.success) {
      return apiJson(
        {
          success: true,
          provider: result.provider,
          model: result.model,
          openaiRequestId: result.openaiRequestId,
          latencyMs: result.latencyMs,
          usage: {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          },
        },
        { requestId },
      );
    }

    return apiJson(
      {
        success: false,
        category: result.category,
        message: result.message,
        requestId: result.requestId,
        openaiRequestId: result.openaiRequestId,
      },
      { requestId },
    );
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "debug.ai-runtime.probe" },
      },
    });
    return apiError({
      status: 500,
      code: "internal_error",
      message: "AI runtime probe failed.",
      requestId,
    });
  }
}
