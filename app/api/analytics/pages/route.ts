import { buildAnalyticsPages } from "@/lib/analytics";
import {
  isAnalyticsOwnerError,
  requireAnalyticsOwner,
} from "@/lib/analytics/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/load";

export const runtime = "nodejs";

/** GET /api/analytics/pages?projectId=&sort=visits|uniqueVisitors|conversionRate */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const sortRaw = url.searchParams.get("sort") || "visits";
  const sort =
    sortRaw === "uniqueVisitors" || sortRaw === "conversionRate"
      ? sortRaw
      : "visits";

  const auth = await requireAnalyticsOwner(projectId);
  if (isAnalyticsOwnerError(auth)) return auth.error;

  try {
    const { visits, leads } = await loadAnalyticsDataset(auth.supabase, {
      projectId: auth.projectId,
      ownerId: auth.user.id,
    });
    return Response.json({ pages: buildAnalyticsPages(visits, leads, sort) });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load pages." },
      { status: 500 },
    );
  }
}
