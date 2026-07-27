import type { Metadata } from "next";
import SystemHealthDashboard from "@/components/system/system-health-dashboard";

export const metadata: Metadata = {
  title: "System health — Atlas",
  description: "Environment and provider health for Atlas production readiness.",
};

export default function DashboardSystemPage() {
  return <SystemHealthDashboard />;
}
