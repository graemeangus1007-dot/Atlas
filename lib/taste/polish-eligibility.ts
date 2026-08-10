/**
 * Taste polish eligibility — structure first, polish last.
 * Treatment defects (heavy wash/blur) do not block polish — polish fixes them.
 */

import type { CreativeDirectorEvaluation } from "@/lib/creative-director/types";
import {
  classifyDesignQualityBand,
  detectMajorWeaknesses,
  type MajorWeaknessKind,
} from "@/lib/creative-director/score-calibration";
import { buildPageSectionInventory } from "@/lib/creative-director/inventory";
import { evaluateWebsiteFlow } from "@/lib/creative-director/flow-evaluator";
import { evaluateWebsiteSections } from "@/lib/creative-director/section-evaluator";
import type { TasteEvaluation } from "@/lib/taste/types";
import type { TastePolishEligibility } from "@/lib/taste/polish-types";
import type { BusinessProject } from "@/types/business-project";

/** Weaknesses that block polish — missing structure / proof / content. */
const STRUCTURAL_BLOCKERS: ReadonlySet<MajorWeaknessKind> = new Set([
  "critical_missing_imagery",
  "broken_section_flow",
  "placeholder_or_generic_filler",
  "weak_proof_before_conversion",
]);

export function assessTastePolishEligibility(input: {
  project: BusinessProject;
  taste?: TasteEvaluation | null;
  evaluation?: CreativeDirectorEvaluation | null;
  /** Explicit critical verification failure from caller. */
  criticalVerificationFailure?: boolean;
}): TastePolishEligibility {
  const reasons: string[] = [];
  const inventory = buildPageSectionInventory({ project: input.project });
  const sections = evaluateWebsiteSections(inventory);
  const flow = evaluateWebsiteFlow({ inventory, sections });
  const majorWeaknesses = detectMajorWeaknesses({ inventory, flow });
  const structural = majorWeaknesses.filter((w) =>
    STRUCTURAL_BLOCKERS.has(w.kind),
  );

  const overall =
    input.evaluation?.dimensions.overallDesignScore ??
    input.evaluation?.health.overall ??
    null;
  const qualityBand =
    input.evaluation?.health.qualityBand?.toLowerCase() ??
    (overall != null ? classifyDesignQualityBand(overall) : null);

  // Core content / imagery gates
  const imageLed = /landscap|restaurant|gym|builder|coffee|contractor/i.test(
    inventory.industry,
  );
  if (imageLed && !inventory.hasHeroImage) {
    reasons.push("Core imagery is still missing for this business type.");
  }
  if (!inventory.heroHeadline?.trim() || inventory.heroHeadline.length < 12) {
    reasons.push("Core hero content is still missing.");
  }
  if ((inventory.servicesCount ?? 0) < 1) {
    reasons.push("Core service content is still missing.");
  }

  if (structural.length > 0) {
    reasons.push("Major structural weaknesses are still unresolved.");
  }

  if (input.criticalVerificationFailure) {
    reasons.push("A critical verification failure is still active.");
  }

  const accessibility = input.evaluation?.dimensions.accessibility;
  if (accessibility != null && accessibility < 55) {
    reasons.push("Accessibility is below an acceptable polish threshold.");
  }

  const p = input.project;
  if (!p.primaryColor || !p.accentColor || !p.headingFont || !p.bodyFont) {
    reasons.push("Brand identity is incomplete.");
  }

  // Poor band only — developing may polish when structure is otherwise ready.
  if (
    qualityBand === "poor" ||
    (typeof qualityBand === "string" && /^poor\b/i.test(qualityBand))
  ) {
    reasons.push("Design quality band is not ready for final polish.");
  }

  const eligibleToJudge =
    reasons.length === 0 &&
    (input.taste?.eligibleToJudge === true ||
      structural.length === 0 &&
        inventory.hasHeroImage &&
        inventory.heroHeadline.length >= 12);

  if (!eligibleToJudge && reasons.length === 0) {
    reasons.push("Taste is not eligible to judge until the structure is sound.");
  }

  return {
    allowed: reasons.length === 0 && eligibleToJudge,
    eligibleToJudge,
    reasons,
  };
}
