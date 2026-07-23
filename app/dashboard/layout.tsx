import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: "Dashboard — Atlas",
  description: "Manage your Atlas website, pages, branding, and AI suggestions.",
};

/**
 * Dashboard route group layout — shared product chrome for all /dashboard pages.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardShell>{children}</DashboardShell>;
}
