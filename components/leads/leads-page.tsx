"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import type { LeadInboxStatusFilter } from "@/lib/leads/inbox";
import type { PublicLeadSubmission } from "@/lib/leads/types";
import type { LeadSubmissionStatus } from "@/lib/leads/types";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "new":
      return "border-accent/40 bg-accent-soft text-accent";
    case "read":
      return "border-border text-muted";
    case "archived":
      return "border-border text-muted opacity-70";
    case "spam":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-border text-muted";
  }
}

const FILTERS: { id: LeadInboxStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
  { id: "spam", label: "Spam" },
  { id: "starred", label: "Starred" },
];

/**
 * Professional Lead Inbox — search, filters, pagination, and owner actions.
 */
export default function LeadsPage() {
  const { projectId, project } = useProject();
  const searchParams = useSearchParams();
  const deepLinkLead = searchParams.get("lead")?.trim() || null;

  const [leads, setLeads] = useState<PublicLeadSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<LeadInboxStatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const selected = useMemo(
    () => leads.find((lead) => lead.id === selectedId) ?? null,
    [leads, selectedId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status, projectId]);

  const loadLeads = useCallback(async () => {
    if (!projectId) {
      setLeads([]);
      setTotal(0);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        page: String(page),
        pageSize: String(pageSize),
        status,
      });
      if (debouncedQ) params.set("q", debouncedQ);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        leads?: PublicLeadSubmission[];
        total?: number;
        unreadCount?: number;
        error?: string | { code?: string; message?: string };
      };
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Could not load leads.";
        const upgrade =
          typeof data.error === "object" &&
          data.error?.code === "feature_lead_inbox"
            ? " Upgrade in Billing to unlock the lead inbox."
            : "";
        setError(`${message}${upgrade}`);
        setLeads([]);
        return;
      }
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setError("Could not load leads.");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, status, debouncedQ]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    if (deepLinkLead) setSelectedId(deepLinkLead);
  }, [deepLinkLead]);

  useEffect(() => {
    if (!selected) {
      setNotesDraft("");
      setNotesDirty(false);
      return;
    }
    if (!notesDirty) {
      setNotesDraft(selected.internalNotes || "");
    }
  }, [selected, notesDirty]);

  async function patchLead(body: {
    status?: LeadSubmissionStatus;
    isStarred?: boolean;
    internalNotes?: string;
  }) {
    if (!selected) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        lead?: PublicLeadSubmission;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not update lead.");
        return;
      }
      if (data.lead) {
        setLeads((prev) =>
          prev.map((lead) => (lead.id === data.lead!.id ? data.lead! : lead)),
        );
        if (body.internalNotes !== undefined) setNotesDirty(false);
        // Refresh counts when status changes (unread badge).
        if (body.status !== undefined) void loadLeads();
      }
    } catch {
      setError("Could not update lead.");
    } finally {
      setUpdating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
            Leads
            {unreadCount > 0 ? (
              <span className="ml-2 align-middle rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                {unreadCount} new
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Inbox for contact form submissions
            {project.businessName ? ` — ${project.businessName}` : ""}.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-2 text-xs"
          onClick={() => void loadLeads()}
          disabled={loading || !projectId}
        >
          Refresh
        </Button>
      </div>

      {!projectId ? (
        <p className="mt-6 text-sm text-amber-200">
          Open a saved project to view its leads.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {projectId ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, company, phone, or message"
              className="w-full flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              aria-label="Search leads"
            />
            <p className="shrink-0 text-xs text-muted">
              {total} result{total === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const active = status === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatus(filter.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-accent/50 bg-accent-soft text-foreground"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {filter.label}
                  {filter.id === "new" && unreadCount > 0
                    ? ` (${unreadCount})`
                    : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading leads…</p>
      ) : null}

      {!loading && projectId && leads.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No submissions match this view. Publish your site with the contact
          form enabled to start collecting leads.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">
                  Company
                </th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`cursor-pointer border-t border-border/80 hover:bg-surface/40 ${
                    selectedId === lead.id ? "bg-accent-soft/40" : ""
                  } ${lead.status === "new" ? "font-medium" : ""}`}
                  onClick={() => {
                    setSelectedId(lead.id);
                    setNotesDirty(false);
                    if (lead.status === "new") {
                      void (async () => {
                        setSelectedId(lead.id);
                        const res = await fetch(
                          `/api/leads/${encodeURIComponent(lead.id)}`,
                          {
                            method: "PATCH",
                            credentials: "same-origin",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "read" }),
                          },
                        );
                        if (res.ok) {
                          const data = (await res.json()) as {
                            lead?: PublicLeadSubmission;
                          };
                          if (data.lead) {
                            setLeads((prev) =>
                              prev.map((row) =>
                                row.id === data.lead!.id ? data.lead! : row,
                              ),
                            );
                            setUnreadCount((n) => Math.max(0, n - 1));
                          }
                        }
                      })();
                    }
                  }}
                >
                  <td className="px-3 py-2 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {lead.isStarred ? (
                        <span className="text-amber-300" aria-label="Starred">
                          ★
                        </span>
                      ) : null}
                      {lead.name}
                    </span>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-muted">
                    {lead.email}
                  </td>
                  <td className="hidden max-w-[8rem] truncate px-3 py-2 text-muted sm:table-cell">
                    {lead.company || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] capitalize ${statusTone(lead.status)}`}
                    >
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    From
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {selected.name}
                  </p>
                  <p className="break-all text-sm text-muted">{selected.email}</p>
                </div>
                <button
                  type="button"
                  className={`rounded-lg border px-2 py-1 text-sm ${
                    selected.isStarred
                      ? "border-amber-400/50 text-amber-300"
                      : "border-border text-muted"
                  }`}
                  aria-label={selected.isStarred ? "Unstar lead" : "Star lead"}
                  disabled={updating}
                  onClick={() =>
                    void patchLead({ isStarred: !selected.isStarred })
                  }
                >
                  {selected.isStarred ? "★" : "☆"}
                </button>
              </div>

              {selected.phone ? (
                <p className="text-sm text-foreground">
                  <span className="text-muted">Phone </span>
                  {selected.phone}
                </p>
              ) : null}
              {selected.company ? (
                <p className="text-sm text-foreground">
                  <span className="text-muted">Company </span>
                  {selected.company}
                </p>
              ) : null}

              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Message
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {selected.message}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Internal notes
                </p>
                <textarea
                  value={notesDraft}
                  onChange={(e) => {
                    setNotesDraft(e.target.value);
                    setNotesDirty(true);
                  }}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  placeholder="Private notes (not visible to the visitor)"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 px-3 py-1.5 text-xs"
                  disabled={updating || !notesDirty}
                  onClick={() =>
                    void patchLead({ internalNotes: notesDraft })
                  }
                >
                  Save notes
                </Button>
              </div>

              <p className="text-xs text-muted">
                Received {formatDate(selected.createdAt)}
                {selected.notificationStatus
                  ? ` · Notify: ${selected.notificationStatus}`
                  : ""}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  className="px-3 py-2 text-xs"
                  disabled={updating}
                  onClick={() => {
                    const subject = encodeURIComponent(
                      `Re: your message to ${project.businessName || "us"}`,
                    );
                    window.location.href = `mailto:${selected.email}?subject=${subject}`;
                  }}
                >
                  Reply
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  disabled={updating}
                  onClick={() =>
                    void patchLead({
                      status: selected.status === "new" ? "read" : "new",
                    })
                  }
                >
                  {selected.status === "new" ? "Mark read" : "Mark unread"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  disabled={updating}
                  onClick={() =>
                    void patchLead({
                      status:
                        selected.status === "archived" ? "read" : "archived",
                    })
                  }
                >
                  {selected.status === "archived" ? "Unarchive" : "Archive"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  disabled={updating}
                  onClick={() =>
                    void patchLead({
                      status: selected.status === "spam" ? "read" : "spam",
                    })
                  }
                >
                  {selected.status === "spam" ? "Not spam" : "Mark spam"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Select a lead to view the full message.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
