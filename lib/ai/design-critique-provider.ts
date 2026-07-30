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
  DESIGN_CRITIQUE_JSON_SCHEMA,
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
  toOpenAiStrictSchema,
} from "@/lib/ai/openai-structured-output";
import type { OpenAiResponsesClient } from "@/lib/ai/openai-provider";

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

export function buildOpenAiDesignCritiqueParams(input: {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  request: string;
  mode: DesignCritiqueMode;
  context: DesignCritiqueContext;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  return {
    model: input.model,
    temperature: input.temperature,
    max_output_tokens: input.maxOutputTokens,
    store: false,
    text: {
      format: {
        type: "json_schema",
        name: DESIGN_CRITIQUE_SCHEMA_NAME,
        strict: true,
        schema: toOpenAiStrictSchema(DESIGN_CRITIQUE_JSON_SCHEMA),
      },
    },
    input: [
      { role: "system", content: buildDesignCritiqueSystemPrompt() },
      {
        role: "developer",
        content: buildDesignCritiqueDeveloperPrompt(input.mode),
      },
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
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
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
          throw new AiError(
            categorized.code === "unauthorized" ||
              categorized.code === "forbidden" ||
              categorized.code === "bad_request" ||
              categorized.code === "rate_limited" ||
              categorized.code === "not_configured" ||
              categorized.code === "provider_error" ||
              categorized.code === "invalid_response"
              ? categorized.code
              : "provider_error",
            categorized.message,
            { status: categorized.status ?? undefined, cause: error },
          );
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
    if (extracted.status === "incomplete" && extracted.json) {
      // Prefer incomplete-with-json over hard fail only when JSON is usable;
      // still treat as incomplete so callers can categorize correctly.
      throw errorFromStructuredExtraction(extracted);
    }
    if (extracted.status !== "completed" || extracted.json == null) {
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
      ...usage,
    };
  } catch (error) {
    const categorized = categorizeOpenAiFailure(error);
    const mapped =
      error instanceof AiError
        ? error
        : new AiError("provider_error", categorized.message, {
            status: categorized.status ?? undefined,
            cause: error,
          });
    const latencyMs = Date.now() - started;
    openaiRequestId =
      categorized.openaiRequestId ?? openaiRequestId ?? extractOpenAiRequestId(error);
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
    // Preserve category on the error message prefix for runDesignCritique mapping.
    const tagged = new AiError(mapped.code, mapped.message, {
      status: mapped.status,
      cause: error,
    });
    (tagged as AiError & { category?: string; openaiRequestId?: string | null }).category =
      categorized.category;
    (tagged as AiError & { openaiRequestId?: string | null }).openaiRequestId =
      openaiRequestId;
    throw tagged;
  }
}

/** Minimal structured probe — shared with /api/debug/ai-runtime/probe. */
export function buildOpenAiProbeParams(input: {
  model: string;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  return {
    model: input.model,
    temperature: 0,
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
