import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: "Projects — Atlas",
  description: "Manage your Atlas website projects.",
};

export default function ProjectsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardShell>{children}</DashboardShell>;
}
