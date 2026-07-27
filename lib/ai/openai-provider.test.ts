import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError } from "@/lib/ai/errors";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_DEFAULTS,
  WEBSITE_DRAFT_JSON_SCHEMA,
  WEBSITE_DRAFT_SCHEMA_NAME,
  buildOpenAiWebsiteResponseParams,
  buildSafeGenerationPayload,
  buildWebsiteDeveloperPrompt,
  buildWebsiteSystemPrompt,
  buildWebsiteUserPrompt,
  createAiProvider,
  getAiProviderId,
  getOpenAiModel,
  isTransientAiError,
  MockAiProvider,
  OpenAiWebsiteProvider,
  resolveOpenAiRuntimeConfig,
  withAiRetry,
  type OpenAiResponsesClient,
} from "@/lib/ai";
import { resetServerEnvCacheForTests } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetServerEnvCacheForTests();
});

function sampleInput() {
  return {
    projectId: "11111111-1111-4111-8111-111111111111",
    businessName: "Cedar Cafe",
    businessType: "Coffee Shop",
    description: "Neighborhood espresso and pastries.",
    goals: ["attract customers"],
    questionnaire: {
      tone: "friendly",
      primaryServices: ["Espresso", "Pastries"],
      phone: "(555) 111-2222",
      email: "hello@cedar.example",
      address: "12 Main St",
      optionalSections: { gallery: true, faq: true },
    },
  };
}

function validDraftJson() {
  return JSON.stringify({
    businessName: "Cedar Cafe",
    businessType: "Coffee Shop",
    description: "Neighborhood espresso and pastries.",
    heroEyebrow: "Cedar Cafe",
    heroHeadline: "Coffee worth lingering over",
    heroSubheadline: "Espresso and pastries in the heart of downtown.",
    primaryCta: "Visit us",
    secondaryCta: "See the menu",
    aboutTitle: "About Cedar Cafe",
    aboutBody:
      "Cedar Cafe serves neighborhood espresso and pastries with care.",
    services: [
      { title: "Espresso", description: "Classic drinks pulled fresh." },
      { title: "Pastries", description: "Baked daily." },
      { title: "Catering", description: "Office drop-offs available." },
    ],
    contact: {
      title: "Contact us",
      description: "Say hello — we typically reply within one business day.",
      phone: "(555) 111-2222",
      email: "hello@cedar.example",
      location: "12 Main St",
      buttonText: "Send message",
    },
    seo: {
      siteTitle: "Cedar Cafe | Coffee Shop",
      metaDescription:
        "Neighborhood espresso and pastries from Cedar Cafe in downtown.",
      socialTitle: "Cedar Cafe",
      socialDescription: "Neighborhood espresso and pastries.",
      robotsIndex: true,
    },
    enabledSections: ["gallery", "faq"],
  });
}

function mockClient(
  handler: OpenAiResponsesClient["responses"]["create"],
): OpenAiResponsesClient {
  return {
    responses: {
      create: handler,
    },
  };
}

function mockResponse(content: string, usage?: {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}) {
  return {
    id: "resp_test",
    output_text: content,
    usage: usage
      ? {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        }
      : undefined,
  };
}

describe("OpenAI provider selection + config", () => {
  it("defaults to mock and does not require an API key", () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(getAiProviderId()).toBe("mock");
    expect(createAiProvider()).toBeInstanceOf(MockAiProvider);
  });

  it("selects openai when AI_PROVIDER=openai and key is present", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    expect(getAiProviderId()).toBe("openai");
    expect(createAiProvider()).toBeInstanceOf(OpenAiWebsiteProvider);
  });

  it("throws not_configured when openai is selected without a key", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => createAiProvider()).toThrow(AiError);
    try {
      createAiProvider();
    } catch (error) {
      expect((error as AiError).code).toBe("not_configured");
    }
  });

  it("defaults model to gpt-5.2 and never gpt-5.5", () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.2");
    expect(DEFAULT_OPENAI_MODEL).not.toBe("gpt-5.5");
    expect(getOpenAiModel({})).toBe("gpt-5.2");
    expect(resolveOpenAiRuntimeConfig({}).model).toBe("gpt-5.2");
    expect(resolveOpenAiRuntimeConfig({ OPENAI_MODEL: "gpt-4.1" }).model).toBe(
      "gpt-4.1",
    );
    expect(OPENAI_DEFAULTS.maxOutputTokens).toBeGreaterThan(1000);
  });
});

