import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/analytics/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics — Atlas",
  description: "Visitors, traffic sources, conversions, and form performance.",
};

export default function DashboardAnalyticsPage() {
  return <AnalyticsDashboard />;
}
