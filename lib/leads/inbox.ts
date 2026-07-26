/**
 * Pure helpers for lead inbox filtering, search, and pagination (testable).
 */

import type {
  LeadSubmissionStatus,
  PublicLeadSubmission,
} from "@/lib/leads/types";

export type LeadInboxStatusFilter =
  | "all"
  | LeadSubmissionStatus
  | "starred";

export type LeadInboxQuery = {
  q?: string;
  status?: LeadInboxStatusFilter;
  page?: number;
  pageSize?: number;
};

export const LEAD_INBOX_DEFAULT_PAGE_SIZE = 25;
export const LEAD_INBOX_MAX_PAGE_SIZE = 100;

export function normalizeInboxQuery(input: LeadInboxQuery): {
  q: string;
  status: LeadInboxStatusFilter;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(
    LEAD_INBOX_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(input.pageSize ?? LEAD_INBOX_DEFAULT_PAGE_SIZE)),
  );
  const status = input.status ?? "all";
  const q = (input.q ?? "").trim().toLowerCase();
  return { q, status, page, pageSize };
}

export function leadMatchesSearch(
  lead: Pick<
    PublicLeadSubmission,
    "name" | "email" | "company" | "phone" | "message"
  >,
  q: string,
): boolean {
  if (!q) return true;
  const haystack = [
    lead.name,
    lead.email,
    lead.company ?? "",
    lead.phone ?? "",
    lead.message,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function filterLeadsForInbox(
  leads: PublicLeadSubmission[],
  query: LeadInboxQuery,
): {
  items: PublicLeadSubmission[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
} {
  const { q, status, page, pageSize } = normalizeInboxQuery(query);

  const unreadCount = leads.filter((lead) => lead.status === "new").length;

  let filtered = leads.filter((lead) => leadMatchesSearch(lead, q));

  if (status === "starred") {
    filtered = filtered.filter((lead) => lead.isStarred);
  } else if (status !== "all") {
    filtered = filtered.filter((lead) => lead.status === status);
  }

  // Newest first (stable if already sorted).
  filtered = [...filtered].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, unreadCount, page, pageSize };
}

export function countUnread(
  leads: Array<{ status: LeadSubmissionStatus }>,
): number {
  return leads.filter((lead) => lead.status === "new").length;
}
