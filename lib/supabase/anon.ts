import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { getSupabaseEnv, type Database } from "@/lib/supabase/types";

/**
 * Anonymous Supabase client for public form submissions (no cookies/session).
 * Inserts rely on RLS "Public can insert submissions to enabled forms".
 */
export function createAnonClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createSupabaseJsClient<Database>(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
