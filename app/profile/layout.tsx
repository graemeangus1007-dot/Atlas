import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/shell";

export const metadata: Metadata = {
  title: "Profile — Atlas",
  description: "Your Atlas account profile.",
};

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardShell>{children}</DashboardShell>;
}
