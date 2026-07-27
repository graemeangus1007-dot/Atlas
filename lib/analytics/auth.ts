import {
  apiError,
  badRequest,
  forbidden,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import { upgradeMessage } from "@/lib/billing/entitlements";
import { ownerHasFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type AnalyticsOwnerContext = {
  user: User;
  supabase: SupabaseClient;
  projectId: string;
};

export async function requireAnalyticsOwner(
  projectId: string | null,
  requestId?: string,
): Promise<AnalyticsOwnerContext | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: unauthorized(requestId) };
  }

  const rate = checkDomainRateLimit(`analytics:read:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return {
      error: tooManyRequests(rate.retryAfterSeconds, requestId),
    };
  }

  if (!projectId) {
    return {
      error: badRequest("projectId is required.", requestId),
    };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !project) {
    return {
      error: forbidden(requestId, "Project not found."),
    };
  }

  return {
    user,
    supabase: supabase as unknown as SupabaseClient,
    projectId: project.id as string,
  };
}

export function isAnalyticsOwnerError(
  value: AnalyticsOwnerContext | { error: Response },
): value is { error: Response } {
  return "error" in value;
}

/** Gate advanced analytics endpoints (pages/sources/devices/recent). */
export async function requireAdvancedAnalytics(
  context: AnalyticsOwnerContext,
  requestId?: string,
): Promise<Response | null> {
  const allowed = await ownerHasFeature(
    context.user.id,
    "advancedAnalytics",
    context.supabase as never,
  );
  if (allowed) return null;
  return apiError({
    code: "feature_advanced_analytics",
    message: upgradeMessage("feature_advanced_analytics"),
    status: 402,
    requestId,
  });
}

/** Gate basic analytics (summary) — locked/unpaid users cannot read. */
export async function requireBasicAnalytics(
  context: AnalyticsOwnerContext,
  requestId?: string,
): Promise<Response | null> {
  const allowed = await ownerHasFeature(
    context.user.id,
    "basicAnalytics",
    context.supabase as never,
  );
  if (allowed) return null;
  return apiError({
    code: "feature_basic_analytics",
    message: upgradeMessage("feature_basic_analytics"),
    status: 402,
    requestId,
  });
}
