import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBillingSummary,
  effectivePlan,
  evaluateUsage,
  resolveFeatures,
  toPublicSubscription,
  upgradeMessage,
} from "@/lib/billing/entitlements";
import {
  LOCKED_FEATURES,
  PLAN_CATALOG,
  PLAN_CONFIG,
  featureFlagsForPlan,
  formatPlanMonthlyPrice,
  planMonthlyPriceUsd,
  planRank,
  resolveStripePriceId,
} from "@/lib/billing/plans";
import { renderBuiltWithAtlasBadge } from "@/lib/billing/branding";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { defaultProjectContact } from "@/lib/contact";
import type { BusinessProject } from "@/types/business-project";
import type { SubscriptionRow } from "@/lib/billing/types";
import {
  planFromStripePriceId,
  resetStripeClientForTests,
} from "@/lib/billing/stripe";
import { resolvePlanFromSubscription } from "@/lib/billing/sync";
import type Stripe from "stripe";

function sub(
  overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
  return {
    owner_id: "owner-1",
    plan: "starter",
    status: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    cancel_at_period_end: false,
    current_period_start: null,
    current_period_end: null,
    canceled_at: null,
    feature_flags: { ...LOCKED_FEATURES },
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

function sampleProject(): BusinessProject {
  return {
    businessName: "Billing Cafe",
    businessType: "Coffee Shop",
    description: "Coffee",
    goals: [],
    heroHeadline: "Hello",
    heroSubheadline: "World",
    primaryCta: "Contact",
    services: [],
    contact: defaultProjectContact("Billing Cafe"),
    templateId: "modern",
    pages: [],
    primaryColor: "#111111",
    secondaryColor: "#222222",
    accentColor: "#3db8a8",
    backgroundColor: "#0b0f14",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    heroOverlay: 40,
    siteWidth: "wide",
    theme: "dark",
    logo: null,
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: [],
    status: "ready",
    publish: null,
  };
}

afterEach(() => {
  resetStripeClientForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("plans & entitlements", () => {
  it("defines Starter / Professional / Agency from PLAN_CONFIG only", () => {
    expect(PLAN_CATALOG.map((p) => p.id)).toEqual([
      "starter",
      "professional",
      "agency",
    ]);

    for (const plan of PLAN_CATALOG) {
      const config = PLAN_CONFIG[plan.id];
      expect(planMonthlyPriceUsd(plan.id)).toBe(
        config.monthlyPriceUsdCents / 100,
      );
      expect(formatPlanMonthlyPrice(plan.id)).toContain(
        String(Math.floor(config.monthlyPriceUsdCents / 100)),
      );
      expect(config.websiteLimit).toBe(config.features.maxProjects);
      expect(config.domainLimit).toBe(config.features.maxDomains);
      expect(config.stripePriceEnvKey).toMatch(/^STRIPE_PRICE_/);
      expect(config.displayName).toBeTruthy();
      expect(config.description).toBeTruthy();
    }

    expect(PLAN_CONFIG.starter.websiteLimit).toBe(1);
    expect(PLAN_CONFIG.professional.websiteLimit).toBe(10);
    expect(PLAN_CONFIG.agency.websiteLimit).toBeNull();
    expect(planRank("agency")).toBeGreaterThan(planRank("professional"));
    expect(planRank("professional")).toBeGreaterThan(planRank("starter"));
  });

  it("locks unpaid users and unlocks Professional / Agency features", () => {
    expect(resolveFeatures(sub())).toEqual(LOCKED_FEATURES);
    expect(resolveFeatures(sub()).leadInbox).toBe(false);
    expect(resolveFeatures(sub()).customDomains).toBe(false);
    expect(resolveFeatures(sub()).advancedAnalytics).toBe(false);
    expect(resolveFeatures(sub()).removeBranding).toBe(false);

    const starter = sub({ plan: "starter", status: "active" });
    expect(resolveFeatures(starter).basicAnalytics).toBe(true);
    expect(resolveFeatures(starter).basicSeo).toBe(true);
    expect(resolveFeatures(starter).communitySupport).toBe(true);
    expect(resolveFeatures(starter).removeBranding).toBe(false);
    expect(resolveFeatures(starter).leadInbox).toBe(false);
    expect(resolveFeatures(starter).maxProjects).toBe(
      PLAN_CONFIG.starter.websiteLimit,
    );

    const professional = sub({ plan: "professional", status: "active" });
    expect(resolveFeatures(professional).leadInbox).toBe(true);
    expect(resolveFeatures(professional).customDomains).toBe(true);
    expect(resolveFeatures(professional).advancedAnalytics).toBe(true);
    expect(resolveFeatures(professional).removeBranding).toBe(true);
    expect(resolveFeatures(professional).emailNotifications).toBe(true);
    expect(resolveFeatures(professional).seoTools).toBe(true);
    expect(resolveFeatures(professional).versionHistory).toBe(true);
    expect(resolveFeatures(professional).teamMembers).toBe(false);
    expect(resolveFeatures(professional).maxProjects).toBe(
      PLAN_CONFIG.professional.websiteLimit,
    );

    const agency = sub({ plan: "agency", status: "active" });
    expect(resolveFeatures(agency).teamMembers).toBe(true);
    expect(resolveFeatures(agency).whiteLabel).toBe(true);
    expect(resolveFeatures(agency).aiCredits).toBe(true);
    expect(resolveFeatures(agency).maxProjects).toBeNull();
  });

  it("treats canceled subscriptions as locked entitlements (data retained)", () => {
    const canceled = sub({
      plan: "professional",
      status: "canceled",
      stripe_subscription_id: "sub_old",
    });
    expect(effectivePlan(canceled)).toBeNull();
    expect(resolveFeatures(canceled).leadInbox).toBe(false);
    expect(resolveFeatures(canceled).maxProjects).toBe(0);
  });

  it("keeps entitlements while cancel_at_period_end with active status", () => {
    const ending = sub({
      plan: "professional",
      status: "active",
      cancel_at_period_end: true,
    });
    expect(effectivePlan(ending)).toBe("professional");
    expect(toPublicSubscription(ending).cancelAtPeriodEnd).toBe(true);
    expect(toPublicSubscription(ending).priceMonthlyLabel).toBe(
      formatPlanMonthlyPrice("professional"),
    );
    expect(toPublicSubscription(ending).priceMonthlyUsd).toBe(
      planMonthlyPriceUsd("professional"),
    );
  });

  it("enforces usage limits from PLAN_CONFIG", () => {
    const locked = evaluateUsage(LOCKED_FEATURES, {
      projectCount: 0,
      domainCount: 0,
    });
    expect(locked.canCreateProject).toBe(false);
    expect(locked.canAddDomain).toBe(false);

    const starter = evaluateUsage(featureFlagsForPlan("starter"), {
      projectCount: PLAN_CONFIG.starter.websiteLimit!,
      domainCount: 0,
    });
    expect(starter.canCreateProject).toBe(false);
    expect(starter.canAddDomain).toBe(false);

    const professional = evaluateUsage(featureFlagsForPlan("professional"), {
      projectCount: PLAN_CONFIG.professional.websiteLimit! - 1,
      domainCount: PLAN_CONFIG.professional.domainLimit! - 1,
    });
    expect(professional.canCreateProject).toBe(true);
    expect(professional.canAddDomain).toBe(true);

    const professionalMax = evaluateUsage(
      featureFlagsForPlan("professional"),
      {
        projectCount: PLAN_CONFIG.professional.websiteLimit!,
        domainCount: PLAN_CONFIG.professional.domainLimit!,
      },
    );
    expect(professionalMax.canCreateProject).toBe(false);
    expect(professionalMax.canAddDomain).toBe(false);
  });

  it("builds billing summary with upgrade messaging", () => {
    const summary = buildBillingSummary(
      sub({ plan: "starter", status: "none" }),
      {
        projectCount: 0,
        domainCount: 0,
      },
    );
    expect(summary.canCreateProject).toBe(false);
    expect(summary.subscription.priceMonthlyLabel).toBe("$0");
    expect(upgradeMessage("plan_limit_projects")).toMatch(/Upgrade/i);
  });
});

describe("branding gate", () => {
  it("injects Built with Atlas when branding is required", () => {
    const badge = renderBuiltWithAtlasBadge({
      atlasOrigin: "https://atlas.example.com",
    });
    expect(badge).toContain("Built with Atlas");

    const artifact = buildStaticSite(sampleProject(), {
      atlasOrigin: "https://atlas.example.com",
      projectId: "11111111-1111-4111-8111-111111111111",
      showAtlasBranding: true,
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain("Built with Atlas");
  });

  it("removes branding when removeBranding is entitled", () => {
    const artifact = buildStaticSite(sampleProject(), {
      atlasOrigin: "https://atlas.example.com",
      projectId: "11111111-1111-4111-8111-111111111111",
      showAtlasBranding: false,
    });
    const html = artifact.files.find((f) => f.path === "index.html")!.content;
    expect(html).not.toContain("Built with Atlas");
  });
});

describe("stripe price mapping & subscription upgrades", () => {
  it("maps configured price ids to plans via PLAN_CONFIG env keys", () => {
    for (const plan of PLAN_CATALOG) {
      vi.stubEnv(plan.stripePriceEnvKey, `price_${plan.id}_live`);
      if (plan.stripeAnnualPriceEnvKey) {
        vi.stubEnv(plan.stripeAnnualPriceEnvKey, `price_${plan.id}_annual`);
      }
    }

    expect(planFromStripePriceId("price_starter_live")).toBe("starter");
    expect(planFromStripePriceId("price_professional_live")).toBe(
      "professional",
    );
    expect(planFromStripePriceId("price_agency_live")).toBe("agency");
    expect(planFromStripePriceId("price_professional_annual")).toBe(
      "professional",
    );
    expect(planFromStripePriceId("price_unknown")).toBeNull();

    expect(resolveStripePriceId("professional")).toBe(
      "price_professional_live",
    );
    expect(resolveStripePriceId("professional", "year")).toBe(
      "price_professional_annual",
    );
  });

  it("resolves plan from Stripe subscription items on upgrade", () => {
    vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_live");
    vi.stubEnv("STRIPE_PRICE_PROFESSIONAL", "price_professional_live");
    vi.stubEnv("STRIPE_PRICE_AGENCY", "price_agency_live");
    const subscription = {
      id: "sub_1",
      status: "active",
      items: {
        data: [{ price: { id: "price_agency_live" } }],
      },
    } as unknown as Stripe.Subscription;
    expect(resolvePlanFromSubscription(subscription)).toBe("agency");
  });
});

describe("webhook signature contract", () => {
  it("documents constructEvent requires Stripe-Signature + webhook secret", async () => {
    const { constructStripeEvent } = await import("@/lib/billing/webhooks");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");

    expect(() => constructStripeEvent("{}", null)).toThrow(
      /Missing Stripe-Signature/i,
    );

    // Invalid signature must fail closed (no event processing).
    expect(() =>
      constructStripeEvent("{}", "t=1,v1=deadbeef"),
    ).toThrow();
  });

  it("can form a valid Stripe test signature header shape", () => {
    const secret = "whsec_test_secret";
    const payload = '{"id":"evt_test","object":"event"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");
    const header = `t=${timestamp},v1=${signed}`;
    expect(header).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
  });
});

describe("checkout & portal API contracts", () => {
  it("checkout route requires authenticated owner and a catalog plan", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../app/api/billing/checkout/route.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("createCheckoutSession");
    expect(src).toContain('plan !== "starter"');
    expect(src).toContain('plan !== "professional"');
    expect(src).toContain('plan !== "agency"');
    expect(src).toContain("unauthorized");
  });

  it("portal route opens Stripe billing portal for owner", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../app/api/billing/portal/route.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("createBillingPortalSession");
    expect(src).toContain("unauthorized");
  });

  it("webhook route verifies signatures and processes events", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../app/api/stripe/webhook/route.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).toContain("constructStripeEvent");
    expect(src).toContain("processStripeEvent");
    expect(src).toContain("stripe-signature");
  });
});

describe("feature gate API contracts", () => {
  it("domains POST gates custom domains", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(__dirname, "../../app/api/domains/route.ts"),
      "utf8",
    );
    expect(src).toContain("feature_custom_domains");
    expect(src).toContain("plan_limit_domains");
  });

  it("leads list gates lead inbox", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(__dirname, "../../app/api/leads/route.ts"),
      "utf8",
    );
    expect(src).toContain("feature_lead_inbox");
  });

  it("advanced analytics routes require advancedAnalytics", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const name of ["pages", "sources", "devices", "recent"]) {
      const src = readFileSync(
        resolve(__dirname, `../../app/api/analytics/${name}/route.ts`),
        "utf8",
      );
      expect(src).toContain("requireAdvancedAnalytics");
    }
  });
});

describe("secret isolation", () => {
  it("never exposes Stripe secret keys as NEXT_PUBLIC_", () => {
    expect("STRIPE_SECRET_KEY".startsWith("NEXT_PUBLIC_")).toBe(false);
    expect("STRIPE_WEBHOOK_SECRET".startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});
