"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ACCOUNT_MENU_LINKS } from "@/lib/dashboard/nav";
import { getBusinessInitials } from "@/lib/project";

type DashboardTopNavProps = {
  onMenuClick: () => void;
};

/**
 * Top bar — account menu holds Billing / Profile (not primary nav).
 */
export default function DashboardTopNav({ onMenuClick }: DashboardTopNavProps) {
  const router = useRouter();
  const { user, signOutUser, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const email = user?.email ?? "";
  const initials = getBusinessInitials(email || "AT");

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

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

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted">Signed in as</p>
        <p
          className="truncate font-medium text-foreground"
          title={email || undefined}
        >
          {isLoading ? "Loading…" : email || "—"}
        </p>
      </div>

      <div className="relative ml-auto" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-accent-soft text-sm font-semibold text-accent transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={`Account menu for ${email || "user"}`}
          aria-expanded={menuOpen}
          data-testid="account-menu-button"
        >
          {initials}
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
            data-testid="account-menu"
          >
            <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
            {ACCOUNT_MENU_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-background/60"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start px-3 py-2 text-sm"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "Logging out…" : "Sign out"}
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
