import { NextResponse } from "next/server";
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
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId query parameter." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`leads:unread:${user.id}`, {
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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json(
      { error: "Project not found or access denied." },
      { status: 403 },
    );
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
    return NextResponse.json(
      { error: safeLeadErrorMessage(error) },
      { status: 500 },
    );
  }

  logLeadPipeline("inbox.unread_ok", {
    projectId,
    ownerId: user.id,
    unreadCount: count ?? 0,
  });

  return NextResponse.json({ unreadCount: count ?? 0 });
}
