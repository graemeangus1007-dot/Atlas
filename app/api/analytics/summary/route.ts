import { buildAnalyticsSummary } from "@/lib/analytics";
import {
  isAnalyticsOwnerError,
  requireAnalyticsOwner,
} from "@/lib/analytics/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/load";
import { logAnalytics } from "@/lib/analytics/log";

export const runtime = "nodejs";

/** GET /api/analytics/summary?projectId= */
export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  const auth = await requireAnalyticsOwner(projectId);
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
    });
    return Response.json(summary);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load analytics.";
    return Response.json({ error: message }, { status: 500 });
  }
}
