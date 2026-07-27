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
export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const leadId = id?.trim();
  if (!leadId) {
    return badRequest("Missing lead id.", requestId);
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

  const { data, error } = await supabase
    .from("lead_submissions")
    .select("*")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return internalError(requestId, safeLeadErrorMessage(error));
  }
  if (!data) {
    return forbidden(requestId, "Lead not found or access denied.");
  }

  return apiJson(
    {
      lead: toPublicLeadSubmission(
        rowToLeadSubmission(data as LeadSubmissionRow),
      ),
    },
    { requestId },
  );
}

/**
 * PATCH /api/leads/[id]
 * Body: { status?, isStarred?, internalNotes? }
 * Owner-scoped inbox actions. No delete.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { id } = await context.params;
  const leadId = id?.trim();
  if (!leadId) {
    return badRequest("Missing lead id.", requestId);
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

  const rate = checkDomainRateLimit(`leads:patch:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds, requestId);
  }

  let body: {
    status?: string;
    isStarred?: boolean;
    internalNotes?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body.", requestId, "invalid_json");
  }

  const patch: {
    status?: LeadSubmissionStatus;
    is_starred?: boolean;
    internal_notes?: string;
  } = {};

  if (body.status !== undefined) {
    const status = body.status?.trim() as LeadSubmissionStatus | undefined;
    if (!status || !ALLOWED_STATUS.has(status)) {
      return badRequest(
        "Invalid status. Use new, read, archived, or spam.",
        requestId,
        "invalid_status",
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
    return badRequest("No valid fields to update.", requestId);
  }

  const { data, error } = await supabase
    .from("lead_submissions")
    .update(patch)
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return internalError(requestId, safeLeadErrorMessage(error));
  }
  if (!data) {
    return forbidden(requestId, "Lead not found or access denied.");
  }

  return apiJson(
    {
      lead: toPublicLeadSubmission(
        rowToLeadSubmission(data as LeadSubmissionRow),
      ),
    },
    { requestId },
  );
}
