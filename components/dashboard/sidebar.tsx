"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/context/project-context";
import { SIDEBAR_LINKS } from "@/data/dashboard";

type DashboardSidebarProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Left navigation for the product shell.
 * Desktop: fixed rail. Mobile: slide-over drawer.
 */
export default function DashboardSidebar({
  open,
  onClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { projectId } = useProject();
  const [unreadCount, setUnreadCount] = useState(0);

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:bg-surface/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Dashboard"
      >
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link
            href="/"
            className="rounded-md font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={onClose}
          >
            Atlas
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {SIDEBAR_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);
              const showBadge = link.href === "/leads" && unreadCount > 0;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft font-medium text-foreground"
                        : "text-muted hover:bg-white/[0.03] hover:text-foreground"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span aria-hidden="true">{link.icon}</span>
                    <span className="flex-1">{link.label}</span>
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
