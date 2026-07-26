/** Lead form + submission types (Sprint 17.0A / 17.0B). */

export type LeadSubmissionStatus = "new" | "read" | "archived" | "spam";

export type LeadNotificationStatus =
  | "pending"
  | "skipped"
  | "sending"
  | "sent"
  | "failed";

export const DEFAULT_EMAIL_SUBJECT_TEMPLATE =
  "New lead from {{name}} — {{project}}";

export type LeadFormRow = {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  description: string;
  success_message: string;
  is_enabled: boolean;
  notification_email: string | null;
  email_notifications_enabled: boolean;
  email_subject_template: string;
  last_notification_error: string | null;
  last_notification_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadSubmissionRow = {
  id: string;
  form_id: string;
  project_id: string;
  owner_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  metadata: Record<string, unknown>;
  ip_hash: string | null;
  user_agent: string | null;
  status: LeadSubmissionStatus;
  is_starred: boolean;
  internal_notes: string;
  notification_status: LeadNotificationStatus;
  notification_attempted_at: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  notification_provider_message_id: string | null;
  created_at: string;
  session_id?: string | null;
  visitor_id?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

export type LeadForm = {
  id: string;
  projectId: string;
  ownerId: string;
  name: string;
  description: string;
  successMessage: string;
  isEnabled: boolean;
  notificationEmail: string | null;
  emailNotificationsEnabled: boolean;
  emailSubjectTemplate: string;
  lastNotificationError: string | null;
  lastNotificationAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadSubmission = {
  id: string;
  formId: string;
  projectId: string;
  ownerId: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  metadata: Record<string, unknown>;
  ipHash: string | null;
  userAgent: string | null;
  status: LeadSubmissionStatus;
  isStarred: boolean;
  internalNotes: string;
  notificationStatus: LeadNotificationStatus;
  notificationAttemptedAt: string | null;
  notificationSentAt: string | null;
  notificationError: string | null;
  notificationProviderMessageId: string | null;
  createdAt: string;
};

/** Dashboard JSON — never includes ip_hash. */
export type PublicLeadSubmission = {
  id: string;
  formId: string;
  projectId: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
  metadata: Record<string, unknown>;
  status: LeadSubmissionStatus;
  isStarred: boolean;
  internalNotes: string;
  notificationStatus: LeadNotificationStatus;
  notificationAttemptedAt: string | null;
  notificationSentAt: string | null;
  notificationError: string | null;
  createdAt: string;
};

/** Owner-facing form settings (no secrets). */
export type PublicLeadFormSettings = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  successMessage: string;
  isEnabled: boolean;
  notificationEmail: string | null;
  emailNotificationsEnabled: boolean;
  emailSubjectTemplate: string;
  lastNotificationError: string | null;
  lastNotificationAt: string | null;
};
