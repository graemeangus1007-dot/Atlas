/**
 * OpenAI-backed design critique provider (Sprint 28.0A / 28.0B).
 * Server-only — never import into client bundles (use dynamic import).
 */

import OpenAI from "openai";
import { AiError } from "@/lib/ai/errors";
import {
  resolveOpenAiCritiqueOutputConfig,
  resolveOpenAiRuntimeConfig,
  type OpenAiCritiqueOutputConfig,
} from "@/lib/ai/openai-config";
import {
  buildOpenAiDesignCritiqueSchema,
  DESIGN_CRITIQUE_SCHEMA_NAME,
} from "@/lib/ai/design-critique-schema";
import {
  buildDesignCritiqueDeveloperPrompt,
  buildDesignCritiqueSystemPrompt,
  buildDesignCritiqueUserPrompt,
} from "@/lib/ai/design-critique-prompts";
import type {
  DesignCritiqueContext,
  DesignCritiqueMode,
} from "@/lib/ai/design-critique-types";
import {
  categorizeIncompleteReason,
  categorizeOpenAiFailure,
  extractOpenAiRequestId,
  isRetryableOpenAiCategory,
  sanitizeOpenAiSchemaError,
} from "@/lib/ai/openai-error-categories";
import {
  createAiRequestId,
  logAiCritique,
} from "@/lib/ai/openai-logging";
import {
  withAiRetry,
} from "@/lib/ai/openai-retry";
import {
  errorFromStructuredExtraction,
  extractStructuredJsonFromResponse,
} from "@/lib/ai/openai-structured-output";
import type { OpenAiResponsesClient } from "@/lib/ai/openai-provider";
import { captureMessage } from "@/lib/monitoring";

export type DesignCritiqueProviderOptions = {
  apiKey?: string | null;
  model?: string | null;
  client?: OpenAiResponsesClient;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  createRequestId?: () => string;
  /** Atlas HTTP / client request id for correlation. */
  atlasRequestId?: string | null;
};

/** True for GPT-5 family models with reasoning-parameter constraints. */
export function modelUsesGpt5ReasoningConstraints(model: string): boolean {
  return /\bgpt-5\b/i.test(model.trim());
}

/**
 * Build Responses API params for design critique.
 *
 * GPT-5.2 rejects `temperature` unless `reasoning.effort` is `"none"`.
 * Critique uses effort "none" + modest temperature so structured JSON stays
 * fast and compatible (probe-sized calls were succeeding while critique timed
 * out or 400'd on unsupported sampling params).
 */
export function buildOpenAiDesignCritiqueParams(input: {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
  /** Deterministic size reduction for the single output-limit retry. */
  compact?: boolean;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const system = [
    buildDesignCritiqueSystemPrompt(),
    buildDesignCritiqueDeveloperPrompt(input.mode, {
      compact: Boolean(input.compact),
    }),
  ].join("\n\n");

  const wireSchema = buildOpenAiDesignCritiqueSchema();
  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: input.model,
    max_output_tokens: input.maxOutputTokens,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: DESIGN_CRITIQUE_SCHEMA_NAME,
        strict: true,
        schema: wireSchema,
      },
    },
    // Fold developer rules into system — avoids role compatibility surprises.
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: buildDesignCritiqueUserPrompt({
          request: input.request,
          mode: input.mode,
          context: input.context,
        }),
      },
    ],
  };

  if (modelUsesGpt5ReasoningConstraints(input.model)) {
    // Required for temperature support on gpt-5.2; also keeps latency down.
    (params as { reasoning?: { effort: string } }).reasoning = {
      effort: "none",
    };
    params.temperature = input.temperature;
  } else {
    params.temperature = input.temperature;
  }

  return params;
}

export type OpenAiDesignCritiqueCallResult = {
  /** Raw parsed JSON — caller must validate with validateDesignCritique. */
  raw: unknown;
  requestId: string;
  openaiRequestId: string | null;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseStatus: string | null;
  httpStatus: number | null;
  structuredParseOk: boolean;
  configuredMaxOutputTokens: number;
  incompleteReason: string | null;
  retriedForOutputLimit: boolean;
};

