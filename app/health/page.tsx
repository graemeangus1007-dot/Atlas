import type { Metadata } from "next";
import SupabaseHealthCheck from "@/components/health/supabase-health-check";

export const metadata: Metadata = {
  title: "Supabase Health — Atlas",
  description: "Verify Atlas can connect to Supabase.",
};

/**
 * /health — connectivity check only (no auth, no database writes).
 */
export default function HealthPage() {
  return <SupabaseHealthCheck />;
}
