import { afterEach, describe, expect, it } from "vitest";
import {
  formatEnvIssues,
  resetServerEnvCacheForTests,
  validateEnv,
} from "@/lib/env";

function baseValidEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    APP_URL: "https://atlas.example.com",
    DEPLOYMENT_PROVIDER: "vercel",
    VERCEL_TOKEN: "vercel-token-test",
    VERCEL_PROJECT_ID: "prj_test",
    DOMAIN_PROVIDER: "vercel",
    EMAIL_PROVIDER: "mock",
    EMAIL_FROM_ADDRESS: "Atlas <notifications@example.com>",
    LEAD_IP_HASH_SALT: "lead-salt-test-value-32chars-min",
    ANALYTICS_VISITOR_SALT: "analytics-salt-test-value-32ch",
    STRIPE_SECRET_KEY: "sk_test_billing_secret",
    STRIPE_WEBHOOK_SECRET: "whsec_billing_secret",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_billing_publishable",
    STRIPE_PRICE_STARTER: "price_starter_test",
    STRIPE_PRICE_PROFESSIONAL: "price_professional_test",
    STRIPE_PRICE_AGENCY: "price_agency_test",
    ...overrides,
  };
}

afterEach(() => {
  resetServerEnvCacheForTests();
});

describe("validateEnv", () => {
  it("accepts a complete valid configuration", () => {
    const result = validateEnv(baseValidEnv(), {
      requireProductionSecrets: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.appUrl).toBe("https://atlas.example.com");
    expect(result.env.deploymentProvider).toBe("vercel");
    expect(result.env.public.supabaseUrl).toBe("https://example.supabase.co");
  });

  it("fails when critical public Supabase vars are missing", () => {
    const result = validateEnv(
      baseValidEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const keys = result.errors.map((e) => e.key);
    expect(keys).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(keys).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(formatEnvIssues(result.errors)).not.toMatch(/service-role/i);
  });

  it("fails production when APP_URL is localhost", () => {
    const result = validateEnv(
      baseValidEnv({
        APP_URL: "http://localhost:3000",
        NODE_ENV: "production",
        VERCEL: "1",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === "APP_URL")).toBe(true);
  });

  it("requires Vercel credentials when DEPLOYMENT_PROVIDER=vercel", () => {
    const result = validateEnv(
      baseValidEnv({
        VERCEL_TOKEN: "",
        VERCEL_PROJECT_ID: "",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.key)).toEqual(
      expect.arrayContaining(["VERCEL_TOKEN", "VERCEL_PROJECT_ID"]),
    );
  });

  it("allows mock deployment without Vercel credentials", () => {
    const result = validateEnv(
      baseValidEnv({
        DEPLOYMENT_PROVIDER: "mock",
        DOMAIN_PROVIDER: "mock",
        VERCEL_TOKEN: "",
        VERCEL_PROJECT_ID: "",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(true);
  });

  it("requires RESEND_API_KEY when EMAIL_PROVIDER=resend", () => {
    const result = validateEnv(
      baseValidEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === "RESEND_API_KEY")).toBe(true);
  });

  it("never embeds secret values in error messages", () => {
    const secret = "super-secret-token-value-xyz";
    const result = validateEnv(
      baseValidEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        VERCEL_TOKEN: secret,
        SUPABASE_SERVICE_ROLE_KEY: secret,
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(secret);
  });

  it("warns in development when optional salts are missing", () => {
    const result = validateEnv(
      baseValidEnv({
        NODE_ENV: "development",
        LEAD_IP_HASH_SALT: "",
        ANALYTICS_VISITOR_SALT: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
      { requireProductionSecrets: false },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("accepts legacy STRIPE_PRICE_PRO as Professional price id", () => {
    const result = validateEnv(
      baseValidEnv({
        STRIPE_PRICE_PROFESSIONAL: "",
        STRIPE_PRICE_PRO: "price_pro_legacy",
      }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.stripePriceProfessional).toBe("price_pro_legacy");
  });
});
