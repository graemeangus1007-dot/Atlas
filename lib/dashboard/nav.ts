/**
 * Dashboard product navigation — Phase 1 simplification.
 * Primary rail: Projects · Leads · Analytics
 * Account (Billing / Profile) lives in the top-bar account menu.
 */

export type DashboardNavLink = {
  href: string;
  label: string;
  icon: string;
};

/** @deprecated AI Website removed from product nav (Phase 1). */
export const AI_WEBSITE_NAV_HREF = "/dashboard/ai" as const;
/** @deprecated */
export const AI_WEBSITE_NAV_LABEL = "AI Website" as const;

/**
 * Main dashboard sidebar links — keep short and task-focused.
 */
const BASE_DASHBOARD_NAV_LINKS: readonly DashboardNavLink[] = [
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
];

export const DASHBOARD_NAV_LINKS: readonly DashboardNavLink[] =
  BASE_DASHBOARD_NAV_LINKS;

/** @deprecated Prefer DASHBOARD_NAV_LINKS — kept for existing imports. */
export const SIDEBAR_LINKS = DASHBOARD_NAV_LINKS;

/** Account menu destinations (not primary sidebar). */
export const ACCOUNT_MENU_LINKS: readonly DashboardNavLink[] = [
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

/**
 * Final links passed to the sidebar renderer.
 */
export function getDashboardNavLinks(): DashboardNavLink[] {
  return BASE_DASHBOARD_NAV_LINKS.map((link) => ({ ...link }));
}

/** Labels in render order — used by sidebar diagnostics + tests. */
export function getDashboardNavLabels(): string[] {
  return getDashboardNavLinks().map((link) => link.label);
}

/**
 * Active state for sidebar links.
 */
export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/projects") {
    return (
      pathname === "/projects" ||
      pathname.startsWith("/projects/") ||
      pathname === "/dashboard" ||
      pathname === "/dashboard/"
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * HTML snapshot of the sidebar link list (unit regression without a DOM lib).
 */
export function renderDashboardNavHtml(pathname = "/projects"): string {
  return getDashboardNavLinks()
    .map((link) => {
      const active = isDashboardNavActive(pathname, link.href);
      const current = active ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${current}><span>${link.icon}</span><span>${link.label}</span></a>`;
    })
    .join("\n");
}
