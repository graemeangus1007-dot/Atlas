"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

/**
 * /profile — account details and logout.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user, signOutUser, isLoading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Profile
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
            Your Atlas account details.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-surface/60 p-6">
          {isLoading ? (
            <p className="text-sm text-muted">Loading account…</p>
          ) : (
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {user?.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  Email verified
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {user?.email_confirmed_at ? "Yes" : "Not yet"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                  User ID
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-muted">
                  {user?.id || "—"}
                </dd>
              </div>
            </dl>
          )}

          <Button
            type="button"
            variant="secondary"
            className="mt-6 w-full"
            disabled={signingOut}
            onClick={() => void handleLogout()}
          >
            {signingOut ? "Logging out…" : "Logout"}
          </Button>
        </section>
      </div>
    </main>
  );
}
