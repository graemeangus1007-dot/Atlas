/**
 * OpenAI provider cost / reliability controls (Sprint 21.0A).
 */

/** Default model when OPENAI_MODEL is unset. */
export const DEFAULT_OPENAI_MODEL = "gpt-5.2";

export const OPENAI_DEFAULTS = {
  /** Sampling temperature for website drafts. */
  temperature: 0.4,
  /** Max output tokens for a full website draft. */
  maxOutputTokens: 4096,
  /** Per-request timeout in milliseconds. */
  timeoutMs: 45_000,
  /** Number of retries after the first attempt (transient failures only). */
  maxRetries: 2,
  /** Base delay for exponential backoff (ms). */
  retryBaseDelayMs: 500,
} as const;

export type OpenAiRuntimeConfig = {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
};

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value?.trim()) return fallback;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const n = Number.parseFloat(value.trim());
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve runtime controls from env (with safe defaults).
 * Optional overrides are used by tests.
 */
export function resolveOpenAiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<OpenAiRuntimeConfig> = {},
): OpenAiRuntimeConfig {
  return {
    model:
      overrides.model ??
      env.OPENAI_MODEL?.trim() ??
      DEFAULT_OPENAI_MODEL,
    temperature:
      overrides.temperature ??
      Math.min(
        2,
        Math.max(
          0,
          parseNumber(env.OPENAI_TEMPERATURE, OPENAI_DEFAULTS.temperature),
        ),
      ),
    maxOutputTokens:
      overrides.maxOutputTokens ??
      parsePositiveInt(
        env.OPENAI_MAX_OUTPUT_TOKENS,
        OPENAI_DEFAULTS.maxOutputTokens,
      ),
    timeoutMs:
      overrides.timeoutMs ??
      parsePositiveInt(env.OPENAI_TIMEOUT_MS, OPENAI_DEFAULTS.timeoutMs),
    maxRetries:
      overrides.maxRetries ??
      parsePositiveInt(env.OPENAI_MAX_RETRIES, OPENAI_DEFAULTS.maxRetries),
    retryBaseDelayMs:
      overrides.retryBaseDelayMs ??
      parsePositiveInt(
        env.OPENAI_RETRY_BASE_DELAY_MS,
        OPENAI_DEFAULTS.retryBaseDelayMs,
      ),
  };
}
