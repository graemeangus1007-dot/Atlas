/**
 * Taste polish scope contract — narrow allowed mutations.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { BusinessProject } from "@/types/business-project";

/** Root fields taste polish may touch. */
export const TASTE_POLISH_ALLOWED_ROOTS = [
  "creativePolish",
  "heroOverlay",
  "heroTreatment",
  "buttonStyle",
  "atlasActionMemory",
  "atlasMemory",
  "updatedAt",
  "designAssistant",
] as const;

/** Domains that must never change during taste polish. */
export const TASTE_POLISH_FORBIDDEN_ROOTS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "headingFont",
  "bodyFont",
  "businessName",
  "businessType",
  "description",
  "heroHeadline",
  "heroSubheadline",
  "primaryCta",
  "secondaryCta",
  "services",
  "contact",
  "seo",
  "sectionOrder",
  "templateId",
  "siteWidth",
  "heroImageId",
  "heroComposition",
  "galleryImageIds",
  "galleryInteraction",
  "mediaLibrary",
  "designSections",
  "componentSurfaces",
  "publish",
] as const;

const ALLOWED_OPS = new Set([
  "setCreativePolish",
  "setHeroOverlay",
  "setHeroTreatment",
  "setButtonStyle",
]);

export function tastePolishOperationsInScope(
  operations: EditOperation[],
): string[] {
  const violations: string[] = [];
  for (const op of operations) {
    if (!ALLOWED_OPS.has(op.operation)) {
      violations.push(`op:${op.operation}`);
    }
    if (op.operation === "setCreativePolish" && "contactFormEnabled" in op) {
      // Contact form enablement is conversion structure — not taste polish.
      if (op.contactFormEnabled != null) {
        violations.push("op:setCreativePolish.contactFormEnabled");
      }
    }
  }
  return violations;
}

export function tastePolishScopeViolations(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const violations: string[] = [];
  for (const key of TASTE_POLISH_FORBIDDEN_ROOTS) {
    const a = JSON.stringify((before as Record<string, unknown>)[key] ?? null);
    const b = JSON.stringify((after as Record<string, unknown>)[key] ?? null);
    if (a !== b) violations.push(key);
  }
  // Pattern identity
  if (
    before.heroComposition?.patternId !== after.heroComposition?.patternId
  ) {
    violations.push("heroComposition.patternId");
  }
  return violations;
}

export function listChangedRoots(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const a = JSON.stringify((before as Record<string, unknown>)[key] ?? null);
    const b = JSON.stringify((after as Record<string, unknown>)[key] ?? null);
    if (a !== b) changed.push(key);
  }
  return changed;
}
