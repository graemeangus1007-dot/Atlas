/**
 * Public (client-safe) environment helpers.
 * Only reads NEXT_PUBLIC_* variables.
 */

import type { PublicEnv } from "@/lib/env/types";

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Read public Supabase + optional app URL (safe for browser). */
export function getPublicEnv(
  source: NodeJS.ProcessEnv = process.env,
): PublicEnv | null {
  const supabaseUrl = trim(source.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey =
    trim(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    trim(source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !supabasePublishableKey) return null;

  const appUrlRaw = trim(source.NEXT_PUBLIC_APP_URL);
  return {
    supabaseUrl,
    supabasePublishableKey,
    appUrl: appUrlRaw || null,
    stripePublishableKey:
      trim(source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) || null,
  };
}

export function isPublicEnvConfigured(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return getPublicEnv(source) != null;
}
