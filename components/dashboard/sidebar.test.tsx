/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardSidebar from "@/components/dashboard/sidebar";
import { getDashboardNavLinks } from "@/lib/dashboard/nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
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

describe("DashboardSidebar (Phase 1)", () => {
  it("does not render AI Website or System", () => {
    render(<DashboardSidebar open onClose={() => undefined} />);
    const nav = screen.getByTestId("dashboard-sidebar-nav");
    expect(within(nav).queryByRole("link", { name: /AI Website/i })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /System/i })).toBeNull();
    expect(screen.queryByTestId("sidebar-link-ai-website")).toBeNull();
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
