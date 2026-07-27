import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_NAV_LINKS,
  getDashboardNavLinks,
  isDashboardNavActive,
  renderDashboardNavHtml,
} from "@/lib/dashboard/nav";

describe("dashboard navigation", () => {
  it("includes AI Website at /dashboard/ai for all authenticated shell users", () => {
    const links = getDashboardNavLinks();
    const ai = links.find((link) => link.href === "/dashboard/ai");
    expect(ai).toEqual({
      href: "/dashboard/ai",
      label: "AI Website",
      icon: "✨",
    });
    expect(DASHBOARD_NAV_LINKS.some((l) => l.href === "/dashboard/ai")).toBe(
      true,
    );
  });

  it("renders AI Website in the navigation HTML snapshot", () => {
    const html = renderDashboardNavHtml("/projects");
    expect(html).toContain('href="/dashboard/ai"');
    expect(html).toContain("AI Website");
    expect(html).toContain("✨");
  });

  it("does not keep Dashboard active on nested /dashboard/* routes", () => {
    expect(isDashboardNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isDashboardNavActive("/dashboard/ai", "/dashboard")).toBe(false);
    expect(isDashboardNavActive("/dashboard/ai", "/dashboard/ai")).toBe(true);
    expect(isDashboardNavActive("/dashboard/analytics", "/dashboard")).toBe(
      false,
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
    expect(src).not.toMatch(/links\.filter|DASHBOARD_NAV_LINKS\.filter/);
    expect(src).not.toMatch(/\bentitlement\b|\bfeatureFlags\b|\bcanCreate\b/);
    expect(src).toContain("lg:static");
    expect(src).toContain("lg:hidden");
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
