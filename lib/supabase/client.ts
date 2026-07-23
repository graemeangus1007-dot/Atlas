import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseEnv,
  type Database,
  type SupabasePublicEnv,
} from "@/lib/supabase/types";

/**
 * Validate and return Supabase public env vars.
 * Throws a clear error if either value is missing.
 */
export function requireSupabaseEnv(): SupabasePublicEnv {
  try {
    return getSupabaseEnv();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Supabase environment variables are not configured.";
    throw new Error(message);
  }
}

/**
 * Browser Supabase client for Client Components and hooks.
 *
 * Uses `@supabase/ssr` (built on `@supabase/supabase-js`) so sessions stay
 * compatible with Next.js middleware cookies. Env vars are validated first.
 */
export function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}

/**
 * Plain `@supabase/supabase-js` client — useful for connectivity checks
 * that do not need cookie-based session sync.
 */
export function createSupabaseClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createSupabaseJsClient<Database>(url, publishableKey);
}
