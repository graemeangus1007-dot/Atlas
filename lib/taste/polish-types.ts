/**
 * Taste Engine Phase 2 — guarded polish execution types.
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import type { TasteDimensionId, TasteEvaluation } from "@/lib/taste/types";

export const TASTE_POLISH_VERSION = "1.0.0";

/** Dimensions Phase 2 may polish (subset of TasteDimensionId). */
export const TASTE_POLISH_DIMENSIONS = [
  "spacingHarmony",
  "typographyHarmony",
  "visualRhythm",
  "alignmentQuality",
  "ctaPresence",
  "proportion",
  "restraint",
  "componentConsistency",
  "visualWeight",
  "scanability",
] as const;

export type TastePolishDimension = (typeof TASTE_POLISH_DIMENSIONS)[number];

export type TastePolishPlan = {
  version: string;
  baselineTaste: number;
  targetDimensions: TastePolishDimension[];
  rationale: string;
  operations: EditOperation[];
  allowedMutationPaths: string[];
  expectedDelta: number;
  confidence: number;
  /** True when polish would be a no-op / already consistent. */
  alreadyPolished: boolean;
  /** When set, polish must not execute. */
  ineligibleReason: string | null;
};

export type TastePolishEligibility = {
  allowed: boolean;
  eligibleToJudge: boolean;
  reasons: string[];
};

export type TastePolishVerdict =
  | "applied"
  | "already_polished"
  | "ineligible"
  | "rolled_back"
  | "no_operations";

export type TastePolishResult = {
  version: string;
  verdict: TastePolishVerdict;
  applied: boolean;
  project: import("@/types/business-project").BusinessProject;
  plan: TastePolishPlan | null;
  operations: EditOperation[];
  baselineTaste: number;
  finalTaste: number;
  targetDimensions: TastePolishDimension[];
  dimensionDeltas: Partial<Record<TasteDimensionId, number>>;
  explanation: string;
  rollbackPerformed: boolean;
  scopeViolations: string[];
  tasteBefore: TasteEvaluation | null;
  tasteAfter: TasteEvaluation | null;
  revisionId: string | null;
};

export type TastePolishDiagnostics = {
  baselineTaste: number;
  finalTaste: number;
  targetDimensions: TastePolishDimension[];
  dimensionDeltas: Partial<Record<TasteDimensionId, number>>;
  eligibleToJudge: boolean;
  polishOperations: string[];
  scopeViolations: string[];
  rollbackPerformed: boolean;
  finalVerdict: TastePolishVerdict;
};