function captureResponseOpenAiId(
  response: OpenAI.Responses.Response,
): string | null {
  return (
    extractOpenAiRequestId(response) ??
    (typeof response.id === "string" && response.id ? response.id : null)
  );
}

function readIncompleteReason(
  response: OpenAI.Responses.Response,
): string | null {
  const reason = (
    response as { incomplete_details?: { reason?: string | null } }
  ).incomplete_details?.reason;
  return typeof reason === "string" && reason ? reason : null;
}

function extractResponseUsage(response: OpenAI.Responses.Response): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
} {
  const usage = response.usage;
  return {
    promptTokens: usage?.input_tokens ?? null,
    completionTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

/**
 * Shared critique runtime resolution — production critique and schema probe
 * must use the same output budget / temperature / timeout.
 */
export function resolveCritiqueProviderRuntime(
  options: DesignCritiqueProviderOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): {
  model: string;
  critiqueOutput: OpenAiCritiqueOutputConfig;
  maxRetries: number;
  retryBaseDelayMs: number;
} {
  const critiqueOutput = resolveOpenAiCritiqueOutputConfig(env, {
    maxOutputTokens: options.maxOutputTokens,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
  });
  const base = resolveOpenAiRuntimeConfig(env, {
    model: options.model?.trim() || undefined,
    maxRetries: options.maxRetries ?? 1,
    retryBaseDelayMs: options.retryBaseDelayMs,
  });
  return {
    model: base.model,
    critiqueOutput,
    maxRetries: base.maxRetries,
    retryBaseDelayMs: base.retryBaseDelayMs,
  };
}

/**
 * Call OpenAI Responses API for a structured design critique.
 * On incomplete/max_output_tokens only: one bounded retry with a larger budget
 * and compact prompt instructions. Never retries incomplete responses in a loop.
 */
export async function runOpenAiDesignCritique(
  input: {
    request: string;
    mode: DesignCritiqueMode;
    context: DesignCritiqueContext;
  },
  options: DesignCritiqueProviderOptions = {},
): Promise<OpenAiDesignCritiqueCallResult> {
  const key =
    options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  if (!key && !options.client) {
    throw new AiError(
      "not_configured",
      "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
      { status: 503 },
    );
  }

  const runtime = resolveCritiqueProviderRuntime(options);
  const { critiqueOutput } = runtime;

  const client: OpenAiResponsesClient =
    options.client ??
    (new OpenAI({
      apiKey: key,
      timeout: critiqueOutput.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAiResponsesClient);

  const createRequestId = options.createRequestId ?? createAiRequestId;
  const started = Date.now();
  const requestId = options.atlasRequestId?.trim() || createRequestId();

  let usage = {
    promptTokens: null as number | null,
    completionTokens: null as number | null,
    totalTokens: null as number | null,
  };
  let openaiRequestId: string | null = null;
  let responseStatus: string | null = null;
  let incompleteReason: string | null = null;
  let configuredMaxOutputTokens = critiqueOutput.maxOutputTokens;
  let retriedForOutputLimit = false;

  const createOnce = async (args: {
    maxOutputTokens: number;
    compact: boolean;
  }): Promise<OpenAI.Responses.Response> => {
    const params = buildOpenAiDesignCritiqueParams({
      model: runtime.model,
      temperature: critiqueOutput.temperature,
      maxOutputTokens: args.maxOutputTokens,
      request: input.request,
      mode: input.mode,
      context: input.context,
      compact: args.compact,
    });

    return withAiRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          critiqueOutput.timeoutMs,
        );
        try {
          return await client.responses.create(params, {
            signal: controller.signal,
            headers: {
              "X-Client-Request-Id": requestId,
            },
          } as { signal?: AbortSignal; headers?: Record<string, string> });
        } catch (error) {
          openaiRequestId = extractOpenAiRequestId(error) ?? openaiRequestId;
          const categorized = categorizeOpenAiFailure(error);
          const original =
            error instanceof Error && error.message
              ? error.message.slice(0, 240)
              : categorized.message;
          const wrapped = new AiError(
            categorized.code === "unauthorized" ||
              categorized.code === "forbidden" ||
              categorized.code === "bad_request" ||
              categorized.code === "rate_limited" ||
              categorized.code === "not_configured" ||
              categorized.code === "provider_error" ||
              categorized.code === "invalid_response"
              ? categorized.code
              : "provider_error",
            categorized.category === "model" ||
              categorized.category === "schema" ||
              categorized.category === "unknown"
              ? original
              : categorized.message,
            { status: categorized.status ?? undefined, cause: error },
          );
          (
            wrapped as AiError & {
              category?: string;
              openaiRequestId?: string | null;
              failingFunction?: string;
            }
          ).category = categorized.category;
          (
            wrapped as AiError & { openaiRequestId?: string | null }
          ).openaiRequestId = openaiRequestId;
          (
            wrapped as AiError & { failingFunction?: string }
          ).failingFunction = "client.responses.create";
          throw wrapped;
        } finally {
          clearTimeout(timer);
        }
      },
      {
        // Transient HTTP retries only — incomplete/output_limit handled separately (once).
        retries: runtime.maxRetries,
        baseDelayMs: runtime.retryBaseDelayMs,
        sleep: options.sleep,
        shouldRetry: (error) => {
          const cat = categorizeOpenAiFailure(error).category;
          return isRetryableOpenAiCategory(cat);
        },
      },
    );
  };

  try {
    let response = await createOnce({
      maxOutputTokens: critiqueOutput.maxOutputTokens,
      compact: false,
    });
    configuredMaxOutputTokens = critiqueOutput.maxOutputTokens;
    openaiRequestId = captureResponseOpenAiId(response) ?? openaiRequestId;
    responseStatus = String(response.status ?? "completed");
    usage = extractResponseUsage(response);
    incompleteReason =
      responseStatus === "incomplete" ? readIncompleteReason(response) : null;

    let extracted = extractStructuredJsonFromResponse(response);

    const needsOutputLimitRetry =
      extracted.status === "incomplete" &&
      categorizeIncompleteReason(
        extracted.incompleteReason ?? incompleteReason,
      ) === "output_limit";

    if (needsOutputLimitRetry) {
      captureMessage({
        message: "ai.critique.output_limit_retry",
        level: "warning",
        context: {
          tags: { route: "ai.critique", provider: "openai" },
          extra: {
            event: "ai.critique.output_limit_retry",
            atlasRequestId: requestId,
            openaiRequestId,
            incompleteReason: extracted.incompleteReason ?? incompleteReason,
            configuredMaxOutputTokens: critiqueOutput.maxOutputTokens,
            retryMaxOutputTokens: critiqueOutput.retryMaxOutputTokens,
            model: runtime.model,
            responseStatus,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          },
        },
      });

      retriedForOutputLimit = true;
      response = await createOnce({
        maxOutputTokens: critiqueOutput.retryMaxOutputTokens,
        compact: true,
      });
      configuredMaxOutputTokens = critiqueOutput.retryMaxOutputTokens;
      openaiRequestId = captureResponseOpenAiId(response) ?? openaiRequestId;
      responseStatus = String(response.status ?? "completed");
      usage = extractResponseUsage(response);
      incompleteReason =
        responseStatus === "incomplete" ? readIncompleteReason(response) : null;
      extracted = extractStructuredJsonFromResponse(response);
    }

    // Never treat incomplete Responses as success — even if partial JSON parsed.
    if (extracted.status === "incomplete") {
      const err = errorFromStructuredExtraction(extracted);
      (err as AiError & { openaiRequestId?: string | null }).openaiRequestId =
        openaiRequestId;
      (err as AiError & { configuredMaxOutputTokens?: number }).configuredMaxOutputTokens =
        configuredMaxOutputTokens;
      (err as AiError & { retriedForOutputLimit?: boolean }).retriedForOutputLimit =
        retriedForOutputLimit;
      throw err;
    }
    if (extracted.status === "refusal" || extracted.status === "failed") {
      const err = errorFromStructuredExtraction(extracted);
      (err as AiError & { openaiRequestId?: string | null }).openaiRequestId =
        openaiRequestId;
      throw err;
    }
    if (extracted.json == null) {
      const err = errorFromStructuredExtraction(extracted);
      (err as AiError & { openaiRequestId?: string | null }).openaiRequestId =
        openaiRequestId;
      throw err;
    }

    const latencyMs = Date.now() - started;
    logAiCritique({
      provider: "openai",
      model: runtime.model,
      requestId,
      openaiRequestId,
      durationMs: latencyMs,
      ok: true,
      responseStatus,
      critiqueMode: input.mode,
      ...usage,
    });

    return {
      raw: extracted.json,
      requestId,
      openaiRequestId,
      model: runtime.model,
      latencyMs,
      responseStatus,
      httpStatus: 200,
      structuredParseOk: true,
      configuredMaxOutputTokens,
      incompleteReason: null,
      retriedForOutputLimit,
      ...usage,
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    const schemaDiag = sanitizeOpenAiSchemaError(error);
    const originalMessage =
      error instanceof Error && error.message
        ? error.message.slice(0, 240)
        : categorized.message;
    const message =
      categorized.category === "schema" ||
      categorized.category === "output_limit" ||
      categorized.category === "incomplete"
        ? categorized.message
        : categorized.category === "unknown" || categorized.category === "model"
          ? originalMessage || categorized.message
          : categorized.message;
    const mapped =
      error instanceof AiError
        ? error
        : new AiError("provider_error", message, {
            status: categorized.status ?? undefined,
            cause: error,
          });
    const latencyMs = Date.now() - started;
    openaiRequestId =
      (error as { openaiRequestId?: string | null })?.openaiRequestId ??
      categorized.openaiRequestId ??
      openaiRequestId ??
      extractOpenAiRequestId(error);
    const errIncompleteReason =
      (error as { incompleteReason?: string | null })?.incompleteReason ??
      categorized.incompleteReason ??
      incompleteReason;
    const errConfiguredTokens =
      (error as { configuredMaxOutputTokens?: number })
        ?.configuredMaxOutputTokens ?? configuredMaxOutputTokens;

    if (categorized.category === "schema") {
      captureMessage({
        message: "ai.critique.schema_rejected",
        level: "warning",
        context: {
          tags: { route: "ai.critique.schema", provider: "openai" },
          extra: {
            event: "ai.critique.schema_rejected",
            atlasRequestId: requestId,
            openaiRequestId,
            httpStatus: schemaDiag.httpStatus ?? categorized.status,
            openaiErrorCode: schemaDiag.openaiErrorCode,
            openaiErrorParam: schemaDiag.openaiErrorParam,
            schemaPath: schemaDiag.schemaPath,
            model: runtime.model,
          },
        },
      });
    }

    if (
      categorized.category === "output_limit" ||
      categorized.category === "incomplete"
    ) {
      captureMessage({
        message: "ai.critique.incomplete",
        level: "warning",
        context: {
          tags: { route: "ai.critique", provider: "openai" },
          extra: {
            event: "ai.critique.incomplete",
            atlasRequestId: requestId,
            openaiRequestId,
            category: categorized.category,
            incompleteReason: errIncompleteReason,
            configuredMaxOutputTokens: errConfiguredTokens,
            retriedForOutputLimit,
            model: runtime.model,
            responseStatus,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            latencyMs,
          },
        },
      });
    }

    logAiCritique({
      provider: "openai",
      model: runtime.model,
      requestId,
      openaiRequestId,
      durationMs: latencyMs,
      ok: false,
      code: mapped.code,
      category: categorized.category,
      responseStatus,
      critiqueMode: input.mode,
      ...usage,
    });
    const tagged = new AiError(mapped.code, mapped.message || message, {
      status: mapped.status,
      cause: error,
    });
    (tagged as AiError & { category?: string; openaiRequestId?: string | null }).category =
      categorized.category;
    (tagged as AiError & { openaiRequestId?: string | null }).openaiRequestId =
      openaiRequestId;
    (tagged as AiError & { failingFunction?: string }).failingFunction =
      "runOpenAiDesignCritique";
    (tagged as AiError & { schemaPath?: string | null }).schemaPath =
      schemaDiag.schemaPath;
    (tagged as AiError & { openaiErrorCode?: string | null }).openaiErrorCode =
      schemaDiag.openaiErrorCode;
    (tagged as AiError & { incompleteReason?: string | null }).incompleteReason =
      errIncompleteReason;
    (
      tagged as AiError & { configuredMaxOutputTokens?: number }
    ).configuredMaxOutputTokens = errConfiguredTokens;
    (tagged as AiError & { retriedForOutputLimit?: boolean }).retriedForOutputLimit =
      (error as { retriedForOutputLimit?: boolean })?.retriedForOutputLimit ??
      retriedForOutputLimit;
    throw tagged;
  }
}

/** Minimal structured probe — shared with /api/debug/ai-runtime/probe. */
export function buildOpenAiProbeParams(input: {
  model: string;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: input.model,
    max_output_tokens: 64,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: "atlas_ai_runtime_probe",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["ok"],
          properties: {
            ok: { type: "boolean" },
          },
        },
      },
    },
    input: [
      {
        role: "user",
        content: 'Return {"ok": true} as JSON.',
      },
    ],
  };
  if (modelUsesGpt5ReasoningConstraints(input.model)) {
    (params as { reasoning?: { effort: string } }).reasoning = {
      effort: "none",
    };
    params.temperature = 0;
  } else {
    params.temperature = 0;
  }
  return params;
}