describe("prompt architecture + safety", () => {
  it("splits system, developer, and user prompts", () => {
    expect(buildWebsiteSystemPrompt()).toMatch(/expert web designer/i);
    expect(buildWebsiteDeveloperPrompt()).toMatch(/JSON object/i);
    expect(buildWebsiteDeveloperPrompt()).toMatch(/markdown/i);
    const user = buildWebsiteUserPrompt(sampleInput());
    expect(user).toContain("Cedar Cafe");
    expect(user).not.toContain("11111111-1111-4111-8111-111111111111");
  });

  it("never includes projectId or secrets in the safe payload", () => {
    const payload = buildSafeGenerationPayload({
      ...sampleInput(),
      projectId: "should-not-appear",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("should-not-appear");
    expect(serialized).not.toContain("owner");
    expect(serialized).not.toContain("OPENAI");
    expect(serialized).not.toContain("billing");
    expect(payload.businessName).toBe("Cedar Cafe");
  });

  it("builds a Responses API request with strict JSON Schema output", () => {
    const params = buildOpenAiWebsiteResponseParams({
      model: "gpt-5.2",
      temperature: 0.4,
      maxOutputTokens: 4096,
      generateInput: sampleInput(),
    });
    expect(params.model).toBe("gpt-5.2");
    expect(params.max_output_tokens).toBe(4096);
    expect(params.text?.format).toEqual({
      type: "json_schema",
      name: WEBSITE_DRAFT_SCHEMA_NAME,
      strict: true,
      schema: WEBSITE_DRAFT_JSON_SCHEMA,
    });
    expect(params.text?.format).not.toEqual(
      expect.objectContaining({ type: "json_object" }),
    );
    expect(Array.isArray(params.input)).toBe(true);
    const input = params.input as Array<{ role: string; content: string }>;
    expect(input).toHaveLength(3);
    expect(input[0]?.role).toBe("system");
    expect(input[1]?.role).toBe("developer");
    expect(input[2]?.role).toBe("user");
    expect(String(input[2]?.content ?? "")).not.toContain(
      sampleInput().projectId,
    );
    expect(WEBSITE_DRAFT_JSON_SCHEMA.required).toContain("services");
    expect(WEBSITE_DRAFT_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("OpenAI generateWebsite (mocked Responses client)", () => {
  it("calls the Responses API with the configured model", async () => {
    const create = vi.fn(async () =>
      mockResponse(validDraftJson(), {
        input_tokens: 120,
        output_tokens: 400,
        total_tokens: 520,
      }),
    );

    const provider = new OpenAiWebsiteProvider({
      apiKey: "sk-test",
      model: "gpt-5.2",
      client: mockClient(create as never),
      createRequestId: () => "req-test-1",
    });

    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.businessName).toBe("Cedar Cafe");
    expect(result.draft.services.length).toBeGreaterThanOrEqual(1);
    expect(result.draft.seo.siteTitle).toContain("Cedar Cafe");
    expect(create).toHaveBeenCalledTimes(1);
    const [body] = create.mock.calls[0]!;
    expect(body.model).toBe("gpt-5.2");
    expect(body.text?.format?.type).toBe("json_schema");
    expect(
      body.text?.format && "strict" in body.text.format
        ? body.text.format.strict
        : null,
    ).toBe(true);
  });

  it("rejects malformed JSON without retrying", async () => {
    let calls = 0;
    const provider = new OpenAiWebsiteProvider({
      apiKey: "sk-test",
      maxRetries: 3,
      client: mockClient(async () => {
        calls += 1;
        return mockResponse("```json\n{}\n```") as never;
      }),
      sleep: async () => undefined,
    });

    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_response");
    expect(calls).toBe(1);
  });

  it("rejects schema-invalid JSON without retrying", async () => {
    let calls = 0;
    const provider = new OpenAiWebsiteProvider({
      apiKey: "sk-test",
      maxRetries: 3,
      client: mockClient(async () => {
        calls += 1;
        return mockResponse(
          JSON.stringify({ businessName: "Only name" }),
        ) as never;
      }),
      sleep: async () => undefined,
    });

    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_response");
    expect(calls).toBe(1);
  });

  it("retries transient failures with exponential backoff", async () => {
    const delays: number[] = [];
    let calls = 0;
    const provider = new OpenAiWebsiteProvider({
      apiKey: "sk-test",
      maxRetries: 2,
      retryBaseDelayMs: 10,
      sleep: async (ms) => {
        delays.push(ms);
      },
      client: mockClient(async () => {
        calls += 1;
        if (calls < 3) {
          const err = new Error("rate limit 429");
          (err as { status?: number }).status = 429;
          throw err;
        }
        return mockResponse(validDraftJson()) as never;
      }),
    });

    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("maps timeouts to provider_error", async () => {
    const provider = new OpenAiWebsiteProvider({
      apiKey: "sk-test",
      timeoutMs: 5,
      maxRetries: 0,
      client: mockClient(async (_body, options) => {
        await new Promise<void>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
        return {} as never;
      }),
    });

    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider_error");
    expect(result.message).toMatch(/timed out/i);
  });
});

describe("AI retry helpers", () => {
  it("does not treat invalid_response as transient", () => {
    expect(
      isTransientAiError(new AiError("invalid_response", "bad json")),
    ).toBe(false);
    expect(isTransientAiError(new AiError("rate_limited", "slow down"))).toBe(
      true,
    );
  });

  it("withAiRetry stops on non-transient errors", async () => {
    let calls = 0;
    await expect(
      withAiRetry(
        async () => {
          calls += 1;
          throw new AiError("invalid_response", "nope");
        },
        { retries: 3, sleep: async () => undefined },
      ),
    ).rejects.toBeInstanceOf(AiError);
    expect(calls).toBe(1);
  });
});

describe("mock fallback remains available", () => {
  it("mock provider still generates without OpenAI", async () => {
    const provider = new MockAiProvider();
    const result = await provider.generateWebsite(sampleInput());
    expect(result.ok).toBe(true);
  });
});
