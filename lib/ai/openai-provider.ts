/**
 * OpenAI-backed website draft provider (Sprint 21.0A).
 * Uses the Responses API + strict Structured Outputs.
 * Server-only — never import into client bundles.
 */

import OpenAI from "openai";
import { AiError } from "@/lib/ai/errors";
import {
  resolveOpenAiRuntimeConfig,
  type OpenAiRuntimeConfig,
} from "@/lib/ai/openai-config";
import {
  WEBSITE_DRAFT_JSON_SCHEMA,
  WEBSITE_DRAFT_SCHEMA_NAME,
} from "@/lib/ai/openai-draft-schema";
import {
  createAiRequestId,
  logAiGeneration,
} from "@/lib/ai/openai-logging";
import {
  isTransientAiError,
  withAiRetry,
} from "@/lib/ai/openai-retry";
import {
  buildWebsiteDeveloperPrompt,
  buildWebsiteSystemPrompt,
  buildWebsiteUserPrompt,
} from "@/lib/ai/prompts";
import { validateGeneratedWebsiteDraft } from "@/lib/ai/validate-draft";
import type {
  AiProvider,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
} from "@/lib/ai/types";

export { DEFAULT_OPENAI_MODEL } from "@/lib/ai/openai-config";
export {
  WEBSITE_DRAFT_JSON_SCHEMA,
  WEBSITE_DRAFT_SCHEMA_NAME,
} from "@/lib/ai/openai-draft-schema";

/** Minimal Responses API surface for dependency injection in tests. */
export type OpenAiResponsesClient = {
  responses: {
    create: (
      body: OpenAI.Responses.ResponseCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ) => Promise<OpenAI.Responses.Response>;
  };
};

export type OpenAiProviderOptions = {
  apiKey?: string | null;
  model?: string | null;
  /** Injected client (unit tests). */
  client?: OpenAiResponsesClient;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Override sleep for deterministic retry tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Override request-id generator (tests). */
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
    error instanceof Error
      ? error.message
      : "OpenAI request failed.";

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
      "OpenAI request timed out. Please try again.",
      { status: 504, cause: error },
    );
  }

  // Never echo raw OpenAI payloads that might include sensitive fragments.
  return new AiError(
    "provider_error",
    "OpenAI could not generate a website draft. Please try again.",
    { status: status && status >= 400 ? status : 502, cause: error },
  );
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AiError(
      "invalid_response",
      "OpenAI returned an empty response.",
    );
  }
  // Reject markdown fences explicitly — we require structured JSON only.
  if (/^```/m.test(trimmed)) {
    throw new AiError(
      "invalid_response",
      "OpenAI returned markdown instead of JSON.",
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new AiError(
      "invalid_response",
      "OpenAI returned malformed JSON.",
    );
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

/**
 * Build the Responses API request body (exported for unit tests).
 */
export function buildOpenAiWebsiteResponseParams(input: {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  generateInput: GenerateWebsiteInput;
}): OpenAI.Responses.ResponseCreateParamsNonStreaming {
  return {
    model: input.model,
    temperature: input.temperature,
    max_output_tokens: input.maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: WEBSITE_DRAFT_SCHEMA_NAME,
        strict: true,
        schema: WEBSITE_DRAFT_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    input: [
      { role: "system", content: buildWebsiteSystemPrompt() },
      { role: "developer", content: buildWebsiteDeveloperPrompt() },
      { role: "user", content: buildWebsiteUserPrompt(input.generateInput) },
    ],
  };
}

/**
 * OpenAI website generation provider.
 * Mock remains available via AI_PROVIDER=mock.
 */
export class OpenAiWebsiteProvider implements AiProvider {
  readonly id = "openai" as const;

  private readonly client: OpenAiResponsesClient;
  private readonly config: OpenAiRuntimeConfig;
  private readonly sleep?: (ms: number) => Promise<void>;
  private readonly createRequestId: () => string;

  constructor(options: OpenAiProviderOptions = {}) {
    const key =
      options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!key && !options.client) {
      throw new AiError(
        "not_configured",
        "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
        { status: 503 },
      );
    }

    this.config = resolveOpenAiRuntimeConfig(process.env, {
      model: options.model?.trim() || undefined,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      retryBaseDelayMs: options.retryBaseDelayMs,
    });

    this.client =
      options.client ??
      (new OpenAI({
        apiKey: key,
        timeout: this.config.timeoutMs,
        maxRetries: 0, // Atlas owns retry / backoff.
      }) as unknown as OpenAiResponsesClient);

    this.sleep = options.sleep;
    this.createRequestId = options.createRequestId ?? createAiRequestId;
  }

  async generateWebsite(
    input: GenerateWebsiteInput,
  ): Promise<GenerateWebsiteResult> {
    const started = Date.now();
    const requestId = this.createRequestId();
    const params = buildOpenAiWebsiteResponseParams({
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      generateInput: input,
    });

    let usage: {
      promptTokens?: number | null;
      completionTokens?: number | null;
      totalTokens?: number | null;
    } = {};

    try {
      const response = await withAiRetry(
        async () => {
          const controller = new AbortController();
          const timer = setTimeout(
            () => controller.abort(),
            this.config.timeoutMs,
          );
          try {
            return await this.client.responses.create(params, {
              signal: controller.signal,
            });
          } catch (error) {
            throw mapOpenAiHttpError(error);
          } finally {
            clearTimeout(timer);
          }
        },
        {
          retries: this.config.maxRetries,
          baseDelayMs: this.config.retryBaseDelayMs,
          sleep: this.sleep,
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

      const parsed = parseJsonObject(content);
      // Validation failures must not be retried (thrown outside withAiRetry).
      let draft;
      try {
        draft = validateGeneratedWebsiteDraft(parsed);
      } catch (error) {
        if (error instanceof AiError) {
          throw new AiError(
            "invalid_response",
            "OpenAI draft failed schema validation.",
            { cause: error },
          );
        }
        throw new AiError(
          "invalid_response",
          "OpenAI draft failed schema validation.",
          { cause: error },
        );
      }

      const durationMs = Date.now() - started;
      logAiGeneration({
        provider: this.id,
        model: this.config.model,
        requestId,
        durationMs,
        ok: true,
        ...usage,
      });

      return {
        ok: true,
        provider: this.id,
        draft,
        durationMs,
      };
    } catch (error) {
      const mapped =
        error instanceof AiError ? error : mapOpenAiHttpError(error);
      const durationMs = Date.now() - started;
      logAiGeneration({
        provider: this.id,
        model: this.config.model,
        requestId,
        durationMs,
        ok: false,
        code: mapped.code,
        ...usage,
      });

      return {
        ok: false,
        provider: this.id,
        code: mapped.code,
        message: mapped.message,
      };
    }
  }
}