export async function runOpenAiRuntimeProbe(
  options: DesignCritiqueProviderOptions = {},
): Promise<{
  success: true;
  provider: "openai";
  model: string;
  requestId: string;
  openaiRequestId: string | null;
  latencyMs: number;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
} | {
  success: false;
  category: string;
  message: string;
  requestId: string;
  openaiRequestId: string | null;
  model: string;
  latencyMs: number;
}> {
  const key =
    options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const config = resolveOpenAiRuntimeConfig(process.env, {
    model: options.model?.trim() || undefined,
    timeoutMs: options.timeoutMs ?? 20_000,
    maxRetries: 0,
  });
  const requestId = options.atlasRequestId?.trim() || createAiRequestId();
  const started = Date.now();

  if (!key && !options.client) {
    return {
      success: false,
      category: "provider_unavailable",
      message: "OPENAI_API_KEY is not configured.",
      requestId,
      openaiRequestId: null,
      model: config.model,
      latencyMs: Date.now() - started,
    };
  }

  const client: OpenAiResponsesClient =
    options.client ??
    (new OpenAI({
      apiKey: key,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAiResponsesClient);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create(
        buildOpenAiProbeParams({ model: config.model }),
        {
          signal: controller.signal,
          headers: { "X-Client-Request-Id": requestId },
        } as { signal?: AbortSignal; headers?: Record<string, string> },
      );
    } finally {
      clearTimeout(timer);
    }

    const openaiRequestId =
      extractOpenAiRequestId(response) ??
      (typeof response.id === "string" ? response.id : null);
    const extracted = extractStructuredJsonFromResponse(response);
    if (extracted.status !== "completed" || !extracted.json) {
      throw errorFromStructuredExtraction(extracted);
    }
    const usage = extractResponseUsage(response);
    return {
      success: true,
      provider: "openai",
      model: config.model,
      requestId,
      openaiRequestId,
      latencyMs: Date.now() - started,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      },
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    return {
      success: false,
      category: categorized.category,
      message: categorized.message,
      requestId,
      openaiRequestId: categorized.openaiRequestId,
      model: config.model,
      latencyMs: Date.now() - started,
    };
  }
}

