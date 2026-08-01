"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

/**
 * /dashboard — redirects to Projects (Phase 1 single home).
 */
export default function DashboardHome() {
  const router = useRouter();
  const { isConfigured } = useAuth();

  useEffect(() => {
    router.replace("/projects");
  }, [router]);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-muted">Opening Projects…</p>
        {!isConfigured ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Supabase is not configured. Copy{" "}
            <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code>, add your project URL
            and publishable key, then run the SQL in{" "}
            <code className="font-mono">supabase/migrations/</code>.
          </div>
        ) : null}
      </div>
    </main>
  );
}
