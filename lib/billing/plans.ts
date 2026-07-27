/**
 * Atlas subscription plan catalog (Sprint 19.0B).
 *
 * Single source of truth for plan id, display name, monthly list price,
 * Stripe Price env keys, limits, feature flags, and marketing copy.
 *
 * Do not hard-code prices or limits elsewhere — import from here.
 *
 * Future-ready (no schema change required):
 * - annual billing via `stripeAnnualPriceEnvKey` / `billing.interval`
 * - promotional / grandfathered list prices via optional billing fields
 * - coupons & trials via Checkout (Stripe) + optional `billing.trialDays`
 */

export type AtlasPlanId = "starter" | "professional" | "agency";

export type PlanFeatureFlags = {
  maxProjects: number | null;
  maxDomains: number | null;
  customDomains: boolean;
  leadInbox: boolean;
  emailNotifications: boolean;
  advancedAnalytics: boolean;
  basicAnalytics: boolean;
  basicSeo: boolean;
  seoTools: boolean;
  versionHistory: boolean;
  removeBranding: boolean;
  teamMembers: boolean;
  whiteLabel: boolean;
  /** Reserved for future AI usage */
  aiCredits: boolean;
  unlimitedPublishing: boolean;
  prioritySupport: boolean;
  communitySupport: boolean;
};

/** Optional commercial metadata — extend without DB migrations. */
export type PlanBillingOptions = {
  /** Default catalog interval. */
  interval: "month" | "year";
  /** When set, Checkout may start a trial (Stripe Subscription trial_period_days). */
  trialDays?: number;
  /**
   * Optional promotional list price in USD cents (display only).
   * Actual charge always follows the Stripe Price id.
   */
  promotionalPriceUsdCents?: number | null;
  /** Mark a catalog entry as grandfathered for display/legacy mapping. */
  grandfathered?: boolean;
};

export type PlanConfig = {
  id: AtlasPlanId;
  displayName: string;
  /** Marketing description for billing UI. */
  description: string;
  /** Monthly list price in USD cents (UI only — never duplicate elsewhere). */
  monthlyPriceUsdCents: number;
  /**
   * Process env key that holds the Stripe Price id for monthly billing.
   * Resolved at runtime via {@link resolveStripePriceId}.
   */
  stripePriceEnvKey: string;
  /** Optional annual Stripe Price env key (future). */
  stripeAnnualPriceEnvKey?: string;
  websiteLimit: number | null;
  domainLimit: number | null;
  features: PlanFeatureFlags;
  highlights: string[];
  billing: PlanBillingOptions;
};

/**
 * Entitlements when the owner has no active/trialing/past_due subscription.
 * Not a sellable plan — used for gating until Checkout completes.
 */
export const LOCKED_FEATURES: PlanFeatureFlags = {
  maxProjects: 0,
  maxDomains: 0,
  customDomains: false,
  leadInbox: false,
  emailNotifications: false,
  advancedAnalytics: false,
  basicAnalytics: false,
  basicSeo: false,
  seoTools: false,
  versionHistory: false,
  removeBranding: false,
  teamMembers: false,
  whiteLabel: false,
  aiCredits: false,
  unlimitedPublishing: false,
  prioritySupport: false,
  communitySupport: false,
};

