/**
 * Website draft generation orchestration (Sprint 20.0A).
 */

import { AiError, isAiError, safeAiErrorMessage } from "@/lib/ai/errors";
import { createAiProvider } from "@/lib/ai/provider";
import type {
  AiProvider,
  GenerateWebsiteInput,
  GenerateWebsiteResult,
} from "@/lib/ai/types";

export function normalizeGenerateWebsiteInput(
  raw: Partial<GenerateWebsiteInput> & { projectId?: string },
): GenerateWebsiteInput {
  const projectId = raw.projectId?.trim() ?? "";
  if (!projectId) {
    throw new AiError("bad_request", "projectId is required.");
  }

  return {
    projectId,
    businessName: (raw.businessName ?? "").trim(),
    businessType: (raw.businessType ?? "").trim(),
    description: (raw.description ?? "").trim(),
    goals: Array.isArray(raw.goals)
      ? raw.goals
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [],
  };
}

/**
 * Generate a website draft via the configured AI provider.
 * Does not persist to the database — callers decide how to apply the draft.
 */
export async function generateWebsiteDraft(
  input: GenerateWebsiteInput,
  provider?: AiProvider,
): Promise<GenerateWebsiteResult> {
  const active = provider ?? createAiProvider();
  try {
    return await active.generateWebsite(input);
  } catch (error) {
    if (isAiError(error)) {
      return {
        ok: false,
        provider: active.id,
        code: error.code,
        message: error.message,
      };
    }
    return {
      ok: false,
      provider: active.id,
      code: "provider_error",
      message: safeAiErrorMessage(error),
    };
  }
}
