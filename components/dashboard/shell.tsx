"use client";

import { useState, type ReactNode } from "react";
import DashboardSidebar from "@/components/dashboard/sidebar";
import DashboardTopNav from "@/components/dashboard/top-nav";

type DashboardShellProps = {
  children: ReactNode;
};

/**
 * Product chrome: sidebar + top nav wrapping page content.
 */
export default function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopNav onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
