import { logAnalytics } from "@/lib/analytics/log";
import type { SiteVisitRow } from "@/lib/analytics/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadAttrRow = {
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

export async function loadAnalyticsDataset(
  supabase: SupabaseClient,
  input: { projectId: string; ownerId: string; days?: number },
): Promise<{ visits: SiteVisitRow[]; leads: LeadAttrRow[] }> {
  const days = input.days ?? 180;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [visitsRes, leadsRes] = await Promise.all([
    supabase
      .from("site_visits")
      .select("*")
      .eq("project_id", input.projectId)
      .eq("owner_id", input.ownerId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("lead_submissions")
      .select(
        "id, created_at, landing_page, referrer, utm_source, utm_medium, utm_campaign, session_id, visitor_id",
      )
      .eq("project_id", input.projectId)
      .eq("owner_id", input.ownerId)
      .gte("created_at", since.toISOString())
      .limit(5000),
  ]);

  if (visitsRes.error) {
    logAnalytics("dashboard_query", {
      projectId: input.projectId,
      ownerIdTail: input.ownerId.slice(-8),
      ok: false,
      error: visitsRes.error.message?.slice(0, 160) || "visits_query_failed",
    });
    throw new Error(
      visitsRes.error.message?.includes("site_visits")
        ? "Analytics tables missing. Apply supabase/migrations/20260801_analytics.sql."
        : "Could not load site visits.",
    );
  }

  if (leadsRes.error) {
    logAnalytics("dashboard_query", {
      projectId: input.projectId,
      ok: false,
      error: leadsRes.error.message?.slice(0, 160) || "leads_query_failed",
    });
    // Attribution columns may be missing if only partial migration applied.
    throw new Error("Could not load lead attribution data.");
  }

  const visits = (visitsRes.data || []) as SiteVisitRow[];
  const leads = (leadsRes.data || []) as LeadAttrRow[];

  logAnalytics("dashboard_query", {
    projectId: input.projectId,
    ownerIdTail: input.ownerId.slice(-8),
    ok: true,
    visitCount: visits.length,
    leadCount: leads.length,
  });

  return { visits, leads };
}
