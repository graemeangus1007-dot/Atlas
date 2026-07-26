export type DeviceType = "desktop" | "tablet" | "mobile" | "other";

export type TrafficSourceId =
  | "direct"
  | "google"
  | "bing"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "referral"
  | "other";

export type BrowserId =
  | "Chrome"
  | "Safari"
  | "Edge"
  | "Firefox"
  | "Other";

export type AnalyticsCollectEvent =
  | "pageview"
  | "heartbeat"
  | "unload";

export type AnalyticsCollectPayload = {
  projectId?: unknown;
  event?: unknown;
  sessionId?: unknown;
  visitorId?: unknown;
  pagePath?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  language?: unknown;
  screenSize?: unknown;
  durationSeconds?: unknown;
  /** Client-hint user agent string (optional; server may prefer header). */
  userAgent?: unknown;
};

export type SiteVisitRow = {
  id: string;
  project_id: string;
  owner_id: string;
  session_id: string;
  visitor_id: string;
  page_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  country: string;
  region: string;
  city: string;
  device_type: DeviceType;
  browser: string;
  operating_system: string;
  screen_size: string;
  language: string;
  duration_seconds: number;
  bounced: boolean;
  created_at: string;
};

export type PageViewRow = {
  id: string;
  visit_id: string;
  project_id: string;
  page_path: string;
  timestamp: string;
};

export type AnalyticsSummary = {
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  totalLeads: number;
  conversionRate: number;
  bounceRate: number;
  dailyVisitors: Array<{ date: string; visitors: number }>;
  weeklyVisitors: Array<{ week: string; visitors: number }>;
  monthlyVisitors: Array<{ month: string; visitors: number }>;
  leadsOverTime: Array<{ date: string; leads: number }>;
  conversionTrend: Array<{ date: string; rate: number }>;
  leadsBySource: Array<{ source: TrafficSourceId; leads: number }>;
  leadsByCampaign: Array<{ campaign: string; leads: number }>;
  topConvertingPages: Array<{
    pagePath: string;
    visits: number;
    leads: number;
    conversionRate: number;
  }>;
};

export type AnalyticsPageRow = {
  pagePath: string;
  visits: number;
  uniqueVisitors: number;
  conversionRate: number;
};

export type AnalyticsSourceRow = {
  source: TrafficSourceId;
  visits: number;
  uniqueVisitors: number;
  leads: number;
};

export type AnalyticsDeviceBreakdown = {
  devices: Array<{ device: DeviceType; count: number }>;
  browsers: Array<{ browser: BrowserId; count: number }>;
  countries: Array<{ country: string; count: number }>;
};

export type AnalyticsRecentVisit = {
  id: string;
  time: string;
  pagePath: string;
  source: TrafficSourceId;
  device: DeviceType;
  browser: string;
  country: string;
  converted: boolean;
};
