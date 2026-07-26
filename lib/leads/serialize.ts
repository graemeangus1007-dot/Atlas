import type {
  LeadForm,
  LeadFormRow,
  LeadSubmission,
  LeadSubmissionRow,
  PublicLeadFormSettings,
  PublicLeadSubmission,
} from "@/lib/leads/types";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";

export function rowToLeadForm(row: LeadFormRow): LeadForm {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    successMessage: row.success_message,
    isEnabled: row.is_enabled,
    notificationEmail: row.notification_email ?? null,
    emailNotificationsEnabled: row.email_notifications_enabled !== false,
    emailSubjectTemplate:
      row.email_subject_template || DEFAULT_EMAIL_SUBJECT_TEMPLATE,
    lastNotificationError: row.last_notification_error ?? null,
    lastNotificationAt: row.last_notification_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicLeadFormSettings(form: LeadForm): PublicLeadFormSettings {
  return {
    id: form.id,
    projectId: form.projectId,
    name: form.name,
    description: form.description,
    successMessage: form.successMessage,
    isEnabled: form.isEnabled,
    notificationEmail: form.notificationEmail,
    emailNotificationsEnabled: form.emailNotificationsEnabled,
    emailSubjectTemplate: form.emailSubjectTemplate,
    lastNotificationError: form.lastNotificationError,
    lastNotificationAt: form.lastNotificationAt,
  };
}

export function rowToLeadSubmission(row: LeadSubmissionRow): LeadSubmission {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    formId: row.form_id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    metadata,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    status: row.status,
    isStarred: Boolean(row.is_starred),
    internalNotes: row.internal_notes ?? "",
    notificationStatus: row.notification_status ?? "pending",
    notificationAttemptedAt: row.notification_attempted_at ?? null,
    notificationSentAt: row.notification_sent_at ?? null,
    notificationError: row.notification_error ?? null,
    notificationProviderMessageId:
      row.notification_provider_message_id ?? null,
    createdAt: row.created_at,
  };
}

/** Dashboard JSON — never includes ip_hash or provider message ids. */
export function toPublicLeadSubmission(
  lead: LeadSubmission,
): PublicLeadSubmission {
  return {
    id: lead.id,
    formId: lead.formId,
    projectId: lead.projectId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    message: lead.message,
    metadata: lead.metadata,
    status: lead.status,
    isStarred: lead.isStarred,
    internalNotes: lead.internalNotes,
    notificationStatus: lead.notificationStatus,
    notificationAttemptedAt: lead.notificationAttemptedAt,
    notificationSentAt: lead.notificationSentAt,
    notificationError: lead.notificationError,
    createdAt: lead.createdAt,
  };
}

export function safeLeadErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : "Something went wrong.";
  const lower = raw.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("42501")) {
    return "You don't have permission to access these leads.";
  }
  if (lower.includes("jwt") || lower.includes("not authenticated")) {
    return "Please sign in and try again.";
  }
  // Never leak DB internals to clients.
  return "Something went wrong. Please try again.";
}