/** Minimal safe dummy context for schema probes — no real project content. */
export function buildCritiqueSchemaProbeContext(): DesignCritiqueContext {
  return {
    businessName: "Probe Biz",
    industry: "general",
    businessDescription: "Schema probe only.",
    targetAudience: "local customers",
    primaryGoal: "win more customers",
    services: [{ title: "Service", description: "Description" }],
    homepageCopy: {
      heroEyebrow: "",
      heroTitle: "Welcome",
      heroDescription: "We help customers.",
      primaryCta: "Contact",
      secondaryCta: "",
      aboutTitle: "About",
      aboutBody: "About us.",
      contactTitle: "Contact",
      contactDescription: "",
      contactButtonText: "Send",
    },
    sectionOrder: ["hero", "about", "services", "contact"],
    enabledSections: ["hero", "about", "services", "contact"],
    designSystem: {
      language: "clean",
      label: "Clean",
      imageryStyle: "photo",
      motionStyle: "subtle",
      explanation: "",
    },
    colors: {
      primary: "#111111",
      secondary: "#222222",
      accent: "#333333",
      background: "#ffffff",
      theme: "light",
    },
    typography: { headingFont: "Inter", bodyFont: "Inter" },
    spacing: "default",
    buttons: "rounded",
    siteWidth: "default",
    templateId: "classic",
    creativePolish: {
      serviceIcons: false,
      motion: false,
      visualHierarchy: false,
      spacing: "default",
    },
    imagery: {
      hasHeroImage: false,
      galleryFilledSlots: 0,
      galleryTotalSlots: 6,
      hasLogo: false,
      libraryCount: 0,
      placeholderSummary: ["hero image missing"],
    },
    seo: {
      siteTitle: "Probe Biz",
      metaDescription: "Probe",
      socialTitle: "",
      socialDescription: "",
      robotsIndex: true,
    },
    maturity: {
      overallCompleteness: 40,
      maturityLevel: "draft",
      categoryScores: {},
    },
    atlasMemory: {
      preferredLayouts: [],
      preferredThemes: [],
      primaryGoal: "",
      businessTone: "",
      imageStyle: "",
      notes: [],
    },
    recentConversation: [],
    viewportHint: "desktop",
  };
}

