import { after } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
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
  const { formId: rawFormId } = await context.params;
  const formId = rawFormId?.trim();
  logLeadPipeline("submit.reached", { formId });

  if (!formId) {
    return withCors(
      NextResponse.json({ error: "Missing form id." }, { status: 400 }),
    );
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > LEAD_SUBMIT_MAX_BODY_BYTES) {
    logLeadPipeline("submit.rejected_size", { formId, contentLength });
    return withCors(
      NextResponse.json(
        { error: "Submission is too large." },
        { status: 413 },
      ),
    );
  }

  const ip = extractClientIp(request);
  const ipHash = hashIp(ip);
  const rateKey = `leads:submit:${formId}:${ipHash || "unknown"}`;
  const rate = checkLeadSubmitRateLimit(rateKey);
  if (!rate.allowed) {
    logLeadPipeline("submit.rate_limited", { formId });
    return withCors(
      NextResponse.json(
        { error: "Too many submissions. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      ),
    );
  }

  let body: LeadSubmitInput;
  try {
    const text = await request.text();
    if (text.length > LEAD_SUBMIT_MAX_BODY_BYTES) {
      return withCors(
        NextResponse.json(
          { error: "Submission is too large." },
          { status: 413 },
        ),
      );
    }
    body = JSON.parse(text) as LeadSubmitInput;
  } catch {
    logLeadPipeline("submit.invalid_json", { formId });
    return withCors(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    );
  }

  const validated = validateLeadSubmission(body);
  if (!validated.ok) {
    logLeadPipeline("submit.validation_failed", {
      formId,
      error: validated.error,
    });
    return withCors(
      NextResponse.json(
        { error: validated.error, fields: validated.fields },
        { status: validated.status },
      ),
    );
  }
  logLeadPipeline("submit.validation_ok", { formId });

  try {
    const anon = createAnonClient();
    // Do not select notification_email — public column grants omit it.
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
      });
      return withCors(
        NextResponse.json(
          { error: "This form is unavailable." },
          { status: 404 },
        ),
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
      return withCors(
        NextResponse.json(
          { error: "Could not send your message. Please try again." },
          { status: 502 },
        ),
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
      logLeadPipeline("submit.commit_unconfirmed", { submissionId, formId });
      return withCors(
        NextResponse.json(
          { error: "Could not send your message. Please try again." },
          { status: 502 },
        ),
      );
    }

    scheduleLeadNotificationDelivery(submissionId, after);
    logLeadPipeline("submit.success", {
      submissionId,
      projectId: formRow.project_id,
      ownerId: formRow.owner_id,
      notifyScheduled: true,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        success: true,
        message:
          formRow.success_message ||
          "Thanks — we received your message and will get back to you soon.",
      }),
    );
  } catch (error) {
    logLeadPipeline("submit.exception", {
      formId,
      error: safeLeadErrorMessage(error),
    });
    return withCors(
      NextResponse.json(
        { error: "Could not send your message. Please try again." },
        { status: 502 },
      ),
    );
  }
}
