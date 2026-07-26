import { NextResponse } from "next/server";
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
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId query parameter." },
      { status: 400 },
    );
  }

  const statusParam = (url.searchParams.get("status")?.trim() ||
    "all") as LeadInboxStatusFilter;
  if (!STATUS_FILTERS.has(statusParam)) {
    return NextResponse.json(
      { error: "Invalid status filter." },
      { status: 400 },
    );
  }

  const q = url.searchParams.get("q")?.trim() || "";
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "25");
  const { page: safePage, pageSize: safePageSize } = normalizeInboxQuery({
    page,
    pageSize,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`leads:list:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  logLeadPipeline("inbox.list_reached", {
    projectId,
    ownerId: user.id,
    status: statusParam,
    page: safePage,
    pageSize: safePageSize,
    hasQuery: Boolean(q),
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
    });
    return NextResponse.json(
      { error: "Project not found or access denied." },
      { status: 403 },
    );
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
    });
    return NextResponse.json(
      { error: safeLeadErrorMessage(error) },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as LeadSubmissionRow[];
  logLeadPipeline("inbox.list_query_ok", {
    projectId,
    ownerId: user.id,
    rowCount: rows.length,
    exactCount: count ?? null,
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
  });

  return NextResponse.json({
    leads: inbox.items,
    total: inbox.total,
    unreadCount: inbox.unreadCount,
    page: inbox.page,
    pageSize: inbox.pageSize,
  });
}

/** Shared status type export for clients. */
export type { LeadSubmissionStatus };
