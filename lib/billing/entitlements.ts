import {
  featureFlagsForPlan,
  formatPlanMonthlyPrice,
  getPlanConfig,
  isAtlasPlanId,
  LOCKED_FEATURES,
  planMonthlyPriceUsd,
  type AtlasPlanId,
  type PlanFeatureFlags,
} from "@/lib/billing/plans";
import type {
  BillingSummary,
  BillingUsage,
  PublicSubscription,
  SubscriptionRow,
  SubscriptionStatus,
} from "@/lib/billing/types";

/** Plans that grant paid entitlements (active or still in paid period). */
const ENTITLED_STATUSES = new Set<SubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
]);

export function isEntitledStatus(status: SubscriptionStatus): boolean {
  return ENTITLED_STATUSES.has(status);
}

/**
 * Effective plan for gating.
 * Canceled / unpaid / none → locked (no catalog entitlements until Checkout).
 * cancel_at_period_end still entitled until period end (status remains active).
 */
export function effectivePlan(
  row: SubscriptionRow | null | undefined,
): AtlasPlanId | null {
  if (!row) return null;
  if (!isEntitledStatus(row.status)) return null;
  return isAtlasPlanId(row.plan) ? row.plan : null;
}

export function resolveFeatures(
  row: SubscriptionRow | null | undefined,
): PlanFeatureFlags {
  const plan = effectivePlan(row);
  if (!plan) return { ...LOCKED_FEATURES };
  return featureFlagsForPlan(plan);
}

export function toPublicSubscription(
  row: SubscriptionRow | null | undefined,
): PublicSubscription {
  const plan = effectivePlan(row);
  if (!plan) {
    return {
      plan: null,
      planName: "No plan",
      status: row?.status ?? "none",
      priceMonthlyUsd: 0,
      priceMonthlyLabel: "$0",
      cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
      currentPeriodEnd: row?.current_period_end ?? null,
      currentPeriodStart: row?.current_period_start ?? null,
      features: { ...LOCKED_FEATURES },
      stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    };
  }

  const def = getPlanConfig(plan);
  return {
    plan,
    planName: def.displayName,
    status: row?.status ?? "none",
    priceMonthlyUsd: planMonthlyPriceUsd(plan),
    priceMonthlyLabel: formatPlanMonthlyPrice(plan),
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    currentPeriodEnd: row?.current_period_end ?? null,
    currentPeriodStart: row?.current_period_start ?? null,
    features: featureFlagsForPlan(plan),
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
  };
}

export function evaluateUsage(
  features: PlanFeatureFlags,
  counts: { projectCount: number; domainCount: number },
): BillingUsage & { canCreateProject: boolean; canAddDomain: boolean } {
  const projectLimit = features.maxProjects;
  const domainLimit = features.maxDomains;
  const canCreateProject =
    projectLimit == null || counts.projectCount < projectLimit;
  const canAddDomain =
    features.customDomains &&
    (domainLimit == null || counts.domainCount < domainLimit);

  return {
    projectCount: counts.projectCount,
    projectLimit,
    domainCount: counts.domainCount,
    domainLimit,
    canCreateProject,
    canAddDomain,
  };
}

export function buildBillingSummary(
  row: SubscriptionRow | null | undefined,
  counts: { projectCount: number; domainCount: number },
): BillingSummary {
  const subscription = toPublicSubscription(row);
  const usageEval = evaluateUsage(subscription.features, counts);
  return {
    subscription,
    usage: {
      projectCount: usageEval.projectCount,
      projectLimit: usageEval.projectLimit,
      domainCount: usageEval.domainCount,
      domainLimit: usageEval.domainLimit,
    },
    canCreateProject: usageEval.canCreateProject,
    canAddDomain: usageEval.canAddDomain,
  };
}

export type FeatureGateCode =
  | "plan_limit_projects"
  | "plan_limit_domains"
  | "feature_custom_domains"
  | "feature_lead_inbox"
  | "feature_email_notifications"
  | "feature_advanced_analytics"
  | "feature_basic_analytics"
  | "feature_remove_branding"
  | "feature_team_members";

export function upgradeMessage(code: FeatureGateCode): string {
  switch (code) {
    case "plan_limit_projects":
      return "You've reached your website limit on the current plan. Upgrade to create more sites.";
    case "plan_limit_domains":
      return "You've reached your custom domain limit. Upgrade for more domains.";
    case "feature_custom_domains":
      return "Custom domains are available on Professional and Agency. Upgrade to connect your domain.";
    case "feature_lead_inbox":
      return "Lead inbox is available on Professional and Agency. Upgrade to manage form submissions.";
    case "feature_email_notifications":
      return "Email notifications are available on Professional and Agency.";
    case "feature_advanced_analytics":
      return "Advanced analytics are available on Professional and Agency.";
    case "feature_basic_analytics":
      return "Analytics require an active Atlas subscription. Upgrade to view site traffic.";
    case "feature_remove_branding":
      return "Upgrade to Professional or Agency to remove Atlas branding from published sites.";
    case "feature_team_members":
      return "Team members are available on the Agency plan (coming in Sprint 20).";
  }
}
