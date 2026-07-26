/**
 * Public lead insert helpers.
 *
 * CRITICAL: anon may INSERT into lead_submissions but must NEVER SELECT them.
 * Chaining `.insert().select()` (RETURNING) fails RLS even when the INSERT
 * policy passes — and depending on PostgREST, the row may still commit while
 * the API returns an error (or the opposite). Always insert with an explicit id
 * and without `.select()` for the anon client.
 */

import type { LeadSubmitValidated } from "@/lib/leads/validate";
import type { LeadNotificationStatus } from "@/lib/leads/types";

export type LeadSubmissionInsertRow = {
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
  status: "new";
  notification_status: LeadNotificationStatus;
  session_id: string | null;
  visitor_id: string | null;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export function buildLeadSubmissionInsert(input: {
  id: string;
  formId: string;
  projectId: string;
  ownerId: string;
  validated: LeadSubmitValidated;
  ipHash: string | null;
  userAgent: string | null;
  notificationStatus?: LeadNotificationStatus;
}): LeadSubmissionInsertRow {
  const attr = input.validated.attribution;
  return {
    id: input.id,
    form_id: input.formId,
    project_id: input.projectId,
    owner_id: input.ownerId,
    name: input.validated.name,
    email: input.validated.email,
    phone: input.validated.phone,
    company: input.validated.company,
    message: input.validated.message,
    metadata: {
      attribution: {
        sessionId: attr.sessionId,
        hasVisitor: Boolean(attr.visitorIdHash),
        landingPage: attr.landingPage,
        utmSource: attr.utmSource,
        utmMedium: attr.utmMedium,
        utmCampaign: attr.utmCampaign,
      },
    },
    ip_hash: input.ipHash,
    user_agent: input.userAgent,
    status: "new",
    notification_status: input.notificationStatus ?? "pending",
    session_id: attr.sessionId,
    visitor_id: attr.visitorIdHash,
    landing_page: attr.landingPage,
    referrer: attr.referrer,
    utm_source: attr.utmSource,
    utm_medium: attr.utmMedium,
    utm_campaign: attr.utmCampaign,
  };
}

/** True when the published HTML posts to the expected Atlas submit path. */
export function publishedSubmitPathMatches(
  apiBaseUrl: string,
  formId: string,
  html: string,
): boolean {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const expected = `${base}/api/forms/${encodeURIComponent(formId)}/submit`;
  return html.includes(expected);
}

/**
 * Owner dashboard visibility predicate — mirrors GET /api/leads filters
 * (project_id + owner_id). Used by regression tests.
 */
export function leadVisibleInOwnerInbox(input: {
  submissionProjectId: string;
  submissionOwnerId: string;
  queryProjectId: string;
  queryOwnerId: string;
}): boolean {
  return (
    input.submissionProjectId === input.queryProjectId &&
    input.submissionOwnerId === input.queryOwnerId
  );
}
