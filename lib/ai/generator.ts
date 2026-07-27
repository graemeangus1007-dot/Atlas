/**
 * Website draft generation orchestration (Sprint 20.0A).
 */

import { AiError, isAiError, safeAiErrorMessage } from "@/lib/ai/errors";
import { createAiProvider } from "@/lib/ai/provider";
import { coalesceNonEmpty } from "@/lib/ai/resolve-generate-input";
import type {
  AiProvider,
  GenerateWebsiteInput,
  GenerateWebsiteQuestionnaire,
  GenerateWebsiteResult,
} from "@/lib/ai/types";

function normalizeQuestionnaire(
  raw: GenerateWebsiteQuestionnaire | undefined,
): GenerateWebsiteQuestionnaire | undefined {
  if (!raw) return undefined;
  return {
    businessName: coalesceNonEmpty(raw.businessName) || undefined,
    businessType: coalesceNonEmpty(raw.businessType) || undefined,
    description: coalesceNonEmpty(raw.description) || undefined,
    yearsInBusiness: raw.yearsInBusiness?.trim() || undefined,
    primaryServices: Array.isArray(raw.primaryServices)
      ? raw.primaryServices
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12)
      : undefined,
    secondaryServices: Array.isArray(raw.secondaryServices)
      ? raw.secondaryServices
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12)
      : undefined,
    targetCustomer: raw.targetCustomer?.trim() || undefined,
    serviceArea: raw.serviceArea?.trim() || undefined,
    tone: raw.tone?.trim() || undefined,
    primaryColor: raw.primaryColor?.trim() || undefined,
    accentColor: raw.accentColor?.trim() || undefined,
    phone: raw.phone?.trim() || undefined,
    email: raw.email?.trim() || undefined,
    address: raw.address?.trim() || undefined,
    website: raw.website?.trim() || undefined,
    facebook: raw.facebook?.trim() || undefined,
    instagram: raw.instagram?.trim() || undefined,
  };
}

export function normalizeGenerateWebsiteInput(
  raw: Partial<GenerateWebsiteInput> & { projectId?: string },
): GenerateWebsiteInput {
  const projectId = raw.projectId?.trim() ?? "";
  if (!projectId) {
    throw new AiError("bad_request", "projectId is required.");
  }

  const questionnaire = normalizeQuestionnaire(raw.questionnaire);

  return {
    projectId,
    businessName: coalesceNonEmpty(
      raw.businessName,
      questionnaire?.businessName,
    ),
    businessType: coalesceNonEmpty(
      raw.businessType,
      questionnaire?.businessType,
    ),
    description: coalesceNonEmpty(raw.description, questionnaire?.description),
    goals: Array.isArray(raw.goals)
      ? raw.goals
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [],
    questionnaire,
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
