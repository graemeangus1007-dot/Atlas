/**
 * Server-side lead form ensure (Sprint 20.0C).
 * Never trusts client-supplied owner_id — owner comes from the auth session.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ownerHasFeature } from "@/lib/billing/subscription";
import {
  rowToLeadForm,
  safeLeadErrorMessage,
} from "@/lib/leads/serialize";
import {
  isValidEmail,
  normalizeEmail,
  sanitizePlainText,
} from "@/lib/leads/sanitize";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";
import type { LeadFormRow } from "@/lib/leads/types";
import type { Database } from "@/lib/supabase/types";

export type EnsureLeadFormInput = {
  projectId: string;
  successMessage?: string;
  name?: string;
  description?: string;
};

export type EnsureLeadFormResult =
  | { ok: true; formId: string; created: boolean }
  | { ok: false; error: string; status: number };

/**
 * Create or return the project's lead form for an authenticated owner.
 */
export async function ensureLeadFormForOwner(
  supabase: SupabaseClient<Database>,
  user: User,
  input: EnsureLeadFormInput,
): Promise<EnsureLeadFormResult> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    return { ok: false, error: "Missing projectId.", status: 400 };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    return {
      ok: false,
      error: "Project not found or access denied.",
      status: 403,
    };
  }

  const successMessage = sanitizePlainText(input.successMessage, {
    maxLength: 500,
  });
  const name =
    sanitizePlainText(input.name, { maxLength: 120 }) || "Contact form";
  const description = sanitizePlainText(input.description, {
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
    const form = rowToLeadForm(existing as LeadFormRow);
    return { ok: true, formId: form.id, created: false };
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
    return {
      ok: false,
      error: safeLeadErrorMessage(insertError),
      status: 500,
    };
  }

  const form = rowToLeadForm(inserted as LeadFormRow);
  return { ok: true, formId: form.id, created: true };
}
