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
import {
  filterLeadsForInbox,
  normalizeInboxQuery,
  type LeadInboxStatusFilter,
} from "@/lib/leads/inbox";
import { logLeadPipeline } from "@/lib/leads/log";
import {
  rowToLeadSubmission,
  safeLeadErrorMessage,
  toPublicLeadSubmission,
} from "@/lib/leads/serialize";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import type { LeadSubmissionRow, LeadSubmissionStatus } from "@/lib/leads/types";

export const runtime = "nodejs";

const STATUS_FILTERS = new Set<LeadInboxStatusFilter>([
  "all",
  "new",
  "read",
  "archived",
  "spam",
  "starred",
]);

/**
 * GET /api/leads?projectId=&q=&status=&page=&pageSize=
 * List lead submissions for a project the caller owns (newest first).
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  if (!projectId) {
    return badRequest("Missing projectId query parameter.", requestId);
  }

  const statusParam = (url.searchParams.get("status")?.trim() ||
    "all") as LeadInboxStatusFilter;
  if (!STATUS_FILTERS.has(statusParam)) {
    return badRequest("Invalid status filter.", requestId, "invalid_status");
  }

  const q = url.searchParams.get("q")?.trim() || "";
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "25");
  const { page: safePage, pageSize: safePageSize } = normalizeInboxQuery({
    page,
    pageSize,
  });

  try {
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

    const rate = checkDomainRateLimit(`leads:list:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    logLeadPipeline("inbox.list_reached", {
      projectId,
      ownerId: user.id,
      status: statusParam,
      page: safePage,
      pageSize: safePageSize,
      hasQuery: Boolean(q),
      requestId,
    });

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!project) {
      logLeadPipeline("inbox.project_denied", {
        projectId,
        ownerId: user.id,
        requestId,
      });
      return forbidden(requestId);
    }

    // Same ownership scope as unread-count: project_id + owner_id (+ RLS).
    const { data, error, count } = await supabase
      .from("lead_submissions")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      logLeadPipeline("inbox.list_query_failed", {
        projectId,
        ownerId: user.id,
        error: safeLeadErrorMessage(error),
        requestId,
      });
      return internalError(requestId, safeLeadErrorMessage(error));
    }

    const rows = (data ?? []) as LeadSubmissionRow[];
    logLeadPipeline("inbox.list_query_ok", {
      projectId,
      ownerId: user.id,
      rowCount: rows.length,
      exactCount: count ?? null,
      requestId,
    });

    const all = rows.map((row) =>
      toPublicLeadSubmission(rowToLeadSubmission(row)),
    );

    const inbox = filterLeadsForInbox(all, {
      q,
      status: statusParam,
      page: safePage,
      pageSize: safePageSize,
    });

    logLeadPipeline("inbox.list_filtered", {
      projectId,
      ownerId: user.id,
      total: inbox.total,
      unreadCount: inbox.unreadCount,
      page: inbox.page,
      returned: inbox.items.length,
      requestId,
    });

    return apiJson(
      {
        leads: inbox.items,
        total: inbox.total,
        unreadCount: inbox.unreadCount,
        page: inbox.page,
        pageSize: inbox.pageSize,
      },
      { requestId },
    );
  } catch (error) {
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        project: { projectId },
        tags: { route: "leads.list" },
      },
    });
    return internalError(requestId);
  }
}

/** Shared status type export for clients. */
export type { LeadSubmissionStatus };
