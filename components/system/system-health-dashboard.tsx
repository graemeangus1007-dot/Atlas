"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import type { HealthStatus, SystemHealthReport } from "@/lib/health";

function statusStyles(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "degraded":
      return "bg-amber-500/15 text-amber-200 border-amber-500/30";
    case "unavailable":
      return "bg-red-500/15 text-red-300 border-red-500/30";
  }
}

function formatCheckedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Protected system health view for early customer-testing readiness.
 */
export default function SystemHealthDashboard() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/health", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json()) as
        | SystemHealthReport
        | { error?: { message?: string } };
      if (!res.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          data.error &&
          typeof data.error === "object" &&
          "message" in data.error
            ? String(data.error.message)
            : "Could not load health checks.";
        setError(message);
        setReport(null);
        return;
      }
      setReport(data as SystemHealthReport);
    } catch {
      setError("Could not load health checks.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground">
            System health
          </h1>
          <p className="mt-1 text-sm text-muted">
            Environment and provider checks for early customer testing. Messages
            are redacted — secrets never appear here.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Checking…" : "Re-check"}
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {!error && !report && loading ? (
        <p className="text-sm text-muted">Running health checks…</p>
      ) : null}

      {report ? (
        <>
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${statusStyles(report.overall)}`}
          >
            <p className="font-medium capitalize">Overall: {report.overall}</p>
            <p className="mt-1 opacity-80">
              Last checked {formatCheckedAt(report.checkedAt)}
            </p>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {report.checks.map((check) => (
              <li
                key={check.id}
                className="rounded-2xl border border-border bg-surface/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {check.label}
                  </p>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyles(check.status)}`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">{check.message}</p>
                <p className="mt-3 text-[11px] text-muted">
                  Last checked {formatCheckedAt(check.checkedAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!loading && !error && !report ? (
        <p className="text-sm text-muted">No health data available.</p>
      ) : null}
    </div>
  );
}
