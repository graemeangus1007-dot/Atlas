/**
 * TEMPORARY Sprint 28.0D/E diagnostic — remove after production verification.
 * POST /api/debug/ai-runtime/critique-schema-probe
 *
 * Probes the real critique wire schema via the production critique path
 * (same output budget / temperature / timeout).
 * Returns only success/failure, request IDs, model, latency, sanitized error.
 * Never returns prompts or generated critique content.
 */

import {
  apiError,
  apiJson,
  getRequestId,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import { runOpenAiCritiqueSchemaProbe } from "@/lib/ai/design-critique-provider";
import { getAiProviderId } from "@/lib/ai/provider";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** TEMPORARY: delete this route after OpenAI critique schema verification passes. */
export const AI_CRITIQUE_SCHEMA_PROBE_ROUTE_TEMPORARY = true;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:critique-schema-probe:${user.id}`, {
      limit: 4,
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
          model: null,
          latencyMs: 0,
          httpStatus: null,
          incompleteReason: null,
          configuredMaxOutputTokens: null,
          retriedForOutputLimit: false,
          responseStatus: null,
          schemaName: "atlas_design_critique",
        },
        { requestId, status: 200 },
      );
    }

    const result = await runOpenAiCritiqueSchemaProbe({
      atlasRequestId: requestId,
    });

    return apiJson(
      {
        success: result.success,
        category: result.category,
        message: result.message,
        requestId: result.requestId,
        openaiRequestId: result.openaiRequestId,
        model: result.model,
        latencyMs: result.latencyMs,
        httpStatus: result.httpStatus,
        incompleteReason: result.incompleteReason,
        configuredMaxOutputTokens: result.configuredMaxOutputTokens,
        retriedForOutputLimit: result.retriedForOutputLimit,
        responseStatus: result.responseStatus,
        openaiErrorCode: result.openaiErrorCode,
        openaiErrorParam: result.openaiErrorParam,
        schemaPath: result.schemaPath,
        schemaName: result.schemaName,
        usage: result.usage,
      },
      { requestId },
    );
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "debug.ai-runtime.critique-schema-probe" },
      },
    });
    return apiError({
      status: 500,
      code: "internal_error",
      message: "Critique schema probe failed.",
      requestId,
    });
  }
}
