import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: "Leads — Atlas",
  description: "View and manage contact form submissions.",
};

export default function LeadsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardShell>{children}</DashboardShell>;
}
