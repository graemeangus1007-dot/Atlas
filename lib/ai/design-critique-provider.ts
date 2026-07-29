/**
 * OpenAI-backed design critique provider (Sprint 28.0A).
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
  createAiRequestId,
  logAiGeneration,
} from "@/lib/ai/openai-logging";
import {
  isTransientAiError,
  withAiRetry,
} from "@/lib/ai/openai-retry";
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
};

function mapOpenAiHttpError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : null;

  const message =
    error instanceof Error ? error.message : "OpenAI request failed.";

  if (status === 401 || status === 403) {
    return new AiError(
      "unauthorized",
      "OpenAI rejected the API key. Check OPENAI_API_KEY.",
      { status: 401, cause: error },
    );
  }
  if (status === 429) {
    return new AiError(
      "rate_limited",
      "OpenAI rate limit reached. Please try again shortly.",
      { status: 429, cause: error },
    );
  }
  if (
    /timeout|timed out|aborted|abort/i.test(message) ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return new AiError(
      "provider_error",
      "OpenAI critique request timed out. Please try again.",
      { status: 504, cause: error },
    );
  }

  return new AiError(
    "provider_error",
    "OpenAI could not complete the design critique. Please try again.",
    { status: status && status >= 400 ? status : 502, cause: error },
  );
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AiError("invalid_response", "OpenAI returned an empty response.");
  }
  if (/^```/m.test(trimmed)) {
    throw new AiError(
      "invalid_response",
      "OpenAI returned markdown instead of JSON.",
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new AiError("invalid_response", "OpenAI returned malformed JSON.");
  }
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
    text: {
      format: {
        type: "json_schema",
        name: DESIGN_CRITIQUE_SCHEMA_NAME,
        strict: true,
        schema: DESIGN_CRITIQUE_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
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
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

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
  const requestId = createRequestId();
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

  try {
    const response = await withAiRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
          return await client.responses.create(params, {
            signal: controller.signal,
          });
        } catch (error) {
          throw mapOpenAiHttpError(error);
        } finally {
          clearTimeout(timer);
        }
      },
      {
        retries: config.maxRetries,
        baseDelayMs: config.retryBaseDelayMs,
        sleep: options.sleep,
        shouldRetry: isTransientAiError,
      },
    );

    usage = extractResponseUsage(response);
    const content = response.output_text;
    if (typeof content !== "string" || !content.trim()) {
      throw new AiError(
        "invalid_response",
        "OpenAI returned no JSON content.",
      );
    }

    // Parse only here — schema validation happens outside withAiRetry
    // so invalid_response is never blindly retried.
    const raw = parseJsonObject(content);

    const latencyMs = Date.now() - started;
    logAiGeneration({
      provider: "openai",
      model: config.model,
      requestId,
      durationMs: latencyMs,
      ok: true,
      ...usage,
    });

    return {
      raw,
      requestId,
      model: config.model,
      latencyMs,
      ...usage,
    };
  } catch (error) {
    const mapped = error instanceof AiError ? error : mapOpenAiHttpError(error);
    const latencyMs = Date.now() - started;
    logAiGeneration({
      provider: "openai",
      model: config.model,
      requestId,
      durationMs: latencyMs,
      ok: false,
      code: mapped.code,
      ...usage,
    });
    throw mapped;
  }
}
