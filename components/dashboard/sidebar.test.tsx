/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardSidebar from "@/components/dashboard/sidebar";
import {
  AI_WEBSITE_NAV_HREF,
  AI_WEBSITE_NAV_LABEL,
  getDashboardNavLinks,
} from "@/lib/dashboard/nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/project-context", () => ({
  useProject: () => ({
    projectId: null,
    project: null,
    projects: [],
  }),
}));

afterEach(() => {
  cleanup();
});

describe("DashboardSidebar (real component)", () => {
  it("renders AI Website link with href=/dashboard/ai and visible label", () => {
    render(<DashboardSidebar open onClose={() => undefined} />);

    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toBeTruthy();

    const link = screen.getByTestId("sidebar-link-ai-website");
    expect(link.getAttribute("href")).toBe(AI_WEBSITE_NAV_HREF);
    expect(link.getAttribute("href")).toBe("/dashboard/ai");
    expect(link.textContent).toContain(AI_WEBSITE_NAV_LABEL);
    expect(link.textContent).toContain("AI Website");

    // Visible in the nav list (not filtered out of the final render array).
    const nav = screen.getByTestId("dashboard-sidebar-nav");
    expect(within(nav).getByRole("link", { name: /AI Website/i })).toBeTruthy();

    const labels = getDashboardNavLinks().map((l) => l.label);
    expect(labels).toContain("AI Website");
  });

  it("renders every nav link from getDashboardNavLinks into the DOM", () => {
    render(<DashboardSidebar open onClose={() => undefined} />);
    const nav = screen.getByTestId("dashboard-sidebar-nav");

    for (const link of getDashboardNavLinks()) {
      const el = within(nav).getByRole("link", {
        name: new RegExp(link.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      });
      expect(el.getAttribute("href")).toBe(link.href);
    }
  });
});
