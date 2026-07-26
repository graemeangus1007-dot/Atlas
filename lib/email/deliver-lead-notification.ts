/**
 * Explicit typed lead-notification delivery service.
 *
 * Lifecycle (idempotent):
 *   pending → sending → sent
 *                 ↘ failed
 *   skipped (notifications off / invalid email / missing config)
 *
 * Duplicate prevention: only rows in `pending` can be claimed to `sending`.
 * Once `sent`, `failed`, `skipped`, or `sending`, a second call is a no-op.
 *
 * Future queue extension point:
 *   Replace `scheduleLeadNotificationDelivery` with an enqueue to a durable
 *   worker (Inngest / QStash / SQS). Keep `deliverLeadNotification` as the
 *   single processor so claim + send + record stay identical.
 */

import {
  buildLeadNotificationEmail,
  buildSecureLeadUrl,
} from "@/lib/email/lead-notification-template";
import {
  createEmailProvider,
  getEmailFromAddress,
} from "@/lib/email/create-provider";
import { redactProviderError } from "@/lib/email/errors";
import type { EmailProvider } from "@/lib/email/types";
import { isValidEmail, normalizeEmail } from "@/lib/leads/sanitize";
import { getPublicAtlasOrigin } from "@/lib/leads/validate";
import type {
  LeadFormRow,
  LeadNotificationStatus,
  LeadSubmissionRow,
} from "@/lib/leads/types";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type LeadNotificationDeliveryResult =
  | {
      ok: true;
      status: LeadNotificationStatus;
      messageId?: string;
      duplicate?: boolean;
      skippedReason?: string;
    }
  | {
      ok: false;
      status: LeadNotificationStatus;
      error: string;
      duplicate?: boolean;
    };

type Db = SupabaseClient<Database>;

export type DeliverLeadNotificationDeps = {
  supabase?: Db;
  provider?: EmailProvider;
  atlasOrigin?: string;
  fromAddress?: string;
  now?: () => string;
};

async function loadContext(supabase: Db, submissionId: string) {
  const { data: submission, error: subError } = await supabase
    .from("lead_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();

  if (subError || !submission) {
    return { error: "Lead submission not found." as const };
  }

  const row = submission as LeadSubmissionRow;

  const { data: form } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("id", row.form_id)
    .maybeSingle();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, business_name")
    .eq("id", row.project_id)
    .maybeSingle();

  return {
    submission: row,
    form: (form as LeadFormRow | null) ?? null,
    projectName:
      (project as { business_name?: string; name?: string } | null)
        ?.business_name ||
      (project as { name?: string } | null)?.name ||
      "Your website",
  };
}

type SubmissionNotificationPatch = {
  notification_status?: LeadNotificationStatus;
  notification_attempted_at?: string | null;
  notification_sent_at?: string | null;
  notification_error?: string | null;
  notification_provider_message_id?: string | null;
};

async function markSubmission(
  supabase: Db,
  id: string,
  patch: SubmissionNotificationPatch,
  onlyIfStatus?: LeadNotificationStatus[],
) {
  let query = supabase
    .from("lead_submissions")
    .update(patch)
    .eq("id", id);

  if (onlyIfStatus?.length === 1) {
    query = query.eq("notification_status", onlyIfStatus[0]);
  } else if (onlyIfStatus && onlyIfStatus.length > 1) {
    query = query.in("notification_status", onlyIfStatus);
  }

  const { data, error } = await query.select("id, notification_status").maybeSingle();
  return { data, error };
}

async function recordFormNotification(
  supabase: Db,
  formId: string,
  patch: {
    last_notification_at?: string;
    last_notification_error?: string | null;
  },
) {
  await supabase.from("lead_forms").update(patch).eq("id", formId);
}

/**
 * Deliver (or skip) the owner notification for one submission.
 * Safe to call multiple times — duplicates are prevented by status claim.
 */
export async function deliverLeadNotification(
  submissionId: string,
  deps: DeliverLeadNotificationDeps = {},
): Promise<LeadNotificationDeliveryResult> {
  const supabase = deps.supabase ?? tryCreateServiceClient();
  if (!supabase) {
    return {
      ok: false,
      status: "pending",
      error: redactProviderError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured; cannot record notification delivery.",
      ),
    };
  }

  const now = deps.now?.() ?? new Date().toISOString();
  const loaded = await loadContext(supabase, submissionId);
  if ("error" in loaded && loaded.error) {
    return { ok: false, status: "failed", error: loaded.error };
  }

  const { submission, form, projectName } = loaded as {
    submission: LeadSubmissionRow;
    form: LeadFormRow | null;
    projectName: string;
  };

  // Already finalized — idempotent no-op.
  if (
    submission.notification_status === "sent" ||
    submission.notification_status === "skipped" ||
    submission.notification_status === "failed" ||
    submission.notification_status === "sending"
  ) {
    return {
      ok: true,
      status: submission.notification_status,
      duplicate: true,
      messageId: submission.notification_provider_message_id ?? undefined,
      skippedReason:
        submission.notification_status === "skipped"
          ? "already_skipped"
          : undefined,
    };
  }

  if (!form) {
    await markSubmission(supabase, submissionId, {
      notification_status: "failed",
      notification_attempted_at: now,
      notification_error: "Lead form not found.",
    });
    return { ok: false, status: "failed", error: "Lead form not found." };
  }

  if (!form.email_notifications_enabled) {
    await markSubmission(supabase, submissionId, {
      notification_status: "skipped",
      notification_attempted_at: now,
      notification_error: null,
    });
    return {
      ok: true,
      status: "skipped",
      skippedReason: "notifications_disabled",
    };
  }

  const to = normalizeEmail(form.notification_email || "");
  if (!to || !isValidEmail(to)) {
    const error = "Notification email is missing or invalid.";
    await markSubmission(supabase, submissionId, {
      notification_status: "failed",
      notification_attempted_at: now,
      notification_error: error,
    });
    await recordFormNotification(supabase, form.id, {
      last_notification_at: now,
      last_notification_error: error,
    });
    return { ok: false, status: "failed", error };
  }

  // Claim pending → sending (duplicate-safe).
  const claim = await markSubmission(
    supabase,
    submissionId,
    {
      notification_status: "sending",
      notification_attempted_at: now,
      notification_error: null,
    },
    ["pending"],
  );

  if (claim.error || !claim.data) {
    // Another worker claimed it, or status changed.
    return {
      ok: true,
      status: "sending",
      duplicate: true,
    };
  }

  let leadUrl: string;
  try {
    leadUrl = buildSecureLeadUrl(
      deps.atlasOrigin ?? getPublicAtlasOrigin(),
      submission.id,
    );
  } catch (error) {
    const message = redactProviderError(error);
    await markSubmission(supabase, submissionId, {
      notification_status: "failed",
      notification_error: message,
    });
    await recordFormNotification(supabase, form.id, {
      last_notification_at: now,
      last_notification_error: message,
    });
    return { ok: false, status: "failed", error: message };
  }

  const emailContent = buildLeadNotificationEmail({
    leadName: submission.name,
    leadEmail: submission.email,
    leadPhone: submission.phone,
    leadCompany: submission.company,
    leadMessage: submission.message,
    projectName,
    submittedAt: new Date(submission.created_at).toUTCString(),
    leadUrl,
    subjectTemplate: form.email_subject_template,
  });

  // Never include IP hashes in notification payloads (assert by omission).
  const provider = deps.provider ?? createEmailProvider();
  const from = deps.fromAddress ?? getEmailFromAddress();

  const result = await provider.send({
    to,
    from,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey: `lead-notification:${submission.id}`,
    tags: {
      kind: "lead_notification",
      submission_id: submission.id,
    },
  });

  if (!result.ok) {
    await markSubmission(supabase, submissionId, {
      notification_status: "failed",
      notification_error: result.error,
    });
    await recordFormNotification(supabase, form.id, {
      last_notification_at: now,
      last_notification_error: result.error,
    });
    return { ok: false, status: "failed", error: result.error };
  }

  const sentAt = deps.now?.() ?? new Date().toISOString();
  await markSubmission(supabase, submissionId, {
    notification_status: "sent",
    notification_sent_at: sentAt,
    notification_provider_message_id: result.messageId,
    notification_error: null,
  });
  await recordFormNotification(supabase, form.id, {
    last_notification_at: sentAt,
    last_notification_error: null,
  });

  return {
    ok: true,
    status: "sent",
    messageId: result.messageId,
  };
}

