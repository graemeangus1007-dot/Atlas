"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getBusinessInitials } from "@/lib/project";

type DashboardTopNavProps = {
  onMenuClick: () => void;
};

/**
 * Top bar — shows the logged-in user's email and account menu.
 */
export default function DashboardTopNav({ onMenuClick }: DashboardTopNavProps) {
  const router = useRouter();
  const { user, signOutUser, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? "";
  const initials = getBusinessInitials(email || "AT");

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-white/[0.03] lg:hidden"
        aria-label="Open sidebar"
      >
        <span className="flex flex-col gap-1.5" aria-hidden="true">
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
          <span className="block h-0.5 w-4 bg-current" />
        </span>
      </button>

      <div className="min-w-0 flex-1 lg:flex-none">
        <p className="truncate text-sm text-muted">Signed in as</p>
        <p
          className="truncate font-medium text-foreground"
          title={email || undefined}
        >
          {isLoading ? "Loading…" : email || "—"}
        </p>
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Search</span>
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            type="search"
            placeholder="Search pages, media, settings..."
            className="w-full rounded-xl border border-border bg-surface/80 py-2.5 pl-9 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>

      <div className="relative ml-auto flex items-center gap-2 sm:gap-3">
        <p className="hidden max-w-[14rem] truncate text-sm text-muted sm:block">
          {email}
        </p>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-accent-soft text-sm font-semibold text-accent transition-colors hover:border-accent/50"
          aria-label={`Account menu for ${email || "user"}`}
          aria-expanded={menuOpen}
        >
          {initials}
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
            <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start px-3 py-2 text-sm"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "Logging out…" : "Logout"}
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
