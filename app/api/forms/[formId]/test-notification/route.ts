import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { sendTestLeadNotification } from "@/lib/email/deliver-lead-notification";
import { redactProviderError } from "@/lib/email/errors";
import {
  isValidEmail,
  normalizeEmail,
  sanitizePlainText,
} from "@/lib/leads/sanitize";
import { safeLeadErrorMessage } from "@/lib/leads/serialize";
import type { LeadFormRow } from "@/lib/leads/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ formId: string }>;
};

/**
 * POST /api/forms/[formId]/test-notification
 * Send a test owner notification. Rate-limited. Never exposes provider secrets.
 */
export async function POST(request: Request, context: RouteContext) {
  const { formId: raw } = await context.params;
  const formId = raw?.trim();
  if (!formId) {
    return NextResponse.json({ error: "Missing form id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`forms:test-notify:${user.id}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many test notifications. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: { notificationEmail?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { data: form, error } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("id", formId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeLeadErrorMessage(error) },
      { status: 500 },
    );
  }
  if (!form) {
    return NextResponse.json(
      { error: "Form not found or access denied." },
      { status: 404 },
    );
  }

  const formRow = form as LeadFormRow;

  const { data: project } = await supabase
    .from("projects")
    .select("business_name, name")
    .eq("id", formRow.project_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  const projectName =
    (project as { business_name?: string; name?: string } | null)
      ?.business_name ||
    (project as { name?: string } | null)?.name ||
    "Your website";

  const override = sanitizePlainText(body.notificationEmail ?? "", {
    maxLength: 320,
  });
  const to = normalizeEmail(
    override || formRow.notification_email || user.email || "",
  );

  if (!to || !isValidEmail(to)) {
    return NextResponse.json(
      { error: "Enter a valid notification email." },
      { status: 400 },
    );
  }

  try {
    const result = await sendTestLeadNotification({
      to,
      projectName,
      subjectTemplate: formRow.email_subject_template,
    });

    if (!result.ok) {
      await supabase
        .from("lead_forms")
        .update({
          last_notification_error: result.error,
          last_notification_at: new Date().toISOString(),
        })
        .eq("id", formId)
        .eq("owner_id", user.id);

      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    await supabase
      .from("lead_forms")
      .update({
        last_notification_error: null,
        last_notification_at: new Date().toISOString(),
      })
      .eq("id", formId)
      .eq("owner_id", user.id);

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      to,
    });
  } catch (err) {
    return NextResponse.json(
      { error: redactProviderError(err) },
      { status: 502 },
    );
  }
}
