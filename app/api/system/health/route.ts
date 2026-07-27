import {
  apiError,
  apiJson,
  getRequestId,
  unauthorized,
} from "@/lib/api/errors";
import { runSystemHealthChecks } from "@/lib/health";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/system/health
 * Authenticated system health report for /dashboard/system.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized(requestId);
    }

    const report = await runSystemHealthChecks();
    return apiJson(report, { requestId });
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "system.health" },
      },
    });
    return apiError({
      code: "health_check_failed",
      message: "Could not complete health checks.",
      status: 500,
      requestId,
    });
  }
}
