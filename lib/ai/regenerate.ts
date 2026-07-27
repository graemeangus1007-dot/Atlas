/**
 * Section regeneration helpers (Sprint 20.1).
 */

import { AiError } from "@/lib/ai/errors";
import type {
  AiRegenerateSection,
  GenerateWebsiteInput,
  GeneratedWebsiteDraft,
  RegenerateSectionResult,
} from "@/lib/ai/types";
import { MockAiProvider } from "@/lib/ai/mock-provider";

const SECTIONS: AiRegenerateSection[] = ["hero", "about", "services"];

export function normalizeRegenerateSection(
  value: unknown,
): AiRegenerateSection {
  if (typeof value === "string" && (SECTIONS as string[]).includes(value)) {
    return value as AiRegenerateSection;
  }
  throw new AiError("bad_request", "section must be hero, about, or services.");
}

/** Apply a regenerated section patch without mutating other draft fields. */
export function applySectionPatch(
  current: GeneratedWebsiteDraft,
  patch: Partial<GeneratedWebsiteDraft>,
): GeneratedWebsiteDraft {
  return {
    ...current,
    ...patch,
    // Nested objects must not wipe unrelated siblings.
    contact: patch.contact ? { ...current.contact, ...patch.contact } : current.contact,
    seo: patch.seo ? { ...current.seo, ...patch.seo } : current.seo,
    services: patch.services ?? current.services,
    optionalSections: patch.optionalSections
      ? { ...current.optionalSections, ...patch.optionalSections }
      : current.optionalSections,
    brand: patch.brand ? { ...current.brand, ...patch.brand } : current.brand,
    layoutPreset: patch.layoutPreset ?? current.layoutPreset,
    mediaPlaceholders: patch.mediaPlaceholders ?? current.mediaPlaceholders,
    enabledSections: patch.enabledSections ?? current.enabledSections,
    contrastWarnings: patch.contrastWarnings ?? current.contrastWarnings,
  };
}

export async function regenerateDraftSection(input: {
  section: AiRegenerateSection;
  currentDraft: GeneratedWebsiteDraft;
  generateInput: GenerateWebsiteInput;
  variation?: number;
}): Promise<RegenerateSectionResult> {
  const provider = new MockAiProvider();
  return provider.regenerateSection!({
    ...input.generateInput,
    section: input.section,
    currentDraft: input.currentDraft,
    variation: input.variation,
  });
}
