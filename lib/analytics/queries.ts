import { attributeTrafficSource } from "@/lib/analytics/attribution";
import type {
  AnalyticsDeviceBreakdown,
  AnalyticsPageRow,
  AnalyticsRecentVisit,
  AnalyticsSourceRow,
  AnalyticsSummary,
  BrowserId,
  DeviceType,
  SiteVisitRow,
  TrafficSourceId,
} from "@/lib/analytics/types";

type LeadAttrRow = {
  id: string;
  created_at: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  session_id: string | null;
  visitor_id: string | null;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgo(n: number, now = new Date()): Date {
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function uniqueVisitors(visits: SiteVisitRow[]): number {
  return new Set(visits.map((v) => v.visitor_id)).size;
}

function sourceOf(visit: SiteVisitRow): TrafficSourceId {
  return attributeTrafficSource({
    referrer: visit.referrer,
    utmSource: visit.utm_source,
    utmMedium: visit.utm_medium,
  });
}

function sourceOfLead(lead: LeadAttrRow): TrafficSourceId {
  return attributeTrafficSource({
    referrer: lead.referrer || "",
    utmSource: lead.utm_source || "",
    utmMedium: lead.utm_medium || "",
  });
}

function normalizeBrowser(value: string): BrowserId {
  if (
    value === "Chrome" ||
    value === "Safari" ||
    value === "Edge" ||
    value === "Firefox"
  ) {
    return value;
  }
  return "Other";
}

export function buildAnalyticsSummary(
  visits: SiteVisitRow[],
  leads: LeadAttrRow[],
  now = new Date(),
): AnalyticsSummary {
  const today = startOfUtcDay(now);
  const weekStart = daysAgo(6, now);
  const monthStart = daysAgo(29, now);

  const visitorsToday = uniqueVisitors(
    visits.filter((v) => new Date(v.created_at) >= today),
  );
  const visitorsThisWeek = uniqueVisitors(
    visits.filter((v) => new Date(v.created_at) >= weekStart),
  );
  const visitorsThisMonth = uniqueVisitors(
    visits.filter((v) => new Date(v.created_at) >= monthStart),
  );

  const totalLeads = leads.length;
  const monthVisits = visits.filter((v) => new Date(v.created_at) >= monthStart);
  const monthVisitors = uniqueVisitors(monthVisits);
  const conversionRate =
    monthVisitors > 0 ? Number(((totalLeads / monthVisitors) * 100).toFixed(1)) : 0;

  const bounced = monthVisits.filter((v) => v.bounced).length;
  const bounceRate =
    monthVisits.length > 0
      ? Number(((bounced / monthVisits.length) * 100).toFixed(1))
      : 0;

  const dailyVisitors: AnalyticsSummary["dailyVisitors"] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = daysAgo(i, now);
    const next = daysAgo(i - 1, now);
    const dayVisits = visits.filter((v) => {
      const t = new Date(v.created_at);
      return t >= day && t < next;
    });
    dailyVisitors.push({
      date: isoDate(day),
      visitors: uniqueVisitors(dayVisits),
    });
  }

  const weeklyVisitors: AnalyticsSummary["weeklyVisitors"] = [];
  for (let w = 7; w >= 0; w -= 1) {
    const start = daysAgo(w * 7 + 6, now);
    const end = daysAgo(w * 7 - 1, now);
    const bucket = visits.filter((v) => {
      const t = new Date(v.created_at);
      return t >= start && t < end;
    });
    weeklyVisitors.push({
      week: isoDate(start),
      visitors: uniqueVisitors(bucket),
    });
  }

  const monthlyVisitors: AnalyticsSummary["monthlyVisitors"] = [];
  for (let m = 5; m >= 0; m -= 1) {
    const cursor = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1),
    );
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m + 1, 1),
    );
    const bucket = visits.filter((v) => {
      const t = new Date(v.created_at);
      return t >= cursor && t < next;
    });
    monthlyVisitors.push({
      month: isoDate(cursor).slice(0, 7),
      visitors: uniqueVisitors(bucket),
    });
  }

  const leadsOverTime = dailyVisitors.map((d) => {
    const day = new Date(`${d.date}T00:00:00.000Z`);
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    const count = leads.filter((l) => {
      const t = new Date(l.created_at);
      return t >= day && t < next;
    }).length;
    return { date: d.date, leads: count };
  });

  const conversionTrend = dailyVisitors.map((d, index) => {
    const leadsCount = leadsOverTime[index]?.leads ?? 0;
    const rate =
      d.visitors > 0
        ? Number(((leadsCount / d.visitors) * 100).toFixed(1))
        : 0;
    return { date: d.date, rate };
  });

  const sourceCounts = new Map<TrafficSourceId, number>();
  for (const lead of leads) {
    const s = sourceOfLead(lead);
    sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
  }
  const leadsBySource = (
    [
      "direct",
      "google",
      "bing",
      "facebook",
      "instagram",
      "linkedin",
      "referral",
      "other",
    ] as TrafficSourceId[]
  ).map((source) => ({ source, leads: sourceCounts.get(source) || 0 }));

  const campaignCounts = new Map<string, number>();
  for (const lead of leads) {
    const campaign = (lead.utm_campaign || "").trim() || "(none)";
    campaignCounts.set(campaign, (campaignCounts.get(campaign) || 0) + 1);
  }
  const leadsByCampaign = [...campaignCounts.entries()]
    .map(([campaign, count]) => ({ campaign, leads: count }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 10);

  const pageVisitCounts = new Map<string, number>();
  for (const v of monthVisits) {
    pageVisitCounts.set(v.page_path, (pageVisitCounts.get(v.page_path) || 0) + 1);
  }
  const pageLeadCounts = new Map<string, number>();
  for (const lead of leads) {
    const path = (lead.landing_page || "/").trim() || "/";
    pageLeadCounts.set(path, (pageLeadCounts.get(path) || 0) + 1);
  }
  const topConvertingPages = [...pageVisitCounts.entries()]
    .map(([pagePath, pageVisits]) => {
      const pageLeads = pageLeadCounts.get(pagePath) || 0;
      return {
        pagePath,
        visits: pageVisits,
        leads: pageLeads,
        conversionRate:
          pageVisits > 0
            ? Number(((pageLeads / pageVisits) * 100).toFixed(1))
            : 0,
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate || b.leads - a.leads)
    .slice(0, 10);

  return {
    visitorsToday,
    visitorsThisWeek,
    visitorsThisMonth,
    totalLeads,
    conversionRate,
    bounceRate,
    dailyVisitors,
    weeklyVisitors,
    monthlyVisitors,
    leadsOverTime,
    conversionTrend,
    leadsBySource,
    leadsByCampaign,
    topConvertingPages,
  };
}

export function buildAnalyticsPages(
  visits: SiteVisitRow[],
  leads: LeadAttrRow[],
  sort: "visits" | "uniqueVisitors" | "conversionRate" = "visits",
): AnalyticsPageRow[] {
  const byPath = new Map<
    string,
    { visits: number; visitors: Set<string>; leads: number }
  >();

  for (const v of visits) {
    const row = byPath.get(v.page_path) || {
      visits: 0,
      visitors: new Set<string>(),
      leads: 0,
    };
    row.visits += 1;
    row.visitors.add(v.visitor_id);
    byPath.set(v.page_path, row);
  }

  for (const lead of leads) {
    const path = (lead.landing_page || "/").trim() || "/";
    const row = byPath.get(path) || {
      visits: 0,
      visitors: new Set<string>(),
      leads: 0,
    };
    row.leads += 1;
    byPath.set(path, row);
  }

  const rows: AnalyticsPageRow[] = [...byPath.entries()].map(
    ([pagePath, data]) => ({
      pagePath,
      visits: data.visits,
      uniqueVisitors: data.visitors.size,
      conversionRate:
        data.visits > 0
          ? Number(((data.leads / data.visits) * 100).toFixed(1))
          : 0,
    }),
  );

  rows.sort((a, b) => {
    if (sort === "uniqueVisitors") return b.uniqueVisitors - a.uniqueVisitors;
    if (sort === "conversionRate") return b.conversionRate - a.conversionRate;
    return b.visits - a.visits;
  });
  return rows;
}

export function buildAnalyticsSources(
  visits: SiteVisitRow[],
  leads: LeadAttrRow[],
): AnalyticsSourceRow[] {
  const map = new Map<
    TrafficSourceId,
    { visits: number; visitors: Set<string>; leads: number }
  >();

  const ensure = (source: TrafficSourceId) => {
    const row = map.get(source) || {
      visits: 0,
      visitors: new Set<string>(),
      leads: 0,
    };
    map.set(source, row);
    return row;
  };

  for (const id of [
    "direct",
    "google",
    "bing",
    "facebook",
    "instagram",
    "linkedin",
    "referral",
    "other",
  ] as TrafficSourceId[]) {
    ensure(id);
  }

  for (const v of visits) {
    const row = ensure(sourceOf(v));
    row.visits += 1;
    row.visitors.add(v.visitor_id);
  }
  for (const lead of leads) {
    ensure(sourceOfLead(lead)).leads += 1;
  }

  return [...map.entries()].map(([source, data]) => ({
    source,
    visits: data.visits,
    uniqueVisitors: data.visitors.size,
    leads: data.leads,
  }));
}

export function buildDeviceBreakdown(
  visits: SiteVisitRow[],
): AnalyticsDeviceBreakdown {
  const devices = new Map<DeviceType, number>();
  const browsers = new Map<BrowserId, number>();
  const countries = new Map<string, number>();

  for (const v of visits) {
    devices.set(v.device_type, (devices.get(v.device_type) || 0) + 1);
    const browser = normalizeBrowser(v.browser);
    browsers.set(browser, (browsers.get(browser) || 0) + 1);
    const country = v.country.trim() || "Unknown";
    countries.set(country, (countries.get(country) || 0) + 1);
  }

  return {
    devices: (["desktop", "tablet", "mobile", "other"] as DeviceType[]).map(
      (device) => ({ device, count: devices.get(device) || 0 }),
    ),
    browsers: (["Chrome", "Safari", "Edge", "Firefox", "Other"] as BrowserId[]).map(
      (browser) => ({ browser, count: browsers.get(browser) || 0 }),
    ),
    countries: [...countries.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  };
}

export function buildRecentVisits(
  visits: SiteVisitRow[],
  leads: LeadAttrRow[],
  limit = 25,
): AnalyticsRecentVisit[] {
  const convertedSessions = new Set(
    leads.map((l) => l.session_id).filter(Boolean) as string[],
  );
  const convertedVisitors = new Set(
    leads.map((l) => l.visitor_id).filter(Boolean) as string[],
  );

  return [...visits]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      time: v.created_at,
      pagePath: v.page_path,
      source: sourceOf(v),
      device: v.device_type,
      browser: v.browser,
      country: v.country || "Unknown",
      converted:
        convertedSessions.has(v.session_id) ||
        convertedVisitors.has(v.visitor_id),
    }));
}
