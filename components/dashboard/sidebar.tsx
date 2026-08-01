"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProject } from "@/context/project-context";
import {
  getDashboardNavLinks,
  isDashboardNavActive,
} from "@/lib/dashboard/nav";

type DashboardSidebarProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Left navigation for the product shell.
 * Desktop: fixed rail. Mobile: slide-over drawer.
 * Phase 1: Projects · Leads · Analytics only.
 */
export default function DashboardSidebar({
  open,
  onClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { projectId } = useProject();
  const [unreadCount, setUnreadCount] = useState(0);

  const links = useMemo(() => getDashboardNavLinks(), []);

  const loadUnread = useCallback(async () => {
    if (!projectId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch(
        `/api/leads/unread-count?projectId=${encodeURIComponent(projectId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { unreadCount?: number };
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Badge is best-effort.
    }
  }, [projectId]);

  useEffect(() => {
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadUnread]);

  useEffect(() => {
    if (pathname.startsWith("/leads")) void loadUnread();
  }, [pathname, loadUnread]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:h-full lg:max-h-none lg:translate-x-0 lg:bg-surface/60 ${
          open ? "translate-x-0" : "max-lg:-translate-x-full"
        }`}
        aria-label="Dashboard"
        data-testid="dashboard-sidebar"
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Link
            href="/"
            className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={onClose}
          >
            Atlas
          </Link>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
          data-testid="dashboard-sidebar-nav"
          aria-label="Dashboard pages"
        >
          <ul className="space-y-1">
            {links.map((link) => {
              const active = isDashboardNavActive(pathname, link.href);
              const showBadge = link.href === "/leads" && unreadCount > 0;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    data-nav={link.href}
                    className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft font-medium text-foreground"
                        : "text-muted hover:bg-white/[0.03] hover:text-foreground"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden="true" className="shrink-0">
                      {link.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    {showBadge ? (
                      <span
                        className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-background"
                        aria-label={`${unreadCount} unread leads`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