/**
 * Schedule delivery after the HTTP response (Next.js `after`).
 * Extension point: swap this for a durable queue enqueue.
 */
export function scheduleLeadNotificationDelivery(
  submissionId: string,
  schedule: (task: () => Promise<void>) => void,
  deps: DeliverLeadNotificationDeps = {},
): void {
  schedule(async () => {
    try {
      await deliverLeadNotification(submissionId, deps);
    } catch (error) {
      console.info("[leads.notify] delivery_error", {
        submissionId,
        error: redactProviderError(error),
      });
    }
  });
}

/**
 * Send a one-off test notification (does not create a submission).
 */
export async function sendTestLeadNotification(input: {
  to: string;
  projectName: string;
  subjectTemplate?: string | null;
  provider?: EmailProvider;
  fromAddress?: string;
  atlasOrigin?: string;
}): Promise<
  | { ok: true; messageId: string }
  | { ok: false; error: string }
> {
  const to = normalizeEmail(input.to);
  if (!to || !isValidEmail(to)) {
    return { ok: false, error: "Enter a valid notification email." };
  }

  const origin = input.atlasOrigin ?? getPublicAtlasOrigin();
  // Synthetic id shape for URL builder — test links go to inbox root.
  let leadUrl: string;
  try {
    const parsed = new URL(origin.replace(/\/+$/, ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Invalid Atlas origin." };
    }
    leadUrl = `${parsed.origin}/leads`;
  } catch {
    return { ok: false, error: "Invalid Atlas origin." };
  }

  const content = buildLeadNotificationEmail({
    leadName: "Test Lead",
    leadEmail: "test@example.com",
    leadPhone: "555-0100",
    leadCompany: "Example Co",
    leadMessage:
      "This is a test notification from Atlas. Your email settings are working.",
    projectName: input.projectName,
    submittedAt: new Date().toUTCString(),
    leadUrl,
    subjectTemplate: input.subjectTemplate,
  });

  const provider = input.provider ?? createEmailProvider();
  const result = await provider.send({
    to,
    from: input.fromAddress ?? getEmailFromAddress(),
    subject: `[Test] ${content.subject}`,
    html: content.html,
    text: content.text,
    tags: { kind: "lead_notification_test" },
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, messageId: result.messageId };
}
