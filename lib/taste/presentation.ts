/**
 * Taste Engine presentation + development diagnostics.
 */

import type {
  TasteDiagnostics,
  TasteEvaluation,
} from "@/lib/taste/types";
import { tasteDimensionLabel } from "@/lib/taste/registry";

export function formatTasteSummary(taste: TasteEvaluation): string {
  const top = taste.highestPriorityImprovement
    ? tasteDimensionLabel(taste.highestPriorityImprovement)
    : "none";
  return [
    `Taste ${taste.overallTaste}/100.`,
    taste.summary,
    taste.highestPriorityImprovement
      ? `Highest-priority improvement: ${top}.`
      : "No urgent taste gap.",
  ].join(" ");
}

export function buildTasteDiagnostics(
  taste: TasteEvaluation,
): TasteDiagnostics {
  return {
    overallTaste: taste.overallTaste,
    spacingHarmony: taste.spacingHarmony,
    typographyHarmony: taste.typographyHarmony,
    visualRhythm: taste.visualRhythm,
    craftsmanship: taste.craftsmanship,
    visualWeight: taste.visualWeight,
    restraint: taste.restraint,
    highestPriorityImprovement: taste.highestPriorityImprovement,
    recommendationSource: "taste_engine",
    eligibleToJudge: taste.eligibleToJudge,
  };
}

/** Development-only diagnostics. */
export function logTasteDiagnostics(
  taste: TasteEvaluation,
  requestId?: string | null,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[atlas:taste]", {
    requestId: requestId ?? null,
    ...buildTasteDiagnostics(taste),
  });
}

/** Guard: taste copy must never sound like benchmark/layout copying. */
export function tasteTextSoundsLikeCopying(text: string): boolean {
  return /\b(clone\s+the|copy\s+the\s+(layout|site|design|benchmark)|match\s+the\s+layout|same\s+as\s+the\s+benchmark|use\s+their\s+colors|steal\s+the\s+design)\b/i.test(
    text,
  );
}
