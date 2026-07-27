/**
 * AI provider factory (Sprint 20.0A).
 * Defaults to mock so Atlas builds and runs without OPENAI_API_KEY.
 */

import { AiError } from "@/lib/ai/errors";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import {
  DEFAULT_OPENAI_MODEL,
  OpenAiWebsiteProvider,
} from "@/lib/ai/openai-provider";
import type { AiProvider, AiProviderId } from "@/lib/ai/types";

export { DEFAULT_OPENAI_MODEL };

/** Resolve AI_PROVIDER from env (or override). Defaults to mock. */
export function getAiProviderId(
  override?: string | null,
): AiProviderId {
  const raw = (override ?? process.env.AI_PROVIDER)?.trim().toLowerCase();
  if (raw === "openai") return "openai";
  return "mock";
}

export function getOpenAiModel(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

/**
 * Construct the active AI provider (server-only for openai).
 */
export function createAiProvider(
  override?: string | null,
): AiProvider {
  switch (getAiProviderId(override)) {
    case "openai":
      return new OpenAiWebsiteProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: getOpenAiModel(),
      });
    case "mock":
    default:
      return new MockAiProvider();
  }
}

/** Same as createAiProvider but surfaces AiError instead of throwing raw. */
export function tryCreateAiProvider(
  override?: string | null,
): AiProvider {
  try {
    return createAiProvider(override);
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError(
      "provider_error",
      "Could not initialize the AI provider.",
      { cause: error },
    );
  }
}
