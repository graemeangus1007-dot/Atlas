/**
 * Website maturity scoring for Atlas Creative Director (Sprint 25.0A).
 */

import { COMPLETENESS_CHECKS } from "@/lib/ai/creative-director-capabilities";
import type { CreativeMaturityLevel } from "@/lib/ai/creative-director-types";
import type { BusinessProject } from "@/types/business-project";

/**
 * Deterministic 0–100 completeness from capability checks.
 */
export function scoreWebsiteCompleteness(project: BusinessProject): number {
  const totalWeight = COMPLETENESS_CHECKS.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return 0;
  const earned = COMPLETENESS_CHECKS.reduce(
    (sum, row) => sum + (row.present(project) ? row.weight : 0),
    0,
  );
  return Math.round((earned / totalWeight) * 100);
}

/**
 * Map completeness to creative maturity ladder.
 * Launch Ready ≥ 85 · Professional ≥ 70 · Developing ≥ 40 · else Draft
 */
export function classifyMaturityLevel(
  completeness: number,
): CreativeMaturityLevel {
  if (completeness >= 85) return "Launch Ready";
  if (completeness >= 70) return "Professional";
  if (completeness >= 40) return "Developing";
  return "Draft";
}
