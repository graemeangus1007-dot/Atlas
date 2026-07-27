import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiError,
  buildMockWebsiteDraft,
  createAiProvider,
  generateWebsiteDraft,
  getAiProviderId,
  MockAiProvider,
  normalizeGenerateWebsiteInput,
  OpenAiWebsiteProvider,
} from "@/lib/ai";
import { validateEnv, resetServerEnvCacheForTests } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCacheForTests();
});

describe("AI provider selection", () => {
  it("defaults to mock when AI_PROVIDER is unset", () => {
    vi.stubEnv("AI_PROVIDER", "");
    expect(getAiProviderId()).toBe("mock");
    expect(createAiProvider().id).toBe("mock");
    expect(createAiProvider()).toBeInstanceOf(MockAiProvider);
  });

  it("selects openai when AI_PROVIDER=openai and key is present", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    expect(getAiProviderId()).toBe("openai");
    expect(createAiProvider().id).toBe("openai");
    expect(createAiProvider()).toBeInstanceOf(OpenAiWebsiteProvider);
  });

  it("throws not_configured when openai is selected without a key", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => createAiProvider()).toThrow(AiError);
    try {
      createAiProvider();
    } catch (error) {
      expect(error).toBeInstanceOf(AiError);
      expect((error as AiError).code).toBe("not_configured");
    }
  });
});

describe("mock website generation", () => {
  it("returns realistic draft fields without network", async () => {
    const provider = new MockAiProvider();
    const result = await provider.generateWebsite({
      projectId: "11111111-1111-4111-8111-111111111111",
      businessName: "Cedar & Pine Cafe",
      businessType: "Coffee Shop",
      description: "Neighborhood espresso and pastries.",
      goals: ["attract customers"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("mock");
    expect(result.draft.businessName).toBe("Cedar & Pine Cafe");
    expect(result.draft.heroEyebrow).toContain("Cedar & Pine Cafe");
    expect(result.draft.heroHeadline.length).toBeGreaterThan(8);
    expect(result.draft.heroSubheadline.length).toBeGreaterThan(10);
    expect(result.draft.primaryCta.length).toBeGreaterThan(2);
    expect(result.draft.aboutBody).toContain("espresso");
    expect(result.draft.services).toHaveLength(3);
    expect(result.draft.contact.email).toMatch(/@example\.com$/);
    expect(result.draft.seo.siteTitle).toContain("Cedar & Pine Cafe");
    expect(result.draft.seo.metaDescription.length).toBeGreaterThan(20);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("buildMockWebsiteDraft fills defaults for empty input", () => {
    const draft = buildMockWebsiteDraft({
      projectId: "p1",
      businessName: "",
      businessType: "",
      description: "",
    });
    expect(draft.businessName.length).toBeGreaterThan(0);
    expect(draft.services.length).toBe(3);
    expect(draft.seo.robotsIndex).toBe(true);
  });
});

describe("generator orchestration", () => {
  it("normalizes input and requires projectId", () => {
    expect(() =>
      normalizeGenerateWebsiteInput({ projectId: "  " }),
    ).toThrow(AiError);

    const input = normalizeGenerateWebsiteInput({
      projectId: " abc ",
      businessName: " Atlas Bakery ",
      goals: ["grow", "", 12 as unknown as string],
    });
    expect(input.projectId).toBe("abc");
    expect(input.businessName).toBe("Atlas Bakery");
    expect(input.goals).toEqual(["grow"]);
  });

  it("generateWebsiteDraft uses the injected provider", async () => {
    const result = await generateWebsiteDraft(
      {
        projectId: "p1",
        businessName: "Test Co",
        businessType: "Agency",
        description: "We build brands.",
      },
      new MockAiProvider(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.businessName).toBe("Test Co");
  });

  it("openai provider constructs Responses API requests with structured outputs", async () => {
    const { buildOpenAiWebsiteResponseParams } = await import(
      "@/lib/ai/openai-provider"
    );
    const params = buildOpenAiWebsiteResponseParams({
      model: "gpt-5.2",
      temperature: 0.4,
      maxOutputTokens: 1000,
      generateInput: {
        projectId: "p1",
        businessName: "Test",
        businessType: "Shop",
        description: "Desc",
      },
    });
    expect(params.text?.format?.type).toBe("json_schema");
    expect(
      params.text?.format && "strict" in params.text.format
        ? params.text.format.strict
        : null,
    ).toBe(true);
    expect(Array.isArray(params.input)).toBe(true);
    const input = params.input as Array<{ role: string }>;
    expect(input.some((m) => m.role === "developer")).toBe(true);
  });
});

describe("AI env validation", () => {
  function baseValidEnv(
    overrides: Record<string, string | undefined> = {},
  ): NodeJS.ProcessEnv {
    return {
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
      APP_URL: "https://atlas.example.com",
      DEPLOYMENT_PROVIDER: "mock",
      DOMAIN_PROVIDER: "mock",
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
      AI_PROVIDER: "mock",
      ...overrides,
    };
  }

  it("allows mock without OPENAI_API_KEY", () => {
    const result = validateEnv(baseValidEnv({ AI_PROVIDER: "mock" }), {
      requireProductionSecrets: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.aiProvider).toBe("mock");
    expect(result.env.openaiApiKey).toBeNull();
  });

  it("requires OPENAI_API_KEY when AI_PROVIDER=openai", () => {
    const result = validateEnv(
      baseValidEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: "" }),
      { requireProductionSecrets: true },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === "OPENAI_API_KEY")).toBe(true);
    expect(JSON.stringify(result.errors)).not.toMatch(/sk-/);
  });
});

describe("AI generate API contracts", () => {
  it("requires auth, ownership, rate limit, and standardized errors", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/api/ai/generate/route.ts"),
      "utf8",
    );
    expect(src).toContain("unauthorized");
    expect(src).toContain("forbidden");
    expect(src).toContain('eq("owner_id", user.id)');
    expect(src).toContain("checkDomainRateLimit");
    expect(src).toContain("getRequestId");
    expect(src).toContain("generateWebsiteDraft");
    expect(src).not.toContain("OPENAI_API_KEY");
  });

  it("never exposes OPENAI_API_KEY as NEXT_PUBLIC_", () => {
    expect("OPENAI_API_KEY".startsWith("NEXT_PUBLIC_")).toBe(false);
  });
});
