import {
  apiError,
  apiJson,
  badRequest,
  forbidden,
  getRequestId,
  internalError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import { upgradeMessage } from "@/lib/billing/entitlements";
import { ownerHasFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { logLeadPipeline } from "@/lib/leads/log";
import { safeLeadErrorMessage } from "@/lib/leads/serialize";

export const runtime = "nodejs";

/**
 * GET /api/leads/unread-count?projectId=
 * Lightweight unread (status=new) count for sidebar badge.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) {
    return badRequest("Missing projectId query parameter.", requestId);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return unauthorized(requestId);
  }

  if (!(await ownerHasFeature(user.id, "leadInbox", supabase))) {
    return apiError({
      code: "feature_lead_inbox",
      message: upgradeMessage("feature_lead_inbox"),
      status: 402,
      requestId,
    });
  }

  const rate = checkDomainRateLimit(`leads:unread:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds, requestId);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return forbidden(requestId, "Project not found or access denied.");
  }

  // Must match GET /api/leads ownership filters (project_id + owner_id).
  const { count, error } = await supabase
    .from("lead_submissions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .eq("status", "new");

  if (error) {
    logLeadPipeline("inbox.unread_query_failed", {
      projectId,
      ownerId: user.id,
      error: safeLeadErrorMessage(error),
    });
    return internalError(requestId, safeLeadErrorMessage(error));
  }

  logLeadPipeline("inbox.unread_ok", {
    projectId,
    ownerId: user.id,
    unreadCount: count ?? 0,
  });

  return apiJson({ unreadCount: count ?? 0 }, { requestId });
}
