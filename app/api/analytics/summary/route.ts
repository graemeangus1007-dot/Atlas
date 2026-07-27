import { buildAnalyticsSummary } from "@/lib/analytics";
import {
  isAnalyticsOwnerError,
  requireAnalyticsOwner,
} from "@/lib/analytics/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/load";
import { logAnalytics } from "@/lib/analytics/log";
import { apiJson, getRequestId, internalError } from "@/lib/api";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";

export const runtime = "nodejs";

/** GET /api/analytics/summary?projectId= */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const projectId = new URL(request.url).searchParams.get("projectId");
  const auth = await requireAnalyticsOwner(projectId, requestId);
  if (isAnalyticsOwnerError(auth)) return auth.error;

  try {
    const { visits, leads } = await loadAnalyticsDataset(auth.supabase, {
      projectId: auth.projectId,
      ownerId: auth.user.id,
    });
    const summary = buildAnalyticsSummary(visits, leads);
    logAnalytics("dashboard_summary", {
      projectId: auth.projectId,
      visitorsToday: summary.visitorsToday,
      visitorsThisMonth: summary.visitorsThisMonth,
      totalLeads: summary.totalLeads,
      requestId,
    });
    return apiJson(summary, { requestId });
  } catch (err) {
    captureException({
      error: err,
      context: {
        request: requestContextFromRequest(request, requestId),
        project: { projectId: auth.projectId },
        tags: { route: "analytics.summary" },
      },
    });
    return internalError(requestId, "Could not load analytics.");
  }
}
