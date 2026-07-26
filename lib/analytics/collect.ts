import { logAnalytics } from "@/lib/analytics/log";
import type { ValidatedAnalyticsCollect } from "@/lib/analytics/sanitize";
import { randomUUID } from "node:crypto";

export type AnalyticsDbClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

type RpcResult = {
  ok?: boolean;
  error?: string;
  visit_id?: string | null;
  created_visit?: boolean;
  created_page_view?: boolean;
};

/**
 * Prefer SECURITY DEFINER RPC (works with anon). Fall back to direct writes
 * when the RPC is unavailable (migration not applied yet).
 */
export async function recordAnalyticsEvent(
  client: AnalyticsDbClient,
  input: ValidatedAnalyticsCollect & { ownerId: string },
): Promise<{ ok: true; visitId: string } | { ok: false; error: string }> {
  const rpcArgs = {
    p_event: input.event,
    p_project_id: input.projectId,
    p_session_id: input.sessionId,
    p_visitor_id: input.visitorIdHash,
    p_page_path: input.pagePath,
    p_referrer: input.referrer,
    p_utm_source: input.utmSource,
    p_utm_medium: input.utmMedium,
    p_utm_campaign: input.utmCampaign,
    p_device_type: input.deviceType,
    p_browser: input.browser,
    p_operating_system: input.operatingSystem,
    p_screen_size: input.screenSize,
    p_language: input.language,
    p_duration_seconds: input.durationSeconds,
  };

  const { data: rpcData, error: rpcError } = await client.rpc(
    "atlas_record_analytics_event",
    rpcArgs,
  );

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const result = rpcData as RpcResult;
    if (result.ok) {
      logAnalytics("insert_success", {
        event: input.event,
        projectId: input.projectId,
        visitId: result.visit_id ? String(result.visit_id).slice(-8) : null,
        createdVisit: Boolean(result.created_visit),
        createdPageView: Boolean(result.created_page_view),
        via: "rpc",
      });
      return { ok: true, visitId: String(result.visit_id || "") };
    }
    logAnalytics("insert_failed", {
      event: input.event,
      projectId: input.projectId,
      error: result.error || "rpc_rejected",
      via: "rpc",
    });
    return { ok: false, error: result.error || "Could not record visit." };
  }

  // Fallback for environments that have 20260801 but not 20260802 yet.
  logAnalytics("rpc_unavailable_fallback", {
    event: input.event,
    projectId: input.projectId,
    rpcError: rpcError?.message?.slice(0, 120) || "no_data",
  });

  return recordAnalyticsEventDirect(client, input);
}

async function recordAnalyticsEventDirect(
  client: AnalyticsDbClient,
  input: ValidatedAnalyticsCollect & { ownerId: string },
): Promise<{ ok: true; visitId: string } | { ok: false; error: string }> {
  const { data: existing, error: lookupError } = await client
    .from("site_visits")
    .select("id, duration_seconds, bounced")
    .eq("project_id", input.projectId)
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (lookupError) {
    logAnalytics("insert_failed", {
      event: input.event,
      projectId: input.projectId,
      error: "lookup_failed",
      detail: lookupError.message?.slice(0, 120),
      via: "direct",
    });
    return {
      ok: false,
      error:
        "Could not load visit. Apply analytics migrations (20260801 + 20260802).",
    };
  }

  const existingVisit = existing as {
    id: string;
    duration_seconds: number;
    bounced: boolean;
  } | null;

  if (input.event === "pageview") {
    if (!existingVisit) {
      const visitId = randomUUID();
      const { error: visitError } = await client.from("site_visits").insert({
        id: visitId,
        project_id: input.projectId,
        owner_id: input.ownerId,
        session_id: input.sessionId,
        visitor_id: input.visitorIdHash,
        page_path: input.pagePath,
        referrer: input.referrer,
        utm_source: input.utmSource,
        utm_medium: input.utmMedium,
        utm_campaign: input.utmCampaign,
        country: "",
        region: "",
        city: "",
        device_type: input.deviceType,
        browser: input.browser,
        operating_system: input.operatingSystem,
        screen_size: input.screenSize,
        language: input.language,
        duration_seconds: 0,
        bounced: true,
      });

      if (visitError) {
        logAnalytics("insert_failed", {
          event: input.event,
          projectId: input.projectId,
          error: "site_visits_insert",
          detail: visitError.message?.slice(0, 120),
          via: "direct",
        });
        return {
          ok: false,
          error:
            "Could not record visit. Confirm migration 20260801_analytics.sql is applied.",
        };
      }

      const { error: pvError } = await client.from("page_views").insert({
        id: randomUUID(),
        visit_id: visitId,
        project_id: input.projectId,
        page_path: input.pagePath,
      });

      if (pvError) {
        logAnalytics("insert_failed", {
          event: input.event,
          projectId: input.projectId,
          error: "page_views_insert",
          detail: pvError.message?.slice(0, 120),
          via: "direct",
        });
        return { ok: false, error: "Could not record page view." };
      }

      logAnalytics("insert_success", {
        event: input.event,
        projectId: input.projectId,
        createdVisit: true,
        createdPageView: true,
        via: "direct",
      });
      return { ok: true, visitId };
    }

    const { error: pvError } = await client.from("page_views").insert({
      id: randomUUID(),
      visit_id: existingVisit.id,
      project_id: input.projectId,
      page_path: input.pagePath,
    });
    if (pvError) {
      return { ok: false, error: "Could not record page view." };
    }

    await client
      .from("site_visits")
      .update({ bounced: false, page_path: input.pagePath })
      .eq("id", existingVisit.id)
      .eq("project_id", input.projectId);

    logAnalytics("insert_success", {
      event: input.event,
      projectId: input.projectId,
      createdVisit: false,
      createdPageView: true,
      via: "direct",
    });
    return { ok: true, visitId: existingVisit.id };
  }

  // heartbeat / unload — best-effort duration update via direct path
  if (!existingVisit) {
    return { ok: true, visitId: "" };
  }

  const duration = Math.max(
    existingVisit.duration_seconds || 0,
    input.durationSeconds,
  );
  const { count } = await client
    .from("page_views")
    .select("id", { count: "exact", head: true })
    .eq("visit_id", existingVisit.id);
  const pageViewCount =
    typeof count === "number" && count > 0
      ? count
      : existingVisit.bounced === false
        ? 2
        : 1;
  const bounced = !(pageViewCount > 1 || duration >= 15);

  await client
    .from("site_visits")
    .update({ duration_seconds: duration, bounced })
    .eq("id", existingVisit.id)
    .eq("project_id", input.projectId);

  logAnalytics("insert_success", {
    event: input.event,
    projectId: input.projectId,
    via: "direct",
    duration,
    bounced,
  });
  return { ok: true, visitId: existingVisit.id };
}

export async function resolveProjectOwnerId(
  client: AnalyticsDbClient,
  projectId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("project_owner_id", {
    p_project_id: projectId,
  });
  if (!error && typeof data === "string" && data) return data;

  const { data: row } = await client
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();

  return typeof row?.owner_id === "string" ? row.owner_id : null;
}
