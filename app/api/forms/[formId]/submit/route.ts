import { after } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiErrorPayload, getRequestId } from "@/lib/api";
import { scheduleLeadNotificationDelivery } from "@/lib/email/deliver-lead-notification";
import { extractClientIp, hashIp } from "@/lib/leads/ip";
import { logLeadPipeline } from "@/lib/leads/log";
import { safeLeadErrorMessage } from "@/lib/leads/serialize";
import { buildLeadSubmissionInsert } from "@/lib/leads/submit-insert";
import {
  checkLeadSubmitRateLimit,
  LEAD_SUBMIT_MAX_BODY_BYTES,
  validateLeadSubmission,
  type LeadSubmitInput,
} from "@/lib/leads/validate";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createAnonClient } from "@/lib/supabase/anon";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import type { LeadFormRow } from "@/lib/leads/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ formId: string }>;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-request-id",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: NextResponse, requestId?: string) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}

function submitError(
  code: string,
  message: string,
  status: number,
  requestId: string,
  extra?: Record<string, unknown>,
) {
  return withCors(
    NextResponse.json(
      { ...apiErrorPayload(code, message, requestId), ...extra },
      { status },
    ),
    requestId,
  );
}

/** CORS preflight for published static sites on other origins. */
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * POST /api/forms/[formId]/submit
 * Public contact form intake — no auth. Never returns submission lists or DB errors.
 * Owner email notification runs after the response via `after()` (idempotent).
 */
export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  const { formId: rawFormId } = await context.params;
  const formId = rawFormId?.trim();
  logLeadPipeline("submit.reached", { formId, requestId });

  if (!formId) {
    return submitError("missing_form_id", "Missing form id.", 400, requestId);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > LEAD_SUBMIT_MAX_BODY_BYTES) {
    logLeadPipeline("submit.rejected_size", {
      formId,
      contentLength,
      requestId,
    });
    return submitError(
      "payload_too_large",
      "Submission is too large.",
      413,
      requestId,
    );
  }

  const ip = extractClientIp(request);
  const ipHash = hashIp(ip);
  const rateKey = `leads:submit:${formId}:${ipHash || "unknown"}`;
  const rate = checkLeadSubmitRateLimit(rateKey);
  if (!rate.allowed) {
    logLeadPipeline("submit.rate_limited", { formId, requestId });
    return withCors(
      NextResponse.json(
        apiErrorPayload(
          "rate_limited",
          "Too many submissions. Please try again shortly.",
          requestId,
        ),
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      ),
      requestId,
    );
  }

  let body: LeadSubmitInput;
  try {
    const text = await request.text();
    if (text.length > LEAD_SUBMIT_MAX_BODY_BYTES) {
      return submitError(
        "payload_too_large",
        "Submission is too large.",
        413,
        requestId,
      );
    }
    body = JSON.parse(text) as LeadSubmitInput;
  } catch {
    logLeadPipeline("submit.invalid_json", { formId, requestId });
    return submitError("invalid_json", "Invalid JSON body.", 400, requestId);
  }

  const validated = validateLeadSubmission(body);
  if (!validated.ok) {
    logLeadPipeline("submit.validation_failed", {
      formId,
      error: validated.error,
      requestId,
    });
    return submitError(
      "validation_failed",
      validated.error,
      validated.status,
      requestId,
      { fields: validated.fields },
    );
  }
  logLeadPipeline("submit.validation_ok", { formId, requestId });

  try {
    const anon = createAnonClient();
    // Do not select the owner notify address — public column grants omit it.
    const { data: form, error: formError } = await anon
      .from("lead_forms")
      .select("id, project_id, owner_id, is_enabled, success_message")
      .eq("id", formId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (formError || !form) {
      logLeadPipeline("submit.form_unavailable", {
        formId,
        hasFormError: Boolean(formError),
        requestId,
      });
      return submitError(
        "form_unavailable",
        "This form is unavailable.",
        404,
        requestId,
      );
    }

    const formRow = form as Pick<
      LeadFormRow,
      "id" | "project_id" | "owner_id" | "is_enabled" | "success_message"
    >;

    logLeadPipeline("submit.form_loaded", {
      formId: formRow.id,
      projectId: formRow.project_id,
      ownerId: formRow.owner_id,
    });

    const submissionId = randomUUID();
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) || null;
    const row = buildLeadSubmissionInsert({
      id: submissionId,
      formId: formRow.id,
      projectId: formRow.project_id,
      ownerId: formRow.owner_id,
      validated: validated.data,
      ipHash,
      userAgent,
      notificationStatus: "pending",
    });

    // Prefer service role when available (same key used for notification delivery)
    // so RETURNING / RLS SELECT quirks cannot hide a successful write.
    // Fall back to anon INSERT without .select() — anon must not read submissions.
    const service = tryCreateServiceClient();
    const writer = service ?? anon;
    const writerKind = service ? "service" : "anon";

    logLeadPipeline("submit.insert_attempt", {
      formId: formRow.id,
      projectId: formRow.project_id,
      ownerId: formRow.owner_id,
      submissionId,
      writerKind,
    });

    const { error: insertError } = await writer
      .from("lead_submissions")
      .insert(row);

    if (insertError) {
      logLeadPipeline("submit.insert_failed", {
        formId,
        submissionId,
        writerKind,
        error: safeLeadErrorMessage(insertError),
      });
      return submitError(
        "submit_failed",
        "Could not send your message. Please try again.",
        502,
        requestId,
      );
    }

    // Confirm the row is readable after commit (service role bypasses RLS).
    let committed = false;
    if (service) {
      const { data: verify, error: verifyError } = await service
        .from("lead_submissions")
        .select("id, project_id, owner_id")
        .eq("id", submissionId)
        .maybeSingle();
      committed = Boolean(verify) && !verifyError;
      logLeadPipeline("submit.insert_verified", {
        submissionId,
        projectId: formRow.project_id,
        ownerId: formRow.owner_id,
        committed,
        hasVerifyError: Boolean(verifyError),
      });
    } else {
      // Anon cannot verify via SELECT (by design). Treat no-error insert as commit.
      committed = true;
      logLeadPipeline("submit.insert_accepted_no_verify", {
        submissionId,
        projectId: formRow.project_id,
        ownerId: formRow.owner_id,
        writerKind,
      });
    }

    if (!committed) {
      logLeadPipeline("submit.commit_unconfirmed", {
        submissionId,
        formId,
        requestId,
      });
      return submitError(
        "submit_unconfirmed",
        "Could not send your message. Please try again.",
        502,
        requestId,
      );
    }

    scheduleLeadNotificationDelivery(submissionId, after);
    logLeadPipeline("submit.success", {
      submissionId,
      projectId: formRow.project_id,
      ownerId: formRow.owner_id,
      notifyScheduled: true,
      requestId,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        success: true,
        requestId,
        message:
          formRow.success_message ||
          "Thanks — we received your message and will get back to you soon.",
      }),
      requestId,
    );
  } catch (error) {
    logLeadPipeline("submit.exception", {
      formId,
      error: safeLeadErrorMessage(error),
      requestId,
    });
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        project: { formId },
        tags: { route: "forms.submit" },
      },
    });
    return submitError(
      "submit_failed",
      "Could not send your message. Please try again.",
      502,
      requestId,
    );
  }
}
