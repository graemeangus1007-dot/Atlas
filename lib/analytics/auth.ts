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
): Promise<AnalyticsOwnerContext | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const rate = checkDomainRateLimit(`analytics:read:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return {
      error: Response.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      ),
    };
  }

  if (!projectId) {
    return {
      error: Response.json({ error: "projectId is required." }, { status: 400 }),
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
      error: Response.json({ error: "Project not found." }, { status: 404 }),
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
