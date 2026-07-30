/**
 * Sprint 28.0E — incomplete / output-limit critique completion.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { buildDesignCritiqueContext } from "@/lib/ai/design-critique";
import {
  buildOpenAiDesignCritiqueParams,
  resolveCritiqueProviderRuntime,
  runOpenAiCritiqueSchemaProbe,
  runOpenAiDesignCritique,
} from "@/lib/ai/design-critique-provider";
import {
  OPENAI_CRITIQUE_DEFAULTS,
  resolveOpenAiCritiqueOutputConfig,
} from "@/lib/ai/openai-config";
import {
  categorizeIncompleteReason,
  categorizeOpenAiFailure,
  extractOpenAiRequestId,
} from "@/lib/ai/openai-error-categories";
import { setMonitoringProvider } from "@/lib/monitoring";
import type { MonitoringProvider } from "@/lib/monitoring/types";
import { resetServerEnvCacheForTests } from "@/lib/env";
import type { OpenAiResponsesClient } from "@/lib/ai/openai-provider";
import type OpenAI from "openai";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetServerEnvCacheForTests();
  setMonitoringProvider(null);
});

function mockClient(
  handler: OpenAiResponsesClient["responses"]["create"],
): OpenAiResponsesClient {
  return { responses: { create: handler } };
}

function validCritiqueJson() {
  return {
    summary: "Clear offer with a weak first impression.",
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
}

function mockResponse(
  overrides: Partial<OpenAI.Responses.Response> & { output_text?: string },
): OpenAI.Responses.Response {
  return {
    id: "resp_incomplete_test",
    object: "response",
    created_at: Date.now(),
    model: "gpt-5.2",
    status: "completed",
    output: [],
    output_text: overrides.output_text ?? JSON.stringify(validCritiqueJson()),
    usage: {
      input_tokens: 120,
      output_tokens: 80,
      total_tokens: 200,
    },
    ...overrides,
  } as OpenAI.Responses.Response;
}

describe("critique output budget config", () => {
  it("defaults to 8192 and does not reuse tiny probe limits", () => {
    const cfg = resolveOpenAiCritiqueOutputConfig({});
    expect(cfg.maxOutputTokens).toBe(8192);
    expect(cfg.maxOutputTokens).toBe(OPENAI_CRITIQUE_DEFAULTS.maxOutputTokens);
    expect(cfg.retryMaxOutputTokens).toBeGreaterThan(cfg.maxOutputTokens);
    expect(cfg.retryMaxOutputTokens).toBeLessThanOrEqual(
      OPENAI_CRITIQUE_DEFAULTS.maxOutputTokensCap,
    );

    const runtime = resolveCritiqueProviderRuntime({});
    expect(runtime.critiqueOutput.maxOutputTokens).toBe(8192);

    const params = buildOpenAiDesignCritiqueParams({
      model: "gpt-5.2",
      temperature: runtime.critiqueOutput.temperature,
      maxOutputTokens: runtime.critiqueOutput.maxOutputTokens,
      request: "Review",
      mode: "critique",
      context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
    });
    expect(params.max_output_tokens).toBe(8192);
    expect(params.max_output_tokens).not.toBe(64);
    expect(params.max_output_tokens).not.toBe(400);
  });

  it("honors OPENAI_CRITIQUE_MAX_OUTPUT_TOKENS within the safe cap", () => {
    vi.stubEnv("OPENAI_CRITIQUE_MAX_OUTPUT_TOKENS", "10000");
    expect(resolveOpenAiCritiqueOutputConfig(process.env).maxOutputTokens).toBe(
      10000,
    );
    vi.stubEnv("OPENAI_CRITIQUE_MAX_OUTPUT_TOKENS", "999999");
    expect(resolveOpenAiCritiqueOutputConfig(process.env).maxOutputTokens).toBe(
      OPENAI_CRITIQUE_DEFAULTS.maxOutputTokensCap,
    );
  });

  it("shares the same config between probe and production critique path", async () => {
    const seen: number[] = [];
    const client = mockClient(async (body) => {
      seen.push(body.max_output_tokens ?? -1);
      return mockResponse({
        id: "resp_shared_cfg",
        output_text: JSON.stringify(validCritiqueJson()),
      });
    });

    await runOpenAiDesignCritique(
      {
        request: "Review this homepage",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client, apiKey: "sk-test", maxRetries: 0, atlasRequestId: "prod-1" },
    );
    await runOpenAiCritiqueSchemaProbe({
      client,
      apiKey: "sk-test",
      atlasRequestId: "probe-1",
    });

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(8192);
    expect(seen[1]).toBe(8192);
  });
});

describe("incomplete reason mapping", () => {
  it("maps max_output_tokens to output_limit and content filter to refusal", () => {
    expect(categorizeIncompleteReason("max_output_tokens")).toBe("output_limit");
    expect(categorizeIncompleteReason("content_filter")).toBe("refusal");
    expect(categorizeIncompleteReason("unknown_reason")).toBe("incomplete");
  });
});

describe("incomplete Responses handling", () => {
  it("accepts a completed critique response", async () => {
    const client = mockClient(async () =>
      mockResponse({
        id: "resp_ok_1",
        status: "completed",
        output_text: JSON.stringify(validCritiqueJson()),
      }),
    );
    const result = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client, apiKey: "sk-test", maxRetries: 0 },
    );
    expect(result.responseStatus).toBe("completed");
    expect(result.openaiRequestId).toBe("resp_ok_1");
    expect(result.configuredMaxOutputTokens).toBe(8192);
    expect(result.retriedForOutputLimit).toBe(false);
  });

  it("captures OpenAI request id on incomplete responses", async () => {
    const client = mockClient(async () =>
      mockResponse({
        id: "resp_trunc_1",
        object: "response",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "",
        usage: {
          input_tokens: 500,
          output_tokens: 400,
          total_tokens: 900,
        },
      } as never),
    );

    // First attempt incomplete, retry also incomplete
    let calls = 0;
    const retryClient = mockClient(async (body) => {
      calls += 1;
      return mockResponse({
        id: calls === 1 ? "resp_trunc_1" : "resp_trunc_2",
        object: "response",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "",
        usage: {
          input_tokens: 500,
          output_tokens: body.max_output_tokens ?? 0,
          total_tokens: 500 + (body.max_output_tokens ?? 0),
        },
      } as never);
    });

    const err = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client: retryClient, apiKey: "sk-test", maxRetries: 0 },
    ).then(
      () => null,
      (error) => error,
    );

    expect(err).toBeTruthy();
    expect(categorizeOpenAiFailure(err).category).toBe("output_limit");
    expect((err as { openaiRequestId?: string }).openaiRequestId).toBe(
      "resp_trunc_2",
    );
    expect((err as { incompleteReason?: string }).incompleteReason).toBe(
      "max_output_tokens",
    );
    expect(extractOpenAiRequestId(err)).toBe("resp_trunc_2");
    expect(calls).toBe(2);

    // Sanity: single incomplete without retry path still exposes id via extractor
    expect(
      extractOpenAiRequestId(
        mockResponse({
          id: "resp_trunc_1",
          object: "response",
          status: "incomplete",
        } as never),
      ),
    ).toBe("resp_trunc_1");
    void client;
  });

  it("retries once on max_output_tokens and succeeds", async () => {
    let calls = 0;
    const budgets: number[] = [];
    const compactFlags: boolean[] = [];
    const client = mockClient(async (body) => {
      calls += 1;
      budgets.push(body.max_output_tokens ?? -1);
      const system = Array.isArray(body.input)
        ? body.input.find((m) => m.role === "system")
        : null;
      const systemText =
        typeof system?.content === "string" ? system.content : "";
      compactFlags.push(/COMPACT MODE/i.test(systemText));

      if (calls === 1) {
        return mockResponse({
          id: "resp_retry_a",
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text: "",
        } as never);
      }
      return mockResponse({
        id: "resp_retry_b",
        status: "completed",
        output_text: JSON.stringify(validCritiqueJson()),
      });
    });

    const result = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client, apiKey: "sk-test", maxRetries: 0 },
    );

    expect(calls).toBe(2);
    expect(budgets[0]).toBe(8192);
    expect(budgets[1]).toBeGreaterThan(8192);
    expect(compactFlags[0]).toBe(false);
    expect(compactFlags[1]).toBe(true);
    expect(result.retriedForOutputLimit).toBe(true);
    expect(result.openaiRequestId).toBe("resp_retry_b");
    expect(result.responseStatus).toBe("completed");
  });

  it("does not retry repeatedly when the bounded retry is still incomplete", async () => {
    let calls = 0;
    const client = mockClient(async () => {
      calls += 1;
      return mockResponse({
        id: `resp_still_${calls}`,
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "",
      } as never);
    });

    const err = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client, apiKey: "sk-test", maxRetries: 0 },
    ).then(
      () => null,
      (error) => error,
    );

    expect(calls).toBe(2);
    expect(categorizeOpenAiFailure(err).category).toBe("output_limit");
    expect((err as { retriedForOutputLimit?: boolean }).retriedForOutputLimit).toBe(
      true,
    );
  });

  it("maps other incomplete reasons without an output-limit retry", async () => {
    let calls = 0;
    const client = mockClient(async () => {
      calls += 1;
      return mockResponse({
        id: "resp_other_inc",
        status: "incomplete",
        incomplete_details: { reason: "max_tool_calls" },
        output_text: "",
      } as never);
    });

    const err = await runOpenAiDesignCritique(
      {
        request: "Review",
        mode: "critique",
        context: buildDesignCritiqueContext(MOCK_BUSINESS_PROJECT),
      },
      { client, apiKey: "sk-test", maxRetries: 0 },
    ).then(
      () => null,
      (error) => error,
    );

    expect(calls).toBe(1);
    expect(categorizeOpenAiFailure(err).category).toBe("incomplete");
    expect((err as { incompleteReason?: string }).incompleteReason).toBe(
      "max_tool_calls",
    );
  });

  it("probe reports output_limit diagnostics without prompts or raw bodies", async () => {
    const extras: unknown[] = [];
    setMonitoringProvider({
      captureException() {},
      captureMessage(input) {
        extras.push(input.context?.extra);
      },
    } as MonitoringProvider);

    let calls = 0;
    const client = mockClient(async () => {
      calls += 1;
      return mockResponse({
        id: `resp_probe_${calls}`,
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "",
      } as never);
    });

    const probe = await runOpenAiCritiqueSchemaProbe({
      client,
      apiKey: "sk-test",
      atlasRequestId: "7d73f64c-6156-4304-ad37-66480292fa49",
    });

    expect(probe.success).toBe(false);
    expect(probe.category).toBe("output_limit");
    expect(probe.incompleteReason).toBe("max_output_tokens");
    expect(probe.configuredMaxOutputTokens).toBeGreaterThanOrEqual(8192);
    expect(probe.openaiRequestId).toMatch(/^resp_probe_/);
    expect(probe.requestId).toBe("7d73f64c-6156-4304-ad37-66480292fa49");
    expect(calls).toBe(2);

    const blob = JSON.stringify({ probe, extras });
    expect(blob).not.toMatch(/sk-test/);
    expect(blob).not.toMatch(/Schema probe: return a minimal/);
    expect(blob).not.toMatch(/Clear offer with a weak/);
    expect(blob).toMatch(/output_limit|max_output_tokens|configuredMaxOutputTokens/);
  });
});
