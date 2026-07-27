import type { Metadata } from "next";
import BillingDashboard from "@/components/billing/billing-dashboard";

export const metadata: Metadata = {
  title: "Billing — Atlas",
  description: "Manage your Atlas subscription, usage, and invoices.",
};

export default function DashboardBillingPage() {
  return <BillingDashboard />;
}