export type CritiqueSchemaProbeResult = {
  success: boolean;
  category: string | null;
  message: string | null;
  requestId: string;
  openaiRequestId: string | null;
  model: string;
  latencyMs: number;
  httpStatus: number | null;
  openaiErrorCode: string | null;
  openaiErrorParam: string | null;
  schemaPath: string | null;
  schemaName: string;
  incompleteReason: string | null;
  configuredMaxOutputTokens: number;
  retriedForOutputLimit: boolean;
  responseStatus: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

/**
 * TEMPORARY: probe the real critique wire schema via the production critique path.
 * Same output budget / temperature / timeout as runOpenAiDesignCritique.
 * Returns only success/failure + sanitized diagnostics — never prompts or critique text.
 */
export async function runOpenAiCritiqueSchemaProbe(
  options: DesignCritiqueProviderOptions = {},
): Promise<CritiqueSchemaProbeResult> {
  const runtime = resolveCritiqueProviderRuntime(options);
  const requestId = options.atlasRequestId?.trim() || createAiRequestId();
  const started = Date.now();
  const schemaName = DESIGN_CRITIQUE_SCHEMA_NAME;
  const configuredMaxOutputTokens =
    runtime.critiqueOutput.maxOutputTokens;

  if (
    !options.client &&
    !(options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim())
  ) {
    return {
      success: false,
      category: "provider_unavailable",
      message: "OPENAI_API_KEY is not configured.",
      requestId,
      openaiRequestId: null,
      model: runtime.model,
      latencyMs: Date.now() - started,
      httpStatus: 503,
      openaiErrorCode: null,
      openaiErrorParam: null,
      schemaPath: null,
      schemaName,
      incompleteReason: null,
      configuredMaxOutputTokens,
      retriedForOutputLimit: false,
      responseStatus: null,
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    };
  }

  try {
    const result = await runOpenAiDesignCritique(
      {
        request: "Schema probe: return a minimal valid critique JSON.",
        mode: "critique",
        context: buildCritiqueSchemaProbeContext(),
      },
      {
        ...options,
        atlasRequestId: requestId,
        // Match production critique config exactly (no tiny probe override).
        maxOutputTokens: runtime.critiqueOutput.maxOutputTokens,
        temperature: runtime.critiqueOutput.temperature,
        timeoutMs: runtime.critiqueOutput.timeoutMs,
        maxRetries: 0,
      },
    );

    return {
      success: true,
      category: null,
      message: null,
      requestId: result.requestId,
      openaiRequestId: result.openaiRequestId,
      model: result.model,
      latencyMs: result.latencyMs,
      httpStatus: 200,
      openaiErrorCode: null,
      openaiErrorParam: null,
      schemaPath: null,
      schemaName,
      incompleteReason: null,
      configuredMaxOutputTokens: result.configuredMaxOutputTokens,
      retriedForOutputLimit: result.retriedForOutputLimit,
      responseStatus: result.responseStatus,
      usage: {
        inputTokens: result.promptTokens,
        outputTokens: result.completionTokens,
        totalTokens: result.totalTokens,
      },
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    const schemaDiag = sanitizeOpenAiSchemaError(error);
    const openaiRequestId =
      (error as { openaiRequestId?: string | null })?.openaiRequestId ??
      categorized.openaiRequestId ??
      schemaDiag.openaiRequestId;
    const incompleteReason =
      (error as { incompleteReason?: string | null })?.incompleteReason ??
      categorized.incompleteReason ??
      null;
    const configuredTokens =
      (error as { configuredMaxOutputTokens?: number })
        ?.configuredMaxOutputTokens ?? configuredMaxOutputTokens;
    const retriedForOutputLimit = Boolean(
      (error as { retriedForOutputLimit?: boolean })?.retriedForOutputLimit,
    );

    if (categorized.category === "schema") {
      captureMessage({
        message: "ai.critique.schema_probe_rejected",
        level: "warning",
        context: {
          tags: { route: "debug.ai-runtime.critique-schema-probe" },
          extra: {
            event: "ai.critique.schema_probe_rejected",
            atlasRequestId: requestId,
            openaiRequestId,
            httpStatus: schemaDiag.httpStatus ?? categorized.status,
            openaiErrorCode: schemaDiag.openaiErrorCode,
            openaiErrorParam: schemaDiag.openaiErrorParam,
            schemaPath: schemaDiag.schemaPath,
            model: runtime.model,
            schemaName,
            configuredMaxOutputTokens: configuredTokens,
          },
        },
      });
    }

    return {
      success: false,
      category: categorized.category,
      message: categorized.message,
      requestId,
      openaiRequestId,
      model: runtime.model,
      latencyMs: Date.now() - started,
      httpStatus: schemaDiag.httpStatus ?? categorized.status,
      openaiErrorCode: schemaDiag.openaiErrorCode,
      openaiErrorParam: schemaDiag.openaiErrorParam,
      schemaPath: schemaDiag.schemaPath,
      schemaName,
      incompleteReason,
      configuredMaxOutputTokens: configuredTokens,
      retriedForOutputLimit,
      responseStatus:
        categorized.category === "output_limit" ||
        categorized.category === "incomplete"
          ? "incomplete"
          : null,
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    };
  }
}
