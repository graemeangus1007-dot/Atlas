import { NextResponse } from "next/server";
import { upgradeMessage } from "@/lib/billing/entitlements";
import { ownerHasFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  rowToLeadForm,
  safeLeadErrorMessage,
  toPublicLeadFormSettings,
} from "@/lib/leads/serialize";
import {
  isValidEmail,
  normalizeEmail,
  sanitizePlainText,
} from "@/lib/leads/sanitize";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";
import type { LeadFormRow } from "@/lib/leads/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ formId: string }>;
};

/**
 * GET /api/forms/[formId]
 * Owner form settings (notification email, subject template, etc.).
 */
export async function GET(_request: Request, context: RouteContext) {
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

  const { data, error } = await supabase
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
  if (!data) {
    return NextResponse.json(
      { error: "Form not found or access denied." },
      { status: 404 },
    );
  }

  const form = rowToLeadForm(data as LeadFormRow);
  return NextResponse.json({
    form,
    settings: toPublicLeadFormSettings(form),
  });
}

/**
 * PATCH /api/forms/[formId]
 * Update notification settings (owner only).
 */
export async function PATCH(request: Request, context: RouteContext) {
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

  const rate = checkDomainRateLimit(`forms:patch:${user.id}`, {
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
    emailNotificationsEnabled?: boolean;
    notificationEmail?: string | null;
    emailSubjectTemplate?: string;
    successMessage?: string;
    isEnabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: {
    email_notifications_enabled?: boolean;
    notification_email?: string | null;
    email_subject_template?: string;
    success_message?: string;
    is_enabled?: boolean;
  } = {};

  if (typeof body.emailNotificationsEnabled === "boolean") {
    if (body.emailNotificationsEnabled) {
      const allowed = await ownerHasFeature(
        user.id,
        "emailNotifications",
        supabase,
      );
      if (!allowed) {
        return NextResponse.json(
          {
            error: upgradeMessage("feature_email_notifications"),
            code: "feature_email_notifications",
          },
          { status: 402 },
        );
      }
    }
    patch.email_notifications_enabled = body.emailNotificationsEnabled;
  }

  if (body.notificationEmail !== undefined) {
    const email = normalizeEmail(
      sanitizePlainText(body.notificationEmail ?? "", { maxLength: 320 }),
    );
    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid notification email." },
        { status: 400 },
      );
    }
    patch.notification_email = email || null;
  }

  if (body.emailSubjectTemplate !== undefined) {
    const subject = sanitizePlainText(body.emailSubjectTemplate, {
      maxLength: 200,
    });
    patch.email_subject_template = subject || DEFAULT_EMAIL_SUBJECT_TEMPLATE;
  }

  if (body.successMessage !== undefined) {
    const msg = sanitizePlainText(body.successMessage, { maxLength: 500 });
    if (msg) patch.success_message = msg;
  }

  if (typeof body.isEnabled === "boolean") {
    patch.is_enabled = body.isEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("lead_forms")
    .update(patch)
    .eq("id", formId)
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
      { error: "Form not found or access denied." },
      { status: 404 },
    );
  }

  const form = rowToLeadForm(data as LeadFormRow);
  return NextResponse.json({
    form,
    settings: toPublicLeadFormSettings(form),
  });
}
