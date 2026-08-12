/**
 * Dimension-aware transformation outcome assessment (Phase 2 fix).
 * Replaces binary overall-score rollback with selective verdicts.
 */

import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import { brandIntegrityViolations } from "@/lib/transformation/brand-snapshot";
import type {
  BrandScopeSnapshot,
  TransformationBatchId,
  TransformationGoalApplyStatus,
} from "@/lib/transformation/execution-types";
import type {
  TransformationGoal,
  TransformationGoalId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";
import type { WebsiteDimensionScores } from "@/lib/creative-director/types";

/** Calibrated from fixture behavior — overall is a weighted blend, so ±2 is noise. */
export const SCORE_TOLERANCE = {
  overallMeaningful: 3,
  overallNoise: 2,
  dimensionMeaningful: 4,
  dimensionSubstantial: 8,
  dimensionCriticalRegression: 10,
  accessibilityCritical: 6,
  sectionMeaningful: 5,
  batchBeneficial: 3,
  batchHarmful: -4,
  evaluatorConfidenceFloor: 0.45,
} as const;

export type OutcomeVerdict =
  | "verified_success"
  | "verified_partial"
  | "neutral_no_gain"
  | "critical_regression"
  | "evaluation_inconclusive";

export type BatchScoreVerdict =
  | "beneficial"
  | "neutral"
  | "harmful"
  | "inconclusive";

export type TransformationOutcomeAssessment = {
  overallDelta: number;
  dimensionDeltas: Record<string, number>;
  sectionDeltas: Record<string, number>;
  highestPriorityProblemImproved: boolean;
  criticalRegressions: string[];
  meaningfulImprovements: string[];
  neutralChanges: string[];
  regressions: string[];
  expectedGoalsImproved: string[];
  expectedGoalsMissed: string[];
  confidence: number;
  verdict: OutcomeVerdict;
  baselineOverall: number;
  finalOverall: number;
  goalExpectedDimensions: Record<string, string[]>;
  goalObservedDeltas: Record<string, Record<string, number>>;
};

export type BatchOutcomeCheckpoint = {
  batchId: TransformationBatchId;
  baselineOverall: number;
  afterOverall: number;
  overallDelta: number;
  dimensionDeltas: Record<string, number>;
  sectionDeltas: Record<string, number>;
  targetedDelta: number;
  verdict: BatchScoreVerdict;
  notes: string[];
};

/** Dimensions each goal is expected to move. */
export const GOAL_EXPECTED_DIMENSIONS: Record<
  TransformationGoalId,
  Array<keyof WebsiteDimensionScores | "flow" | "rhythm" | "hero_section" | "trust_section">
> = {
  set_page_direction: ["brandConsistency", "professionalism"],
  strengthen_hero: ["firstImpression", "visualHierarchy", "hero_section"],
  establish_trust: ["trust", "trust_section"],
  clarify_services: ["scanability", "informationArchitecture"],
  strengthen_proof: ["trust", "firstImpression"],
  sequence_proof_before_ask: ["narrativeFlow", "conversion"],
  clarify_primary_cta: ["conversion", "firstImpression"],
  simplify_conversion: ["conversion", "firstImpression"],
  clarify_visual_restraint: ["professionalism", "firstImpression", "visualHierarchy"],
  improve_rhythm: ["visualRhythm", "whitespace", "sectionBalance"],
  tighten_messaging: ["scanability", "firstImpression"],
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function snapshotEvaluation(
  project: BusinessProject,
): CreativeDirectorEvaluation {
  return evaluateWebsiteAsCreativeDirector({ project });
}

export function dimensionMap(
  evaluation: CreativeDirectorEvaluation,
): Record<string, number> {
  const d = evaluation.dimensions;
  return {
    overallDesignScore: d.overallDesignScore,
    firstImpression: d.firstImpression,
    visualHierarchy: d.visualHierarchy,
    trust: d.trust,
    narrativeFlow: d.narrativeFlow,
    conversion: d.conversion,
    brandConsistency: d.brandConsistency,
    accessibility: d.accessibility,
    mobileExperience: d.mobileExperience,
    professionalism: d.professionalism,
    informationArchitecture: d.informationArchitecture,
    sectionBalance: d.sectionBalance,
    whitespace: d.whitespace,
    scanability: d.scanability,
    visualRhythm: d.visualRhythm,
    emotionalTone: d.emotionalTone,
    flow: evaluation.flow.score,
    rhythm: evaluation.rhythm.score,
  };
}

export function sectionMap(
  evaluation: CreativeDirectorEvaluation,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of evaluation.sections) {
    out[s.sectionId] = s.present ? s.score : 0;
  }
  return out;
}

function deltas(
  before: Record<string, number>,
  after: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: Record<string, number> = {};
  for (const key of keys) {
    out[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return out;
}

function highestPriorityImproved(
  plan: TransformationPlan,
  dimBefore: Record<string, number>,
  dimAfter: Record<string, number>,
  secBefore: Record<string, number>,
  secAfter: Record<string, number>,
): boolean {
  const problem = plan.vision.highestPriorityProblem.toLowerCase();
  if (/trust|testimonial|proof/.test(problem)) {
    return (
      (dimAfter.trust ?? 0) - (dimBefore.trust ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful ||
      (secAfter.testimonials ?? 0) - (secBefore.testimonials ?? 0) >=
        SCORE_TOLERANCE.sectionMeaningful
    );
  }
  if (/hero|first impression|visual/.test(problem)) {
    return (
      (dimAfter.firstImpression ?? 0) - (dimBefore.firstImpression ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful ||
      (secAfter.hero ?? 0) - (secBefore.hero ?? 0) >=
        SCORE_TOLERANCE.sectionMeaningful
    );
  }
  if (/conversion|cta|contact|ask/.test(problem)) {
    return (
      (dimAfter.conversion ?? 0) - (dimBefore.conversion ?? 0) >=
      SCORE_TOLERANCE.dimensionMeaningful
    );
  }
  if (/flow|narrative|order|sequence/.test(problem)) {
    return (
      (dimAfter.narrativeFlow ?? 0) - (dimBefore.narrativeFlow ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful ||
      (dimAfter.flow ?? 0) - (dimBefore.flow ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful
    );
  }
  if (/rhythm|spacing|whitespace/.test(problem)) {
    return (
      (dimAfter.visualRhythm ?? 0) - (dimBefore.visualRhythm ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful ||
      (dimAfter.whitespace ?? 0) - (dimBefore.whitespace ?? 0) >=
        SCORE_TOLERANCE.dimensionMeaningful
    );
  }
  // Default: any targeted meaningful dimension gain
  return (
    (dimAfter.overallDesignScore ?? 0) - (dimBefore.overallDesignScore ?? 0) >=
    SCORE_TOLERANCE.overallMeaningful
  );
}

function goalTargetedDelta(
  goalId: TransformationGoalId,
  dimDeltas: Record<string, number>,
  secDeltas: Record<string, number>,
): number {
  const expected = GOAL_EXPECTED_DIMENSIONS[goalId] ?? [];
  let best = 0;
  for (const key of expected) {
    if (key === "hero_section") {
      best = Math.max(best, secDeltas.hero ?? 0);
    } else if (key === "trust_section") {
      best = Math.max(best, secDeltas.testimonials ?? 0);
    } else {
      best = Math.max(best, dimDeltas[key] ?? 0);
    }
  }
  return best;
}

export function assessBatchOutcome(input: {
  batchId: TransformationBatchId;
  before: BusinessProject;
  after: BusinessProject;
  goalIds: TransformationGoalId[];
}): BatchOutcomeCheckpoint {
  const beforeEval = snapshotEvaluation(input.before);
  const afterEval = snapshotEvaluation(input.after);
  const dimBefore = dimensionMap(beforeEval);
  const dimAfter = dimensionMap(afterEval);
  const secBefore = sectionMap(beforeEval);
  const secAfter = sectionMap(afterEval);
  const dimensionDeltas = deltas(dimBefore, dimAfter);
  const sectionDeltas = deltas(secBefore, secAfter);
  const overallDelta =
    afterEval.dimensions.overallDesignScore -
    beforeEval.dimensions.overallDesignScore;

  let targetedDelta = 0;
  for (const id of input.goalIds) {
    targetedDelta = Math.max(
      targetedDelta,
      goalTargetedDelta(id, dimensionDeltas, sectionDeltas),
    );
  }

  const notes: string[] = [];
  let verdict: BatchScoreVerdict = "neutral";

  const accessDelta =
    (dimAfter.accessibility ?? 0) - (dimBefore.accessibility ?? 0);
  if (accessDelta <= -SCORE_TOLERANCE.accessibilityCritical) {
    verdict = "harmful";
    notes.push("Accessibility regressed in this batch.");
  } else if (
    overallDelta <= SCORE_TOLERANCE.batchHarmful &&
    targetedDelta < SCORE_TOLERANCE.dimensionMeaningful
  ) {
    verdict = "harmful";
    notes.push("Batch lowered the page without targeted gains.");
  } else if (
    targetedDelta >= SCORE_TOLERANCE.dimensionMeaningful ||
    overallDelta >= SCORE_TOLERANCE.batchBeneficial
  ) {
    verdict = "beneficial";
    notes.push("Batch improved targeted design dimensions.");
  } else if (
    Math.abs(overallDelta) <= SCORE_TOLERANCE.overallNoise &&
    targetedDelta < SCORE_TOLERANCE.dimensionMeaningful
  ) {
    // Ops applied but scorer barely moved — may be calibration gap
    const fingerprintChanged =
      JSON.stringify(input.before.designSections) !==
        JSON.stringify(input.after.designSections) ||
      input.before.primaryCta !== input.after.primaryCta ||
      input.before.heroComposition?.patternId !==
        input.after.heroComposition?.patternId ||
      input.before.creativePolish?.spacing !==
        input.after.creativePolish?.spacing;
    verdict = fingerprintChanged ? "inconclusive" : "neutral";
    notes.push(
      fingerprintChanged
        ? "State changed but evaluator response was within noise."
        : "Batch produced no meaningful score movement.",
    );
  } else if (targetedDelta > 0 || overallDelta > 0) {
    verdict = "beneficial";
    notes.push("Small but positive targeted movement.");
  }

  return {
    batchId: input.batchId,
    baselineOverall: beforeEval.dimensions.overallDesignScore,
    afterOverall: afterEval.dimensions.overallDesignScore,
    overallDelta,
    dimensionDeltas,
    sectionDeltas,
    targetedDelta,
    verdict,
    notes,
  };
}

export function assessTransformationOutcome(input: {
  baselineProject: BusinessProject;
  finalProject: BusinessProject;
  plan: TransformationPlan;
  brand: BrandScopeSnapshot;
  appliedGoals: TransformationGoal[];
  blockedGoalIds: TransformationGoalId[];
  criticalDependencyFailed: boolean;
  batchCheckpoints?: BatchOutcomeCheckpoint[];
}): TransformationOutcomeAssessment {
  const beforeEval = snapshotEvaluation(input.baselineProject);
  const afterEval = snapshotEvaluation(input.finalProject);
  const dimBefore = dimensionMap(beforeEval);
  const dimAfter = dimensionMap(afterEval);
  const secBefore = sectionMap(beforeEval);
  const secAfter = sectionMap(afterEval);
  const dimensionDeltas = deltas(dimBefore, dimAfter);
  const sectionDeltas = deltas(secBefore, secAfter);
  const overallDelta =
    afterEval.dimensions.overallDesignScore -
    beforeEval.dimensions.overallDesignScore;

  const criticalRegressions: string[] = [];
  const meaningfulImprovements: string[] = [];
  const neutralChanges: string[] = [];
  const regressions: string[] = [];

  const brandViolations = brandIntegrityViolations(
    input.brand,
    input.finalProject,
  );
  if (brandViolations.length > 0) {
    criticalRegressions.push(
      `Brand integrity: ${brandViolations.join(", ")}`,
    );
  }

  const accessDelta = dimensionDeltas.accessibility ?? 0;
  if (accessDelta <= -SCORE_TOLERANCE.accessibilityCritical) {
    criticalRegressions.push("Accessibility materially worsened.");
  }

  // Media / contact loss
  if (
    input.baselineProject.heroImageId &&
    input.finalProject.heroImageId !== input.baselineProject.heroImageId
  ) {
    criticalRegressions.push("Hero media identity changed unexpectedly.");
  }
  if (
    (input.baselineProject.contact?.phone || "") !==
      (input.finalProject.contact?.phone || "") ||
    (input.baselineProject.contact?.email || "") !==
      (input.finalProject.contact?.email || "")
  ) {
    criticalRegressions.push("Contact data changed unexpectedly.");
  }

  const trackedDims = [
    "firstImpression",
    "trust",
    "conversion",
    "narrativeFlow",
    "visualRhythm",
    "whitespace",
    "visualHierarchy",
    "scanability",
    "flow",
    "rhythm",
  ] as const;

  for (const key of trackedDims) {
    const delta = dimensionDeltas[key] ?? 0;
    if (delta >= SCORE_TOLERANCE.dimensionMeaningful) {
      meaningfulImprovements.push(`${key} +${delta}`);
    } else if (delta <= -SCORE_TOLERANCE.dimensionCriticalRegression) {
      criticalRegressions.push(`${key} ${delta}`);
    } else if (delta <= -SCORE_TOLERANCE.dimensionMeaningful) {
      regressions.push(`${key} ${delta}`);
    } else if (Math.abs(delta) <= SCORE_TOLERANCE.overallNoise) {
      // noise — ignore listing
    } else if (delta < 0) {
      regressions.push(`${key} ${delta}`);
    } else {
      neutralChanges.push(`${key} +${delta}`);
    }
  }

  for (const [sectionId, delta] of Object.entries(sectionDeltas)) {
    if (delta >= SCORE_TOLERANCE.sectionMeaningful) {
      meaningfulImprovements.push(`${sectionId} section +${delta}`);
    } else if (delta <= -SCORE_TOLERANCE.dimensionCriticalRegression) {
      criticalRegressions.push(`${sectionId} section ${delta}`);
    }
  }

  const priorityImproved = highestPriorityImproved(
    input.plan,
    dimBefore,
    dimAfter,
    secBefore,
    secAfter,
  );

  const goalExpectedDimensions: Record<string, string[]> = {};
  const goalObservedDeltas: Record<string, Record<string, number>> = {};
  const expectedGoalsImproved: string[] = [];
  const expectedGoalsMissed: string[] = [];

  for (const goal of input.appliedGoals) {
    const expected = (GOAL_EXPECTED_DIMENSIONS[goal.id] ?? []).map(String);
    goalExpectedDimensions[goal.id] = expected;
    const observed: Record<string, number> = {};
    for (const key of expected) {
      if (key === "hero_section") observed[key] = sectionDeltas.hero ?? 0;
      else if (key === "trust_section") {
        observed[key] = sectionDeltas.testimonials ?? 0;
      } else observed[key] = dimensionDeltas[key] ?? 0;
    }
    goalObservedDeltas[goal.id] = observed;
    const best = goalTargetedDelta(goal.id, dimensionDeltas, sectionDeltas);
    if (best >= SCORE_TOLERANCE.dimensionMeaningful) {
      expectedGoalsImproved.push(goal.id);
    } else {
      expectedGoalsMissed.push(goal.id);
    }
  }

  // Confidence: lower when many blocked goals or inconclusive data
  const blockedRatio =
    input.blockedGoalIds.length /
    Math.max(1, input.plan.goals.length);
  const inconclusiveBatches =
    input.batchCheckpoints?.filter((b) => b.verdict === "inconclusive")
      .length ?? 0;
  let confidence = 0.82 - blockedRatio * 0.2 - inconclusiveBatches * 0.08;
  if (Math.abs(overallDelta) <= SCORE_TOLERANCE.overallNoise) {
    confidence -= 0.1;
  }
  if (meaningfulImprovements.length >= 2) confidence += 0.08;
  confidence = clamp01(Math.round(confidence * 100) / 100);

  let verdict: OutcomeVerdict;

  if (criticalRegressions.length > 0 || input.criticalDependencyFailed) {
    verdict = "critical_regression";
  } else if (confidence < SCORE_TOLERANCE.evaluatorConfidenceFloor) {
    verdict = "evaluation_inconclusive";
  } else if (
    overallDelta >= SCORE_TOLERANCE.overallMeaningful &&
    criticalRegressions.length === 0 &&
    (!regressions.length || priorityImproved)
  ) {
    verdict =
      expectedGoalsMissed.length > 0 || input.blockedGoalIds.length > 0
        ? "verified_partial"
        : "verified_success";
  } else if (
    (priorityImproved ||
      expectedGoalsImproved.length > 0 ||
      meaningfulImprovements.length > 0) &&
    criticalRegressions.length === 0
  ) {
    // Flat overall is OK when targeted dimensions moved
    verdict =
      expectedGoalsMissed.length > 0 ||
      input.blockedGoalIds.length > 0 ||
      overallDelta < SCORE_TOLERANCE.overallMeaningful
        ? "verified_partial"
        : "verified_success";
  } else if (
    Math.abs(overallDelta) <= SCORE_TOLERANCE.overallNoise &&
    meaningfulImprovements.length === 0 &&
    expectedGoalsImproved.length === 0
  ) {
    verdict =
      inconclusiveBatches > 0 && input.appliedGoals.length > 0
        ? "evaluation_inconclusive"
        : "neutral_no_gain";
  } else if (overallDelta < -SCORE_TOLERANCE.overallNoise) {
    verdict =
      expectedGoalsImproved.length > 0
        ? "verified_partial"
        : "critical_regression";
  } else {
    verdict = "neutral_no_gain";
  }

  return {
    overallDelta,
    dimensionDeltas,
    sectionDeltas,
    highestPriorityProblemImproved: priorityImproved,
    criticalRegressions,
    meaningfulImprovements,
    neutralChanges,
    regressions,
    expectedGoalsImproved,
    expectedGoalsMissed,
    confidence,
    verdict,
    baselineOverall: beforeEval.dimensions.overallDesignScore,
    finalOverall: afterEval.dimensions.overallDesignScore,
    goalExpectedDimensions,
    goalObservedDeltas,
  };
}

export function humanLabelForImprovement(token: string): string {
  if (/^trust/.test(token)) return "Stronger trust and social proof";
  if (/firstImpression|hero/.test(token)) return "Stronger first impression";
  if (/conversion/.test(token)) return "Clearer contact path";
  if (/narrativeFlow|flow/.test(token)) return "Proof appears earlier in the journey";
  if (/visualRhythm|whitespace|rhythm|sectionBalance/.test(token)) {
    return "Improved page rhythm and spacing";
  }
  if (/visualHierarchy|scanability/.test(token)) {
    return "Clearer visual hierarchy";
  }
  if (/testimonials/.test(token)) return "Customer proof on the page";
  if (/gallery/.test(token)) return "Stronger project imagery";
  return token.replace(/_/g, " ");
}

export type GoalLike = {
  goalId: TransformationGoalId;
  status: TransformationGoalApplyStatus;
  objective: string;
};
