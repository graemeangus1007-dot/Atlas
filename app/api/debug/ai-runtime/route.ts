/**
 * TEMPORARY Sprint 28.0B diagnostic — remove after production verification.
 * GET /api/debug/ai-runtime
 */

import {
  apiError,
  apiJson,
  getRequestId,
  unauthorized,
} from "@/lib/api";
import { getAiRuntimeSnapshot } from "@/lib/ai/ai-runtime-diagnostics";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** TEMPORARY: delete this route after OpenAI critique verification passes. */
export const AI_RUNTIME_DEBUG_ROUTE_TEMPORARY = true;

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    return apiJson(getAiRuntimeSnapshot(), { requestId });
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "debug.ai-runtime" },
      },
    });
    return apiError({
      status: 500,
      code: "internal_error",
      message: "Could not read AI runtime diagnostics.",
      requestId,
    });
  }
}
