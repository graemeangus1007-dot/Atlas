"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatCard from "@/components/dashboard/stat-card";
import Button from "@/components/ui/button";
import { useProject } from "@/context/project-context";
import {
  TRAFFIC_SOURCE_LABELS,
  type AnalyticsDeviceBreakdown,
  type AnalyticsPageRow,
  type AnalyticsRecentVisit,
  type AnalyticsSourceRow,
  type AnalyticsSummary,
} from "@/lib/analytics";

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MiniBars({
  items,
  valueKey,
  labelKey,
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(
    1,
    ...items.map((item) => Number(item[valueKey]) || 0),
  );
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const width = Math.round((value / max) * 100);
        return (
          <li key={String(item[labelKey])} className="text-xs">
            <div className="mb-1 flex justify-between gap-2 text-muted">
              <span className="truncate text-foreground">
                {String(item[labelKey])}
              </span>
              <span>{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-accent/80"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Website analytics dashboard — overview, charts, pages, sources, devices.
 */
export default function AnalyticsDashboard() {
  const { projectId, project, projects } = useProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const activeProjectId = selectedProjectId || projectId;

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pages, setPages] = useState<AnalyticsPageRow[]>([]);
  const [sources, setSources] = useState<AnalyticsSourceRow[]>([]);
  const [devices, setDevices] = useState<AnalyticsDeviceBreakdown | null>(null);
  const [recent, setRecent] = useState<AnalyticsRecentVisit[]>([]);
  const [pageSort, setPageSort] = useState<
    "visits" | "uniqueVisitors" | "conversionRate"
  >("visits");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectOptions = useMemo(() => {
    if (projects.length > 0) return projects;
    if (projectId) {
      return [
        {
          id: projectId,
          name: project.businessName || "Current project",
        },
      ];
    }
    return [];
  }, [projects, projectId, project.businessName]);

  const load = useCallback(async () => {
    if (!activeProjectId) {
      setSummary(null);
      setPages([]);
      setSources([]);
      setDevices(null);
      setRecent([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const qs = `projectId=${encodeURIComponent(activeProjectId)}`;
      const [summaryRes, pagesRes, sourcesRes, devicesRes, recentRes] =
        await Promise.all([
          fetch(`/api/analytics/summary?${qs}`, { cache: "no-store" }),
          fetch(`/api/analytics/pages?${qs}&sort=${pageSort}`, {
            cache: "no-store",
          }),
          fetch(`/api/analytics/sources?${qs}`, { cache: "no-store" }),
          fetch(`/api/analytics/devices?${qs}`, { cache: "no-store" }),
          fetch(`/api/analytics/recent?${qs}`, { cache: "no-store" }),
        ]);

      if (
        !summaryRes.ok ||
        !pagesRes.ok ||
        !sourcesRes.ok ||
        !devicesRes.ok ||
        !recentRes.ok
      ) {
        throw new Error("Could not load analytics.");
      }

      const summaryJson = (await summaryRes.json()) as AnalyticsSummary;
      const pagesJson = (await pagesRes.json()) as { pages: AnalyticsPageRow[] };
      const sourcesJson = (await sourcesRes.json()) as {
        sources: AnalyticsSourceRow[];
      };
      const devicesJson = (await devicesRes.json()) as AnalyticsDeviceBreakdown;
      const recentJson = (await recentRes.json()) as {
        recent: AnalyticsRecentVisit[];
      };

      setSummary(summaryJson);
      setPages(pagesJson.pages || []);
      setSources(sourcesJson.sources || []);
      setDevices(devicesJson);
      setRecent(recentJson.recent || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, pageSort]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Visitors, page views, traffic sources, devices, and lead conversions
            for your published Atlas site.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">
            Project
            <select
              className="ml-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={activeProjectId || ""}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
            >
              {projectOptions.length === 0 ? (
                <option value="">No projects</option>
              ) : (
                projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {"name" in p ? p.name : p.id}
                  </option>
                ))
              )}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!activeProjectId ? (
        <p className="mt-8 text-sm text-muted">
          Open or create a project to view analytics.
        </p>
      ) : null}

      {loading && !summary ? (
        <p className="mt-8 text-sm text-muted">Loading analytics…</p>
      ) : null}

      {summary ? (
        <div className="mt-8 space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Visitors Today"
              value={String(summary.visitorsToday)}
            />
            <StatCard
              label="Visitors This Week"
              value={String(summary.visitorsThisWeek)}
            />
            <StatCard
              label="Visitors This Month"
              value={String(summary.visitorsThisMonth)}
            />
            <StatCard label="Total Leads" value={String(summary.totalLeads)} />
            <StatCard
              label="Conversion Rate"
              value={formatPct(summary.conversionRate)}
              hint="Leads ÷ monthly visitors"
            />
            <StatCard
              label="Bounce Rate"
              value={formatPct(summary.bounceRate)}
              hint="Single-page sessions under 15s"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Daily visitors
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.dailyVisitors.slice(-14).map((d) => ({
                    label: d.date.slice(5),
                    value: d.visitors,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Weekly visitors
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.weeklyVisitors.map((d) => ({
                    label: d.week.slice(5),
                    value: d.visitors,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Monthly visitors
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.monthlyVisitors.map((d) => ({
                    label: d.month,
                    value: d.visitors,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Leads over time
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.leadsOverTime.slice(-14).map((d) => ({
                    label: d.date.slice(5),
                    value: d.leads,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground">
                Conversion trend
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.conversionTrend.slice(-14).map((d) => ({
                    label: d.date.slice(5),
                    value: d.rate,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Top pages
                </h2>
                <select
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                  value={pageSort}
                  onChange={(e) =>
                    setPageSort(
                      e.target.value as
                        | "visits"
                        | "uniqueVisitors"
                        | "conversionRate",
                    )
                  }
                >
                  <option value="visits">Sort: visits</option>
                  <option value="uniqueVisitors">Sort: unique visitors</option>
                  <option value="conversionRate">Sort: conversion rate</option>
                </select>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-2 font-medium">Page</th>
                      <th className="pb-2 font-medium">Visits</th>
                      <th className="pb-2 font-medium">Unique</th>
                      <th className="pb-2 font-medium">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.slice(0, 12).map((row) => (
                      <tr key={row.pagePath} className="border-t border-border/60">
                        <td className="py-2 pr-2 font-medium text-foreground">
                          {row.pagePath}
                        </td>
                        <td className="py-2 text-muted">{row.visits}</td>
                        <td className="py-2 text-muted">{row.uniqueVisitors}</td>
                        <td className="py-2 text-muted">
                          {formatPct(row.conversionRate)}
                        </td>
                      </tr>
                    ))}
                    {pages.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-muted">
                          No page views yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Traffic sources
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Visits</th>
                      <th className="pb-2 font-medium">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((row) => (
                      <tr key={row.source} className="border-t border-border/60">
                        <td className="py-2 pr-2 text-foreground">
                          {TRAFFIC_SOURCE_LABELS[row.source]}
                        </td>
                        <td className="py-2 text-muted">{row.visits}</td>
                        <td className="py-2 text-muted">{row.leads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">Devices</h2>
              <div className="mt-4">
                <MiniBars
                  items={(devices?.devices || []).map((d) => ({
                    label: d.device,
                    value: d.count,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">Browsers</h2>
              <div className="mt-4">
                <MiniBars
                  items={(devices?.browsers || []).map((d) => ({
                    label: d.browser,
                    value: d.count,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Top countries
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={(devices?.countries || []).map((d) => ({
                    label: d.country,
                    value: d.count,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Leads by source
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.leadsBySource.map((d) => ({
                    label: TRAFFIC_SOURCE_LABELS[d.source],
                    value: d.leads,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-surface/60 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Leads by campaign
              </h2>
              <div className="mt-4">
                <MiniBars
                  items={summary.leadsByCampaign.map((d) => ({
                    label: d.campaign,
                    value: d.leads,
                  }))}
                  labelKey="label"
                  valueKey="value"
                />
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Top converting pages
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 font-medium">Visits</th>
                    <th className="pb-2 font-medium">Leads</th>
                    <th className="pb-2 font-medium">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topConvertingPages.map((row) => (
                    <tr key={row.pagePath} className="border-t border-border/60">
                      <td className="py-2 text-foreground">{row.pagePath}</td>
                      <td className="py-2 text-muted">{row.visits}</td>
                      <td className="py-2 text-muted">{row.leads}</td>
                      <td className="py-2 text-muted">
                        {formatPct(row.conversionRate)}
                      </td>
                    </tr>
                  ))}
                  {summary.topConvertingPages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted">
                        No conversions yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-surface/60">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Recent visitors
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-3 py-3 font-medium">Page</th>
                    <th className="px-3 py-3 font-medium">Source</th>
                    <th className="px-3 py-3 font-medium">Device</th>
                    <th className="px-3 py-3 font-medium">Browser</th>
                    <th className="px-3 py-3 font-medium">Country</th>
                    <th className="px-5 py-3 font-medium">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="px-5 py-3 text-muted">
                        {new Date(row.time).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-foreground">{row.pagePath}</td>
                      <td className="px-3 py-3 text-muted">
                        {TRAFFIC_SOURCE_LABELS[row.source]}
                      </td>
                      <td className="px-3 py-3 text-muted">{row.device}</td>
                      <td className="px-3 py-3 text-muted">{row.browser}</td>
                      <td className="px-3 py-3 text-muted">{row.country}</td>
                      <td className="px-5 py-3 text-muted">
                        {row.converted ? "Yes" : "—"}
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-muted">
                        No visitors yet. Publish your site to start tracking.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
