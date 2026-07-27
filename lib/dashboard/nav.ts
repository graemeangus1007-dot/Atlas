/**
 * Dashboard product navigation — single source for sidebar (desktop + mobile).
 * No plan/role filters: any authenticated user who can open the shell sees these links.
 */

export type DashboardNavLink = {
  href: string;
  label: string;
  icon: string;
};

/**
 * Main dashboard sidebar links (Sprint 20.0B+).
 * Keep AI Website here so desktop rail and mobile drawer stay in sync.
 */
export const DASHBOARD_NAV_LINKS: readonly DashboardNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/dashboard/ai", label: "AI Website", icon: "✨" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/editor", label: "Editor", icon: "✏️" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/system", label: "System", icon: "🩺" },
  { href: "/profile", label: "Profile", icon: "👤" },
] as const;

/** @deprecated Prefer DASHBOARD_NAV_LINKS — kept for existing imports. */
export const SIDEBAR_LINKS = DASHBOARD_NAV_LINKS;

/** Snapshot of links for rendering (never filtered by plan/role). */
export function getDashboardNavLinks(): DashboardNavLink[] {
  return DASHBOARD_NAV_LINKS.map((link) => ({ ...link }));
}

/**
 * Active state for sidebar links.
 * `/dashboard` is exact-only so nested routes (AI, analytics, billing)
 * do not keep highlighting the parent Dashboard item.
 */
export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * HTML snapshot of the sidebar link list (regression tests without a DOM lib).
 * Mirrors the href/label contract rendered by DashboardSidebar.
 */
export function renderDashboardNavHtml(pathname = "/dashboard"): string {
  return getDashboardNavLinks()
    .map((link) => {
      const active = isDashboardNavActive(pathname, link.href);
      const current = active ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${current}><span>${link.icon}</span><span>${link.label}</span></a>`;
    })
    .join("\n");
}
