/**
 * Sprint 28.0B — OpenAI critique reliability + routing regressions.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  AI_RUNTIME_DEBUG_TEMPORARY,
  getAiRuntimeSnapshot,
} from "@/lib/ai/ai-runtime-diagnostics";
import {
  decideAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import {
  COMPLETE_WEBSITE_PHRASES,
  detectActionConfirmation,
  isCompleteWebsiteRequest,
  shouldExecuteActionMemory,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  assertCritiqueSchemaStrictShape,
  buildOpenAiDesignCritiqueSchema,
  DESIGN_CRITIQUE_SCHEMA_NAME,
  findUnsupportedOpenAiSchemaKeywords,
} from "@/lib/ai/design-critique-schema";
import {
  buildOpenAiDesignCritiqueParams,
  buildOpenAiProbeParams,
  runOpenAiCritiqueSchemaProbe,
  runOpenAiDesignCritique,
  runOpenAiRuntimeProbe,
} from "@/lib/ai/design-critique-provider";
import {
  buildDesignCritiqueContext,
  runDesignCritique,
  validateDesignCritique,
} from "@/lib/ai/design-critique";
import { validateDesignCritiqueWithIssues } from "@/lib/ai/design-critique-validation";
import {
  categorizeOpenAiFailure,
  extractOpenAiRequestId,
  formatFallbackUserMessage,
} from "@/lib/ai/openai-error-categories";
import {
  extractStructuredJsonFromResponse,
} from "@/lib/ai/openai-structured-output";
import { getAiProviderId } from "@/lib/ai/provider";
import { setMonitoringProvider } from "@/lib/monitoring";
import type { MonitoringProvider } from "@/lib/monitoring/types";
import { resetServerEnvCacheForTests } from "@/lib/env";
import type { BusinessProject } from "@/types/business-project";
import type { OpenAiResponsesClient } from "@/lib/ai/openai-provider";
import type OpenAI from "openai";

registerEditorPlanner(planEditOperations);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetServerEnvCacheForTests();
  setMonitoringProvider(null);
});

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    mediaLibrary: [],
    heroImageId: null,
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function mockClient(
  handler: OpenAiResponsesClient["responses"]["create"],
): OpenAiResponsesClient {
  return { responses: { create: handler } };
}

function mockResponse(
  overrides: Partial<OpenAI.Responses.Response> & { output_text?: string },
): OpenAI.Responses.Response {
  return {
    id: "resp_test_123",
    object: "response",
    created_at: Date.now(),
    model: "gpt-5.2",
    status: "completed",
    output: [],
    output_text: overrides.output_text ?? '{"ok":true}',
    usage: {
      input_tokens: 11,
      output_tokens: 3,
      total_tokens: 14,
    },
    ...overrides,
  } as OpenAI.Responses.Response;
}

describe("provider selection + env snapshot", () => {
  it("selects openai when AI_PROVIDER=openai", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    expect(getAiProviderId()).toBe("openai");
    const snap = getAiRuntimeSnapshot(process.env);
    expect(snap.aiProvider).toBe("openai");
    expect(snap.openaiKeyPresent).toBe(true);
    expect(snap.critiqueProviderEnabled).toBe(true);
    expect(snap.responsesApiEnabled).toBe(true);
    expect(AI_RUNTIME_DEBUG_TEMPORARY).toBe(true);
  });

  it("selects mock only when configured", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(getAiProviderId()).toBe("mock");
    const snap = getAiRuntimeSnapshot(process.env);
    expect(snap.critiqueProviderEnabled).toBe(false);
  });
});

describe("structured-output schema contract", () => {
  it("keeps strict object shape and strips unsupported keywords for OpenAI", () => {
    expect(assertCritiqueSchemaStrictShape()).toEqual([]);
    const wire = buildOpenAiDesignCritiqueSchema();
    expect(assertCritiqueSchemaStrictShape(wire)).toEqual([]);
    expect(findUnsupportedOpenAiSchemaKeywords(wire)).toEqual([]);
    const json = JSON.stringify(wire);
    expect(json).not.toMatch(/"minLength"/);
    expect(json).not.toMatch(/"maxLength"/);
    expect(json).not.toMatch(/"minItems"/);
    expect(json).not.toMatch(/"minimum"/);
    expect(json).not.toMatch(/"id"/);
    expect(wire.type).toBe("object");
    expect(wire.additionalProperties).toBe(false);

    const params = buildOpenAiDesignCritiqueParams({
      model: "gpt-5.2",
      temperature: 0.35,
      maxOutputTokens: 2000,
      request: "Review this homepage",
      mode: "critique",
      context: buildDesignCritiqueContext(sampleProject()),
    });
    expect(params.store).toBe(false);
    expect(params.text?.format).toMatchObject({
      type: "json_schema",
      name: DESIGN_CRITIQUE_SCHEMA_NAME,
      strict: true,
    });
    expect((params.text?.format as { schema?: unknown }).schema).toEqual(wire);
    expect(params.temperature).toBe(0.35);
    expect(
      (params as { reasoning?: { effort: string } }).reasoning?.effort,
    ).toBe("none");
    expect(params.input).toHaveLength(2);
    const probe = buildOpenAiProbeParams({ model: "gpt-5.2" });
    expect(probe.store).toBe(false);
    expect(
      (probe as { reasoning?: { effort: string } }).reasoning?.effort,
    ).toBe("none");
  });
});

describe("OpenAI request ID + probe", () => {
  it("captures OpenAI request id and propagates Atlas client request id", async () => {
    let seenHeaders: Record<string, string> | undefined;
    const client = mockClient(async (_body, options) => {
      seenHeaders = options?.headers;
      return mockResponse({
        id: "resp_openai_abc",
        output_text: JSON.stringify({ ok: true }),
      });
    });

    const probe = await runOpenAiRuntimeProbe({
      client,
      atlasRequestId: "atlas-req-1",
      apiKey: "sk-test",
    });
    expect(probe.success).toBe(true);
    if (!probe.success) return;
    expect(probe.openaiRequestId).toBe("resp_openai_abc");
    expect(probe.requestId).toBe("atlas-req-1");
    expect(seenHeaders?.["X-Client-Request-Id"]).toBe("atlas-req-1");
  });

  it("categorizes authentication, quota, rate limit, model, timeout", () => {
    expect(
      categorizeOpenAiFailure({ status: 401, message: "Incorrect API key" })
        .category,
    ).toBe("authentication");
    expect(
      categorizeOpenAiFailure({
        status: 429,
        message: "insufficient_quota: billing",
      }).category,
    ).toBe("quota");
    expect(
      categorizeOpenAiFailure({ status: 429, message: "Rate limit reached" })
        .category,
    ).toBe("rate_limit");
    expect(
      categorizeOpenAiFailure({
        status: 404,
        message: "The model `gpt-nope` does not exist",
      }).category,
    ).toBe("model");
    expect(
      categorizeOpenAiFailure(Object.assign(new Error("aborted"), { name: "AbortError" }))
        .category,
    ).toBe("timeout");
    expect(
      categorizeOpenAiFailure({
        status: 400,
        message:
          "Unsupported parameter: 'temperature' is not supported with this model.",
      }).category,
    ).toBe("model");
    expect(
      categorizeOpenAiFailure({
        status: 400,
        message: "Invalid schema for response_format 'atlas_design_critique'.",
      }).category,
    ).toBe("schema");
    expect(extractOpenAiRequestId({ id: "resp_x" })).toBe("resp_x");
  });

  it("maps refusal / incomplete / empty structured extraction", () => {
    expect(
      extractStructuredJsonFromResponse(
        mockResponse({
          status: "incomplete",
          output_text: "",
          incomplete_details: { reason: "max_output_tokens" },
        } as never),
      ).status,
    ).toBe("incomplete");

    expect(
      extractStructuredJsonFromResponse(
        mockResponse({
          status: "completed",
          output: [
            {
              type: "refusal",
              refusal: "I cannot help with that.",
            },
          ],
          output_text: "",
        } as never),
      ).status,
    ).toBe("refusal");

    expect(
      extractStructuredJsonFromResponse(
        mockResponse({ status: "completed", output_text: "" }),
      ).status,
    ).toBe("empty");
  });
});

describe("validation diagnostics + fallback", () => {
  it("rejects malformed structured output with path/code issues only", () => {
    const result = validateDesignCritiqueWithIssues({
      summary: "ok",
      currentStrengths: [{ title: "A", evidence: "B" }],
      coreProblems: [
        {
          title: "P",
          observation: "O",
          severity: "nope",
          affectedAreas: ["hero"],
        },
      ],
      designDirection: {
        name: "D",
        rationale: "R",
        emotionalGoal: "E",
        visualPrinciples: ["a", "b"],
      },
      prioritizedImprovements: [
        {
          title: "I",
          observation: "O",
          rationale: "R",
          expectedBusinessOutcome: "E",
          impact: "extreme",
          affectedAreas: ["hero"],
          proposedChanges: [],
        },
      ],
      expectedOutcome: "E",
      confidence: 0.5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "invalid_enum")).toBe(true);
    expect(JSON.stringify(result.issues)).not.toMatch(/extreme|nope/);
  });

  it("falls back with labeled reason after OpenAI failure — never silent AI success", async () => {
    expect(
      formatFallbackUserMessage({
        category: "authentication",
        requestId: "7f293bd3-63f4-4ea0-83ee-9c4a34bfeba9",
      }),
    ).toMatch(/labeled local review|authorize/i);
    expect(
      formatFallbackUserMessage({ category: "validation" }),
    ).toMatch(/did not satisfy Atlas validation/i);
    expect(
      formatFallbackUserMessage({ category: "incomplete" }),
    ).toMatch(/incomplete response/i);
    expect(
      formatFallbackUserMessage({
        category: "schema",
        requestId: "req-schema",
      }),
    ).toMatch(/response schema was rejected/i);
    expect(
      formatFallbackUserMessage({
        category: "schema",
        requestId: "req-schema",
      }),
    ).toMatch(/Request ID: req-schema/);
    expect(
      formatFallbackUserMessage({
        category: "schema",
        requestId: "req-schema",
      }),
    ).not.toMatch(/Showing a labeled local review instead/i);
    expect(
      formatFallbackUserMessage({
        category: "unknown",
        failingStage: "critique_to_operations",
      }),
    ).toMatch(/critique-to-operations failed/i);
    expect(
      formatFallbackUserMessage({ category: "model" }),
    ).toMatch(/model configuration/i);
    expect(
      formatFallbackUserMessage({ category: "unknown" }),
    ).not.toMatch(/temporarily unavailable/i);

    const client = mockClient(async () => {
      const err = new Error("Incorrect API key provided");
      (err as { status?: number }).status = 401;
      throw err;
    });

    const direct = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(sampleProject()),
      },
      {
        client,
        atlasRequestId: "7f293bd3-63f4-4ea0-83ee-9c4a34bfeba9",
        apiKey: "sk-test",
        maxRetries: 0,
      },
    ).then(
      () => null,
      (error) => error,
    );
    expect(direct).toBeTruthy();
    expect(categorizeOpenAiFailure(direct).category).toBe("authentication");
    expect((direct as { failingFunction?: string }).failingFunction).toBe(
      "runOpenAiDesignCritique",
    );

    vi.stubEnv("AI_PROVIDER", "mock");
    const mockResult = await runDesignCritique({
      project: sampleProject(),
      request: "Review this homepage",
      mode: "critique",
    });
    expect(mockResult.ok).toBe(true);
    if (!mockResult.ok) return;
    expect(mockResult.usedFallback).toBe(false);
    expect(mockResult.diagnostics.provider).toBe("mock");
    expect(mockResult.explanation).not.toMatch(/labeled local review/i);
  });

  it("uses labeled fallback when openai path fails inside runDesignCritique", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const result = await runDesignCritique({
      project: sampleProject(),
      request:
        "If you were the best web design agency in the world, how would you redesign this homepage?",
      mode: "critique",
      atlasRequestId: "2c31fb60-bd92-45ed-9a35-606c1801635e",
      openAiCall: async () => {
        throw Object.assign(
          new Error(
            "Unsupported parameter: 'temperature' is not supported with this model.",
          ),
          { status: 400 },
        );
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedFallback).toBe(true);
    expect(result.fallbackReason).toBe("model");
    expect(result.diagnostics.failingStage).toBe("openai_http");
    expect(result.diagnostics.failingFunction).toBe("runOpenAiDesignCritique");
    expect(result.explanation).toMatch(/model configuration/i);
    expect(result.explanation).toMatch(/2c31fb60-bd92-45ed-9a35-606c1801635e/);
    expect(result.explanation).not.toMatch(/temporarily unavailable/i);
  });

  it("records validation stage when structured output fails Atlas validation", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const result = await runDesignCritique({
      project: sampleProject(),
      request:
        "If you were the best web design agency in the world, how would you redesign this homepage?",
      mode: "critique",
      atlasRequestId: "2c31fb60-bd92-45ed-9a35-606c1801635e",
      openAiCall: async () => {
        throw Object.assign(
          new Error("OpenAI critique failed Atlas validation."),
          {
            category: "validation",
            failingFunction: "validateDesignCritiqueWithIssues",
          },
        );
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fallbackReason).toBe("validation");
    expect(result.diagnostics.failingFunction).toBe(
      "validateDesignCritiqueWithIssues",
    );
    expect(result.explanation).toMatch(/did not satisfy Atlas validation/i);
  });

  it("does not put prompts or raw response bodies in critique logs", async () => {
    const extras: unknown[] = [];
    setMonitoringProvider({
      captureException() {},
      captureMessage(input) {
        extras.push(input.context?.extra);
      },
    } as MonitoringProvider);

    const valid = {
      summary: "Clear service promise with weak imagery.",
      currentStrengths: [
        { title: "Clarity", evidence: "Headline states the offer." },
      ],
      coreProblems: [
        {
          title: "Missing hero image",
          observation: "Placeholder hero.",
          severity: "missing",
          affectedAreas: ["hero"],
        },
      ],
      designDirection: {
        name: "Premium",
        rationale: "Stronger imagery.",
        emotionalGoal: "Trust",
        visualPrinciples: ["Imagery first", "One CTA"],
      },
      prioritizedImprovements: [
        {
          title: "Add hero photo",
          observation: "No hero photo",
          rationale: "Emotion",
          expectedBusinessOutcome: "Trust",
          impact: "high",
          affectedAreas: ["hero"],
          proposedChanges: [],
        },
      ],
      expectedOutcome: "Better first impression.",
      confidence: 0.8,
    };
    expect(validateDesignCritique(valid).summary).toMatch(/Clear service/);

    const client = mockClient(async () =>
      mockResponse({ output_text: JSON.stringify(valid) }),
    );
    await runOpenAiDesignCritique(
      {
        request: "SECRET_PROMPT_SHOULD_NOT_LOG",
        mode: "critique",
        context: buildDesignCritiqueContext(sampleProject()),
      },
      { client, apiKey: "sk-test", maxRetries: 0 },
    );
    const blob = JSON.stringify(extras);
    expect(blob).not.toMatch(/SECRET_PROMPT_SHOULD_NOT_LOG/);
    expect(blob).not.toMatch(/sk-test/);
    expect(blob).toMatch(/ai\.critique|requestId|openaiRequestId/);
  });
});

describe("Complete my website routing", () => {
  it("continues the active plan without clarification", async () => {
    expect(COMPLETE_WEBSITE_PHRASES.test("Complete my website")).toBe(true);
    expect(isCompleteWebsiteRequest("Make it launch-ready")).toBe(true);
    expect(detectActionConfirmation("Complete my website").kind).toBe(
      "apply_all",
    );

    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "visual.icons",
          kind: "visual",
          title: "Add icons",
          explanation: "Icons",
          impact: "high",
          impactScore: 90,
          confidence: 0.9,
          operations: [{ operation: "setCreativePolish", serviceIcons: true }],
          capabilityIds: [],
          applyable: true,
          estimatedTime: "<10 seconds",
        },
      ],
    });
    expect(shouldExecuteActionMemory("Complete my website", memory)).toBe(true);

    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: memory }),
      request: "Complete my website",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.decision.needsClarification).toBe(false);
    expect(result.explanation).not.toMatch(/Did you mean/i);
  });

  it("applies strategy-led improvements when no active plan exists", async () => {
    const result = await runAtlasBrain({
      project: sampleProject(),
      request: "Complete my website",
    });
    // v1.1 flagship: strategy → prioritize → apply supported ops.
    expect(["applied", "no_changes"]).toContain(result.applyStatus);
    expect(result.explanation).toMatch(
      /Overall direction|Biggest problem|Design goals|Execution plan|Done\.|Apply All/i,
    );
    expect(result.decision.needsClarification).toBe(false);
    if (result.applyStatus === "applied") {
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.explanation).toMatch(/applied|Done\./i);
      expect(result.project.atlasActionMemory?.activePlan?.applyAllPending).not.toBe(true);
    } else {
      expect(
        (result.project.atlasActionMemory?.activePlan?.recommendations?.length ?? 0) > 0,
      ).toBe(true);
    }
  });
});

describe("critique schema probe", () => {
  it("reports sanitized schema rejection without prompt or critique content", async () => {
    const client = mockClient(async () => {
      const err = Object.assign(
        new Error(
          "Invalid schema for response_format 'atlas_design_critique': In context=('properties', 'currentStrengths', 'items'), 'id' is required to be listed in required.",
        ),
        {
          status: 400,
          error: {
            message:
              "Invalid schema for response_format 'atlas_design_critique': In context=('properties', 'currentStrengths', 'items'), 'id' is required to be listed in required.",
            type: "invalid_request_error",
            param: "text.format.schema",
            code: "invalid_json_schema",
          },
        },
      );
      throw err;
    });

    const result = await runOpenAiCritiqueSchemaProbe({
      client,
      apiKey: "sk-test",
      atlasRequestId: "schema-probe-1",
    });
    expect(result.success).toBe(false);
    expect(result.category).toBe("schema");
    expect(result.httpStatus).toBe(400);
    expect(result.openaiErrorCode).toBe("invalid_json_schema");
    expect(result.openaiErrorParam).toBe("text.format.schema");
    expect(result.schemaPath).toMatch(/currentStrengths|text\.format\.schema|id/i);
    expect(result.schemaName).toBe(DESIGN_CRITIQUE_SCHEMA_NAME);
    expect(JSON.stringify(result)).not.toMatch(/sk-test/);
    expect(JSON.stringify(result)).not.toMatch(/How would you redesign/i);
  });

  it("succeeds when the real critique schema is accepted", async () => {
    const valid = {
      summary: "Clear service promise with weak imagery.",
      currentStrengths: [
        { title: "Clarity", evidence: "Headline states the offer." },
      ],
      coreProblems: [
        {
          title: "Missing hero image",
          observation: "Placeholder hero.",
          severity: "missing",
          affectedAreas: ["hero"],
        },
      ],
      designDirection: {
        name: "Premium",
        rationale: "Stronger imagery.",
        emotionalGoal: "Trust",
        visualPrinciples: ["Imagery first", "One CTA"],
      },
      prioritizedImprovements: [
        {
          title: "Add hero photo",
          observation: "No hero photo",
          rationale: "Emotion",
          expectedBusinessOutcome: "Trust",
          impact: "high",
          affectedAreas: ["hero"],
          proposedChanges: [],
        },
      ],
      expectedOutcome: "Better first impression.",
      confidence: 0.8,
    };
    const client = mockClient(async (body) => {
      expect(body.text?.format).toMatchObject({
        name: DESIGN_CRITIQUE_SCHEMA_NAME,
        strict: true,
      });
      expect((body.text?.format as { schema?: unknown }).schema).toEqual(
        buildOpenAiDesignCritiqueSchema(),
      );
      return mockResponse({ output_text: JSON.stringify(valid) });
    });
    const result = await runOpenAiCritiqueSchemaProbe({
      client,
      apiKey: "sk-test",
      atlasRequestId: "schema-probe-ok",
    });
    expect(result.success).toBe(true);
    expect(result.message).toBeNull();
    expect(result.configuredMaxOutputTokens).toBe(8192);
    expect(JSON.stringify(result)).not.toMatch(/Clear service promise/);
  });
});

describe("empty media image guidance", () => {
  it("does not suggest matching images when the library is empty", async () => {
    const decision = decideAtlasBrain({
      project: sampleProject({ mediaLibrary: [] }),
      request: "Replace the hero image",
    });
    expect(decision.followUpSuggestions.join(" ")).not.toMatch(
      /matching images elsewhere/i,
    );

    const result = await runAtlasBrain({
      project: sampleProject({ mediaLibrary: [] }),
      request: "Add matching images",
    });
    expect(result.explanation).toMatch(
      /aren.?t any uploaded images|Upload photos in Media/i,
    );
    expect(result.explanation).not.toMatch(/I generated images/i);
  });
});
