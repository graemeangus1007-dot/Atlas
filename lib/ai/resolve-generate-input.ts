/**
 * Resolve generate-website identity fields with explicit-input precedence.
 * Questionnaire / request body always beat project-row placeholders.
 */

import type { GenerateWebsiteQuestionnaire } from "@/lib/ai/types";

/** First non-empty trimmed string wins; otherwise "". */
export function coalesceNonEmpty(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export type GenerateIdentitySources = {
  businessName?: string | null;
  businessType?: string | null;
  description?: string | null;
  questionnaire?: GenerateWebsiteQuestionnaire | null;
};

export type ProjectIdentityFallback = {
  business_name?: string | null;
  business_type?: string | null;
  description?: string | null;
};

/**
 * Merge request + questionnaire + project row.
 * Explicit questionnaire / body values must never be replaced by project defaults.
 */
export function resolveGenerateIdentity(
  request: GenerateIdentitySources,
  project: ProjectIdentityFallback = {},
): {
  businessName: string;
  businessType: string;
  description: string;
} {
  const q = request.questionnaire;
  return {
    businessName: coalesceNonEmpty(
      request.businessName,
      q?.businessName,
      project.business_name,
    ),
    businessType: coalesceNonEmpty(
      request.businessType,
      q?.businessType,
      project.business_type,
    ),
    description: coalesceNonEmpty(
      request.description,
      q?.description,
      project.description,
    ),
  };
}
