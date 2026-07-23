"use client";

/**
 * AuthProvider — Sprint 14.2B session management.
 *
 * Detects auth state via Supabase `getSession` + `onAuthStateChange`,
 * so sessions persist across browser refreshes (cookie storage via @supabase/ssr).
 */
export {
  SessionProvider as AuthProvider,
  SessionProvider,
  useAuth,
  useSession,
  type AuthContextValue,
} from "@/lib/auth/session-provider";
