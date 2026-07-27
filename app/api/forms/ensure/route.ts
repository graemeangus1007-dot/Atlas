import { NextResponse } from "next/server";
import { ownerHasFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  rowToLeadForm,
  safeLeadErrorMessage,
  toPublicLeadFormSettings,
} from "@/lib/leads/serialize";
import { isValidEmail, normalizeEmail, sanitizePlainText } from "@/lib/leads/sanitize";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";
import type { LeadFormRow } from "@/lib/leads/types";

export const runtime = "nodejs";

/**
 * POST /api/forms/ensure
 * Body: { projectId, successMessage?, name?, description? }
 * Creates or returns the project's lead form. Never trusts owner_id from client.
 * Defaults notification_email to the authenticated owner's email on create.
 */
export async function POST(request: Request) {
  let body: {
    projectId?: string;
    successMessage?: string;
    name?: string;
    description?: string;
    owner_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.owner_id != null) {
    return NextResponse.json(
      { error: "owner_id cannot be set by the client." },
      { status: 400 },
    );
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`forms:ensure:${user.id}`, {
    limit: 30,
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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json(
      { error: "Project not found or access denied." },
      { status: 403 },
    );
  }

  const successMessage = sanitizePlainText(body.successMessage, {
    maxLength: 500,
  });
  const name = sanitizePlainText(body.name, { maxLength: 120 }) || "Contact form";
  const description = sanitizePlainText(body.description, {
    maxLength: 500,
    allowNewlines: true,
  });

  const { data: existing } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    const patch: {
      success_message?: string;
      name?: string;
      description?: string;
    } = {};
    if (successMessage) patch.success_message = successMessage;
    if (body.name != null) patch.name = name;
    if (body.description != null) patch.description = description;

    if (Object.keys(patch).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from("lead_forms")
        .update(patch)
        .eq("id", (existing as LeadFormRow).id)
        .eq("owner_id", user.id)
        .select("*")
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: safeLeadErrorMessage(updateError) },
          { status: 500 },
        );
      }

      const form = rowToLeadForm(updated as LeadFormRow);
      return NextResponse.json({
        form,
        settings: toPublicLeadFormSettings(form),
      });
    }

    const form = rowToLeadForm(existing as LeadFormRow);
    return NextResponse.json({
      form,
      settings: toPublicLeadFormSettings(form),
    });
  }

  const ownerEmail = normalizeEmail(user.email || "");
  const notificationEmail =
    ownerEmail && isValidEmail(ownerEmail) ? ownerEmail : null;
  const canNotify = await ownerHasFeature(
    user.id,
    "emailNotifications",
    supabase,
  );

  const { data: inserted, error: insertError } = await supabase
    .from("lead_forms")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      name,
      description,
      success_message:
        successMessage ||
        "Thanks — we received your message and will get back to you soon.",
      is_enabled: true,
      notification_email: notificationEmail,
      email_notifications_enabled: canNotify,
      email_subject_template: DEFAULT_EMAIL_SUBJECT_TEMPLATE,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: safeLeadErrorMessage(insertError) },
      { status: 500 },
    );
  }

  const form = rowToLeadForm(inserted as LeadFormRow);
  return NextResponse.json({
    form,
    settings: toPublicLeadFormSettings(form),
    created: true,
  });
}