/** Canonical plan catalog — the only place list prices are defined. */
export const PLAN_CONFIG: Record<AtlasPlanId, PlanConfig> = {
  starter: {
    id: "starter",
    displayName: "Starter",
    description:
      "One polished website with Atlas branding, basic analytics, and basic SEO.",
    monthlyPriceUsdCents: 4900,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    stripeAnnualPriceEnvKey: "STRIPE_PRICE_STARTER_ANNUAL",
    websiteLimit: 1,
    domainLimit: 0,
    features: {
      maxProjects: 1,
      maxDomains: 0,
      customDomains: false,
      leadInbox: false,
      emailNotifications: false,
      advancedAnalytics: false,
      basicAnalytics: true,
      basicSeo: true,
      seoTools: false,
      versionHistory: false,
      removeBranding: false,
      teamMembers: false,
      whiteLabel: false,
      aiCredits: false,
      unlimitedPublishing: false,
      prioritySupport: false,
      communitySupport: true,
    },
    highlights: [
      "1 website",
      "Atlas branding",
      "Basic analytics",
      "Basic SEO",
      "Community support",
    ],
    billing: { interval: "month" },
  },
  professional: {
    id: "professional",
    displayName: "Professional",
    description:
      "Scale to 10 sites with custom domains, leads, SEO tools, and no Atlas branding.",
    monthlyPriceUsdCents: 14900,
    stripePriceEnvKey: "STRIPE_PRICE_PROFESSIONAL",
    stripeAnnualPriceEnvKey: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
    websiteLimit: 10,
    domainLimit: 10,
    features: {
      maxProjects: 10,
      maxDomains: 10,
      customDomains: true,
      leadInbox: true,
      emailNotifications: true,
      advancedAnalytics: true,
      basicAnalytics: true,
      basicSeo: true,
      seoTools: true,
      versionHistory: true,
      removeBranding: true,
      teamMembers: false,
      whiteLabel: false,
      aiCredits: false,
      unlimitedPublishing: true,
      prioritySupport: true,
      communitySupport: false,
    },
    highlights: [
      "Up to 10 websites",
      "Unlimited publishing",
      "Custom domains",
      "Advanced analytics",
      "Lead inbox",
      "Email notifications",
      "SEO tools",
      "Version history",
      "Remove Atlas branding",
      "Priority support",
    ],
    billing: { interval: "month" },
  },
  agency: {
    id: "agency",
    displayName: "Agency",
    description:
      "Unlimited sites and domains for agencies, with white label and team seats (Sprint 20).",
    monthlyPriceUsdCents: 39900,
    stripePriceEnvKey: "STRIPE_PRICE_AGENCY",
    stripeAnnualPriceEnvKey: "STRIPE_PRICE_AGENCY_ANNUAL",
    websiteLimit: null,
    domainLimit: null,
    features: {
      maxProjects: null,
      maxDomains: null,
      customDomains: true,
      leadInbox: true,
      emailNotifications: true,
      advancedAnalytics: true,
      basicAnalytics: true,
      basicSeo: true,
      seoTools: true,
      versionHistory: true,
      removeBranding: true,
      teamMembers: true,
      whiteLabel: true,
      aiCredits: true,
      unlimitedPublishing: true,
      prioritySupport: true,
      communitySupport: false,
    },
    highlights: [
      "Unlimited websites",
      "Unlimited custom domains",
      "Team members (Sprint 20)",
      "White label",
      "Future AI credits",
      "Highest usage limits",
      "Priority support",
    ],
    billing: { interval: "month" },
  },
};

/** Ordered catalog for billing UI. */
export const PLAN_CATALOG: PlanConfig[] = [
  PLAN_CONFIG.starter,
  PLAN_CONFIG.professional,
  PLAN_CONFIG.agency,
];

/** @deprecated Use PLAN_CONFIG — kept as alias for gradual imports. */
export const PLANS = PLAN_CONFIG;

export function isAtlasPlanId(value: unknown): value is AtlasPlanId {
  return value === "starter" || value === "professional" || value === "agency";
}

export function getPlanConfig(plan: AtlasPlanId): PlanConfig {
  return PLAN_CONFIG[plan];
}

export function planRank(plan: AtlasPlanId): number {
  return PLAN_CATALOG.findIndex((p) => p.id === plan);
}

export function featureFlagsForPlan(plan: AtlasPlanId): PlanFeatureFlags {
  const config = PLAN_CONFIG[plan];
  return {
    ...config.features,
    maxProjects: config.websiteLimit,
    maxDomains: config.domainLimit,
  };
}

/** Display dollars from the catalog (never hard-code amounts at call sites). */
export function planMonthlyPriceUsd(plan: AtlasPlanId): number {
  return PLAN_CONFIG[plan].monthlyPriceUsdCents / 100;
}

/** Format catalog monthly price for UI. */
export function formatPlanMonthlyPrice(plan: AtlasPlanId): string {
  const dollars = planMonthlyPriceUsd(plan);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

/**
 * Resolve the Stripe Price id for a plan from env (never hard-coded).
 * @param interval — monthly by default; annual uses optional env key when present.
 */
export function resolveStripePriceId(
  plan: AtlasPlanId,
  interval: "month" | "year" = "month",
  env: NodeJS.ProcessEnv = process.env,
): string {
  const config = PLAN_CONFIG[plan];
  const envKey =
    interval === "year" && config.stripeAnnualPriceEnvKey
      ? config.stripeAnnualPriceEnvKey
      : config.stripePriceEnvKey;
  const value = env[envKey]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${envKey}. Add the Stripe Price id to the server environment.`,
    );
  }
  return value;
}

/** Map a Stripe Price id back to an Atlas plan using env-configured ids. */
export function planFromStripePriceId(
  priceId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): AtlasPlanId | null {
  if (!priceId) return null;
  for (const plan of PLAN_CATALOG) {
    const monthly = env[plan.stripePriceEnvKey]?.trim();
    if (monthly && monthly === priceId) return plan.id;
    if (plan.stripeAnnualPriceEnvKey) {
      const annual = env[plan.stripeAnnualPriceEnvKey]?.trim();
      if (annual && annual === priceId) return plan.id;
    }
  }
  return null;
}

/** Default plan id written for new users before Checkout (not entitled until paid). */
export const DEFAULT_PLAN_ID: AtlasPlanId = "starter";

/** JSON feature_flags blob for DB bootstrap rows. */
export function featureFlagsJsonForPlan(
  plan: AtlasPlanId,
): Record<string, unknown> {
  return { ...featureFlagsForPlan(plan) };
}
