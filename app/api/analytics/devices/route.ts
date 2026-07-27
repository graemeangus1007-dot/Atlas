import { buildDeviceBreakdown } from "@/lib/analytics";
import {
  isAnalyticsOwnerError,
  requireAdvancedAnalytics,
  requireAnalyticsOwner,
} from "@/lib/analytics/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/load";
import { getRequestId } from "@/lib/api";

export const runtime = "nodejs";

/** GET /api/analytics/devices?projectId= */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const projectId = new URL(request.url).searchParams.get("projectId");
  const auth = await requireAnalyticsOwner(projectId, requestId);
  if (isAnalyticsOwnerError(auth)) return auth.error;
  const gated = await requireAdvancedAnalytics(auth, requestId);
  if (gated) return gated;

  try {
    const { visits } = await loadAnalyticsDataset(auth.supabase, {
      projectId: auth.projectId,
      ownerId: auth.user.id,
    });
    return Response.json(buildDeviceBreakdown(visits));
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Could not load devices.",
      },
      { status: 500 },
    );
  }
}
