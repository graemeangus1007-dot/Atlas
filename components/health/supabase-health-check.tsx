"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type HealthState =
  | { status: "checking" }
  | { status: "ok" }
  | { status: "error"; reason: string };

/**
 * Client-side Supabase connectivity check via the official client.
 * A successful getSession() response (even with no signed-in user) means connected.
 */
export default function SupabaseHealthCheck() {
  const [state, setState] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!cancelled) setState({ status: "ok" });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          reason:
            error instanceof Error
              ? error.message
              : "Unknown connection error.",
        });
      }
    }

    void runCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface/60 p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Atlas · Sprint 14.1
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Supabase Health
        </h1>

        <div className="mt-8" role="status" aria-live="polite">
          {state.status === "checking" ? (
            <p className="text-sm text-muted">Checking connection…</p>
          ) : null}

          {state.status === "ok" ? (
            <p className="text-lg font-semibold text-foreground">
              ✅ Connected to Supabase
            </p>
          ) : null}

          {state.status === "error" ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-foreground">
                ❌ Connection Failed
              </p>
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-300">
                {state.reason}
              </p>
            </div>
          ) : null}
        </div>

        <Link
          href="/"
          className="mt-8 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
