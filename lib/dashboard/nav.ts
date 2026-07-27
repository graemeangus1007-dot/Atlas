/**
 * Dashboard product navigation — single source for sidebar (desktop + mobile).
 * No plan/role filters: any authenticated user who can open the shell sees these links.
 */

export type DashboardNavLink = {
  href: string;
  label: string;
  icon: string;
};

export const AI_WEBSITE_NAV_HREF = "/dashboard/ai" as const;
export const AI_WEBSITE_NAV_LABEL = "AI Website" as const;

const AI_WEBSITE_LINK: DashboardNavLink = {
  href: AI_WEBSITE_NAV_HREF,
  label: AI_WEBSITE_NAV_LABEL,
  icon: "✨",
};

/**
 * Main dashboard sidebar links.
 * AI Website is intentionally early (after Dashboard) so it stays above the fold.
 */
const BASE_DASHBOARD_NAV_LINKS: readonly DashboardNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  AI_WEBSITE_LINK,
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "📬" },
  { href: "/editor", label: "Editor", icon: "✏️" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/system", label: "System", icon: "🩺" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export const DASHBOARD_NAV_LINKS: readonly DashboardNavLink[] =
  BASE_DASHBOARD_NAV_LINKS;

/** @deprecated Prefer DASHBOARD_NAV_LINKS — kept for existing imports. */
export const SIDEBAR_LINKS = DASHBOARD_NAV_LINKS;

/**
 * Final links passed to the sidebar renderer.
 * Guarantees AI Website is present even if the base list is ever edited incorrectly.
 */
export function getDashboardNavLinks(): DashboardNavLink[] {
  const links = BASE_DASHBOARD_NAV_LINKS.map((link) => ({ ...link }));
  const aiIndex = links.findIndex((link) => link.href === AI_WEBSITE_NAV_HREF);
  if (aiIndex === -1) {
    links.splice(1, 0, { ...AI_WEBSITE_LINK });
  } else {
    // Normalize label/href so callers cannot drift.
    links[aiIndex] = { ...AI_WEBSITE_LINK };
  }
  return links;
}

/** Labels in render order — used by sidebar diagnostics + tests. */
export function getDashboardNavLabels(): string[] {
  return getDashboardNavLinks().map((link) => link.label);
}

/**
 * Active state for sidebar links.
 * `/dashboard` is exact-only so nested routes do not keep highlighting Dashboard.
 */
export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * HTML snapshot of the sidebar link list (unit regression without a DOM lib).
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
