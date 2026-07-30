/**
 * OpenAI-backed design critique provider (Sprint 28.0A / 28.0B).
 * Server-only — never import into client bundles (use dynamic import).
 */

import OpenAI from "openai";
import { AiError } from "@/lib/ai/errors";
import {
  resolveOpenAiRuntimeConfig,
  type OpenAiRuntimeConfig,
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
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  const system = [
    buildDesignCritiqueSystemPrompt(),
    buildDesignCritiqueDeveloperPrompt(input.mode),
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
};

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
 * Call OpenAI Responses API for a structured design critique.
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

  const config: OpenAiRuntimeConfig = resolveOpenAiRuntimeConfig(process.env, {
    model: options.model?.trim() || undefined,
    temperature: options.temperature ?? 0.35,
    maxOutputTokens: options.maxOutputTokens ?? 3500,
    // Critique prompts + structured JSON routinely exceed the 45s draft default.
    timeoutMs: options.timeoutMs ?? 90_000,
    maxRetries: options.maxRetries ?? 1,
    retryBaseDelayMs: options.retryBaseDelayMs,
  });

  const client: OpenAiResponsesClient =
    options.client ??
    (new OpenAI({
      apiKey: key,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAiResponsesClient);

  const createRequestId = options.createRequestId ?? createAiRequestId;
  const started = Date.now();
  const requestId = options.atlasRequestId?.trim() || createRequestId();
  const params = buildOpenAiDesignCritiqueParams({
    model: config.model,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    request: input.request,
    mode: input.mode,
    context: input.context,
  });

  let usage = {
    promptTokens: null as number | null,
    completionTokens: null as number | null,
    totalTokens: null as number | null,
  };
  let openaiRequestId: string | null = null;
  let responseStatus: string | null = null;

  try {
    const response = await withAiRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
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
            // Prefer the OpenAI error text for model/schema diagnosis.
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
        retries: config.maxRetries,
        baseDelayMs: config.retryBaseDelayMs,
        sleep: options.sleep,
        shouldRetry: (error) => {
          const cat = categorizeOpenAiFailure(error).category;
          return isRetryableOpenAiCategory(cat);
        },
      },
    );

    openaiRequestId =
      extractOpenAiRequestId(response) ??
      (typeof response.id === "string" ? response.id : null);
    responseStatus = String(response.status ?? "completed");
    usage = extractResponseUsage(response);

    const extracted = extractStructuredJsonFromResponse(response);
    // Prefer usable JSON even when status is incomplete — secondary validation decides.
    if (extracted.json == null) {
      throw errorFromStructuredExtraction(extracted);
    }
    if (extracted.status === "refusal" || extracted.status === "failed") {
      throw errorFromStructuredExtraction(extracted);
    }

    const latencyMs = Date.now() - started;
    logAiCritique({
      provider: "openai",
      model: config.model,
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
      model: config.model,
      latencyMs,
      responseStatus,
      httpStatus: 200,
      structuredParseOk: true,
      ...usage,
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    const schemaDiag = sanitizeOpenAiSchemaError(error);
    // Keep the original OpenAI message when categorization is generic.
    const originalMessage =
      error instanceof Error && error.message
        ? error.message.slice(0, 240)
        : categorized.message;
    const message =
      categorized.category === "schema"
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
      categorized.openaiRequestId ?? openaiRequestId ?? extractOpenAiRequestId(error);

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
            model: config.model,
            // Never prompts / project content / raw bodies
          },
        },
      });
    }

    logAiCritique({
      provider: "openai",
      model: config.model,
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
    const tagged = new AiError(
      mapped.code,
      mapped.message || message,
      {
        status: mapped.status,
        cause: error,
      },
    );
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

/**
 * TEMPORARY: probe the real critique wire schema (not the tiny diagnostic schema).
 * Returns only success/failure + sanitized diagnostics — never prompts or critique text.
 */
export async function runOpenAiCritiqueSchemaProbe(
  options: DesignCritiqueProviderOptions = {},
): Promise<{
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
}> {
  const key =
    options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
  const config = resolveOpenAiRuntimeConfig(process.env, {
    model: options.model?.trim() || undefined,
    temperature: 0,
    maxOutputTokens: 400,
    timeoutMs: options.timeoutMs ?? 45_000,
    maxRetries: 0,
  });
  const requestId = options.atlasRequestId?.trim() || createAiRequestId();
  const started = Date.now();
  const schemaName = DESIGN_CRITIQUE_SCHEMA_NAME;

  if (!key && !options.client) {
    return {
      success: false,
      category: "provider_unavailable",
      message: "OPENAI_API_KEY is not configured.",
      requestId,
      openaiRequestId: null,
      model: config.model,
      latencyMs: Date.now() - started,
      httpStatus: 503,
      openaiErrorCode: null,
      openaiErrorParam: null,
      schemaPath: null,
      schemaName,
    };
  }

  const client: OpenAiResponsesClient =
    options.client ??
    (new OpenAI({
      apiKey: key,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAiResponsesClient);

  const params = buildOpenAiDesignCritiqueParams({
    model: config.model,
    temperature: 0,
    maxOutputTokens: config.maxOutputTokens,
    request: "Schema probe: return a minimal valid critique JSON.",
    mode: "critique",
    context: buildCritiqueSchemaProbeContext(),
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create(params, {
        signal: controller.signal,
        headers: { "X-Client-Request-Id": requestId },
      } as { signal?: AbortSignal; headers?: Record<string, string> });
    } finally {
      clearTimeout(timer);
    }

    const openaiRequestId =
      extractOpenAiRequestId(response) ??
      (typeof response.id === "string" ? response.id : null);
    const extracted = extractStructuredJsonFromResponse(response);
    if (extracted.json == null) {
      throw errorFromStructuredExtraction(extracted);
    }

    return {
      success: true,
      category: null,
      message: null,
      requestId,
      openaiRequestId,
      model: config.model,
      latencyMs: Date.now() - started,
      httpStatus: 200,
      openaiErrorCode: null,
      openaiErrorParam: null,
      schemaPath: null,
      schemaName,
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    const schemaDiag = sanitizeOpenAiSchemaError(error);
    if (categorized.category === "schema") {
      captureMessage({
        message: "ai.critique.schema_probe_rejected",
        level: "warning",
        context: {
          tags: { route: "debug.ai-runtime.critique-schema-probe" },
          extra: {
            event: "ai.critique.schema_probe_rejected",
            atlasRequestId: requestId,
            openaiRequestId:
              schemaDiag.openaiRequestId ?? categorized.openaiRequestId,
            httpStatus: schemaDiag.httpStatus ?? categorized.status,
            openaiErrorCode: schemaDiag.openaiErrorCode,
            openaiErrorParam: schemaDiag.openaiErrorParam,
            schemaPath: schemaDiag.schemaPath,
            model: config.model,
            schemaName,
          },
        },
      });
    }
    return {
      success: false,
      category: categorized.category,
      message: categorized.message,
      requestId,
      openaiRequestId:
        schemaDiag.openaiRequestId ?? categorized.openaiRequestId,
      model: config.model,
      latencyMs: Date.now() - started,
      httpStatus: schemaDiag.httpStatus ?? categorized.status,
      openaiErrorCode: schemaDiag.openaiErrorCode,
      openaiErrorParam: schemaDiag.openaiErrorParam,
      schemaPath: schemaDiag.schemaPath,
      schemaName,
    };
  }
}
