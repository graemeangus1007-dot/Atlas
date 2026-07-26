import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { sanitizePlainText } from "@/lib/leads/sanitize";
import {
  rowToLeadSubmission,
  safeLeadErrorMessage,
  toPublicLeadSubmission,
} from "@/lib/leads/serialize";
import type {
  LeadSubmissionRow,
  LeadSubmissionStatus,
} from "@/lib/leads/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_STATUS = new Set<LeadSubmissionStatus>([
  "new",
  "read",
  "archived",
  "spam",
]);

/**
 * GET /api/leads/[id]
 * Fetch a single lead the caller owns.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const leadId = id?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("lead_submissions")
    .select("*")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeLeadErrorMessage(error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Lead not found or access denied." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    lead: toPublicLeadSubmission(
      rowToLeadSubmission(data as LeadSubmissionRow),
    ),
  });
}

/**
 * PATCH /api/leads/[id]
 * Body: { status?, isStarred?, internalNotes? }
 * Owner-scoped inbox actions. No delete.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const leadId = id?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`leads:patch:${user.id}`, {
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

  let body: {
    status?: string;
    isStarred?: boolean;
    internalNotes?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: {
    status?: LeadSubmissionStatus;
    is_starred?: boolean;
    internal_notes?: string;
  } = {};

  if (body.status !== undefined) {
    const status = body.status?.trim() as LeadSubmissionStatus | undefined;
    if (!status || !ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { error: "Invalid status. Use new, read, archived, or spam." },
        { status: 400 },
      );
    }
    patch.status = status;
  }

  if (typeof body.isStarred === "boolean") {
    patch.is_starred = body.isStarred;
  }

  if (body.internalNotes !== undefined) {
    patch.internal_notes = sanitizePlainText(body.internalNotes, {
      maxLength: 5000,
      allowNewlines: true,
    });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeLeadErrorMessage(error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Lead not found or access denied." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    lead: toPublicLeadSubmission(
      rowToLeadSubmission(data as LeadSubmissionRow),
    ),
  });
}
