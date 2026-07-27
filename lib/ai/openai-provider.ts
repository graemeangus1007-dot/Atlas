import { AiError } from "@/lib/ai/errors";
import {
  buildWebsiteSystemPrompt,
  buildWebsiteUserPrompt,
} from "@/lib/ai/prompts";
import type {
  AiProvider,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
} from "@/lib/ai/types";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

type OpenAiProviderOptions = {
  apiKey?: string | null;
  model?: string | null;
};

/**
 * OpenAI-backed provider (Sprint 20.0A foundation).
 * Full website generation is intentionally not wired yet — selecting this
 * provider returns a clear not_implemented result until Sprint 20.0B+.
 * Construction still validates that an API key is present when enabled.
 */
export class OpenAiWebsiteProvider implements AiProvider {
  readonly id = "openai" as const;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: OpenAiProviderOptions = {}) {
    const key =
      options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    if (!key) {
      throw new AiError(
        "not_configured",
        "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
        { status: 503 },
      );
    }
    this.apiKey = key;
    this.model =
      options.model?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      DEFAULT_OPENAI_MODEL;
  }

  async generateWebsite(
    input: GenerateWebsiteInput,
  ): Promise<GenerateWebsiteResult> {
    // Keep prompts ready so 20.0B can call the Responses / Chat Completions API.
    void buildWebsiteSystemPrompt();
    void buildWebsiteUserPrompt(input);
    void this.apiKey;
    void this.model;

    return {
      ok: false,
      provider: "openai",
      code: "not_implemented",
      message:
        "OpenAI website generation is not enabled yet. Set AI_PROVIDER=mock for local UI development.",
    };
  }
}
