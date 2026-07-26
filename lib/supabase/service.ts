import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getSupabaseEnv, type Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client (bypasses RLS).
 * Used only for server-side lead notification delivery after public submit.
 * Requires SUPABASE_SERVICE_ROLE_KEY — never expose via NEXT_PUBLIC_*.
 */
export function getServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key || null;
}

export function createServiceClient() {
  const { url } = getSupabaseEnv();
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for lead email delivery.",
    );
  }
  return createSupabaseJsClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function tryCreateServiceClient() {
  try {
    if (!getServiceRoleKey()) return null;
    return createServiceClient();
  } catch {
    return null;
  }
}
