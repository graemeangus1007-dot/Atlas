import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MENU_LINKS,
  DASHBOARD_NAV_LINKS,
  getDashboardNavLabels,
  getDashboardNavLinks,
  isDashboardNavActive,
  renderDashboardNavHtml,
} from "@/lib/dashboard/nav";

describe("dashboard navigation (Phase 1)", () => {
  it("exposes only Projects, Leads, and Analytics in the primary rail", () => {
    const labels = getDashboardNavLabels();
    expect(labels).toEqual(["Projects", "Leads", "Analytics"]);
    expect(DASHBOARD_NAV_LINKS.map((l) => l.href)).toEqual([
      "/projects",
      "/leads",
      "/dashboard/analytics",
    ]);
    expect(labels).not.toContain("AI Website");
    expect(labels).not.toContain("System");
    expect(labels).not.toContain("Editor");
    expect(labels).not.toContain("Billing");
    expect(labels).not.toContain("Profile");
    expect(labels).not.toContain("Dashboard");
  });

  it("keeps Billing and Profile in the account menu, not the rail", () => {
    expect(ACCOUNT_MENU_LINKS.map((l) => l.label)).toEqual([
      "Billing",
      "Profile",
    ]);
    const railHrefs = getDashboardNavLinks().map((l) => l.href);
    expect(railHrefs).not.toContain("/dashboard/billing");
    expect(railHrefs).not.toContain("/profile");
  });

  it("renders the simplified navigation HTML snapshot", () => {
    const html = renderDashboardNavHtml("/projects");
    expect(html).toContain('href="/projects"');
    expect(html).toContain("Projects");
    expect(html).not.toContain("/dashboard/ai");
    expect(html).not.toContain("AI Website");
    expect(html).not.toContain("/dashboard/system");
  });

  it("treats /dashboard as Projects-active for redirects", () => {
    expect(isDashboardNavActive("/projects", "/projects")).toBe(true);
    expect(isDashboardNavActive("/dashboard", "/projects")).toBe(true);
    expect(isDashboardNavActive("/dashboard/analytics", "/projects")).toBe(
      false,
    );
    expect(isDashboardNavActive("/dashboard/analytics", "/dashboard/analytics")).toBe(
      true,
    );
  });

  it("sidebar maps getDashboardNavLinks with no plan/role filter", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/dashboard/sidebar.tsx"),
      "utf8",
    );
    expect(src).toContain("getDashboardNavLinks");
    expect(src).toContain("isDashboardNavActive");
    expect(src).toContain("links.map");
    expect(src).not.toContain("sidebar-link-ai-website");
    expect(src).toContain("max-lg:-translate-x-full");
    expect(src).toContain("overflow-y-auto");
    expect(src).not.toMatch(/links\.filter|DASHBOARD_NAV_LINKS\.filter/);
    expect(src).not.toMatch(/\bentitlement\b|\bfeatureFlags\b|\bcanCreate\b/);
  });

  it("shell uses one sidebar for desktop rail and mobile drawer", () => {
    const shell = readFileSync(
      resolve(__dirname, "../../components/dashboard/shell.tsx"),
      "utf8",
    );
    expect(shell).toContain("DashboardSidebar");
    expect(shell).toContain("onMenuClick");
  });
});
