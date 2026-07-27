import type { AtlasPlanId, PlanFeatureFlags } from "@/lib/billing/plans";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "none";

export type BillingCustomerRow = {
  owner_id: string;
  stripe_customer_id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  owner_id: string;
  plan: AtlasPlanId;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  feature_flags: PlanFeatureFlags | Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PublicSubscription = {
  /** null when the owner has no entitled subscription. */
  plan: AtlasPlanId | null;
  planName: string;
  status: SubscriptionStatus;
  /** Derived from PLAN_CONFIG — do not hard-code at call sites. */
  priceMonthlyUsd: number;
  priceMonthlyLabel: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  features: PlanFeatureFlags;
  stripeSubscriptionId: string | null;
};

export type BillingUsage = {
  projectCount: number;
  projectLimit: number | null;
  domainCount: number;
  domainLimit: number | null;
};

export type BillingSummary = {
  subscription: PublicSubscription;
  usage: BillingUsage;
  canCreateProject: boolean;
  canAddDomain: boolean;
};

/** All catalog plans are purchasable via Checkout. */
export type CheckoutTargetPlan = AtlasPlanId;
