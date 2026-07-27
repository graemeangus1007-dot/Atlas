import { buildRecentVisits } from "@/lib/analytics";
import {
  isAnalyticsOwnerError,
  requireAdvancedAnalytics,
  requireAnalyticsOwner,
} from "@/lib/analytics/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/load";
import { getRequestId } from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/analytics/recent?projectId= */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const projectId = new URL(request.url).searchParams.get("projectId");
  const auth = await requireAnalyticsOwner(projectId, requestId);
  if (isAnalyticsOwnerError(auth)) return auth.error;
  const gated = await requireAdvancedAnalytics(auth, requestId);
  if (gated) return gated;

  try {
    const { visits, leads } = await loadAnalyticsDataset(auth.supabase, {
      projectId: auth.projectId,
      ownerId: auth.user.id,
      days: 30,
    });
    return Response.json({ recent: buildRecentVisits(visits, leads, 40) });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Could not load recent.",
      },
      { status: 500 },
    );
  }
}
