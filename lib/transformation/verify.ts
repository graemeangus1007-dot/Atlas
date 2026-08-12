/**
 * Batch and whole-page verification for transformation execution.
 */

import {
  brandIntegrityViolations,
  heroAssetPreserved,
} from "@/lib/transformation/brand-snapshot";
import type {
  BrandScopeSnapshot,
  GoalVerificationResult,
  WholePageVerificationResult,
} from "@/lib/transformation/execution-types";
import {
  assessTransformationOutcome,
  snapshotEvaluation,
  type BatchOutcomeCheckpoint,
  type TransformationOutcomeAssessment,
} from "@/lib/transformation/outcome";
import type {
  TransformationGoal,
  TransformationGoalId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";
import { getEffectiveSectionOrder } from "@/lib/ai/section-order";
import { creativeDirectorFingerprint } from "@/lib/ai/creative-director";

export function overallDesignScore(project: BusinessProject): number {
  return snapshotEvaluation(project).dimensions.overallDesignScore;
}

export function verifyGoalAgainstProject(
  goal: TransformationGoal,
  project: BusinessProject,
): GoalVerificationResult {
  const notes: string[] = [];
  let passed = true;
  const order = getEffectiveSectionOrder(project);

  switch (goal.id) {
    case "set_page_direction":
      notes.push("Vision direction recorded");
      break;
    case "strengthen_hero":
      if (!project.heroHeadline?.trim()) {
        passed = false;
        notes.push("Hero headline missing");
      }
      if (project.heroComposition?.patternId) {
        notes.push("Hero pattern applied");
      }
      break;
    case "establish_trust":
      if (!(project.designSections?.testimonials?.length)) {
        passed = false;
        notes.push("Testimonials not present");
      }
      break;
    case "clarify_services":
      if (!(project.services?.length)) {
        passed = false;
        notes.push("Services missing");
      }
      break;
    case "strengthen_proof": {
      const hasGallery = (project.designSections?.enabled ?? []).includes(
        "gallery",
      );
      const hasProof =
        hasGallery || Boolean(project.designSections?.testimonials?.length);
      if (!hasProof) {
        passed = false;
        notes.push("No proof section present");
      }
      break;
    }
    case "sequence_proof_before_ask": {
      const contactIdx = order.indexOf("contact");
      const proofIdx = Math.min(
        ...["testimonials", "gallery", "faq"]
          .map((s) => order.indexOf(s))
          .filter((i) => i >= 0),
        Number.POSITIVE_INFINITY,
      );
      if (
        contactIdx >= 0 &&
        Number.isFinite(proofIdx) &&
        proofIdx > contactIdx
      ) {
        passed = false;
        notes.push("Proof still appears after contact");
      }
      break;
    }
    case "clarify_primary_cta": {
      const label = (project.primaryCta || "").trim();
      if (!label) {
        passed = false;
        notes.push("Primary CTA empty");
      } else if (
        /^(learn more|click here|submit|ok|get started|contact us|read more|see more)$/i.test(
          label,
        )
      ) {
        passed = false;
        notes.push("Primary CTA still generic");
      }
      break;
    }
    case "clarify_visual_restraint": {
      const overlay = project.heroOverlay ?? 50;
      const blur = project.heroTreatment?.textScrim?.blur ?? 0;
      const polish = project.creativePolish;
      const motionStack =
        Number(Boolean(polish?.motion)) +
        Number(Boolean(polish?.hoverEffects)) +
        Number(Boolean(polish?.sectionReveal));
      if (overlay >= 75 && blur >= 8 && motionStack >= 2) {
        passed = false;
        notes.push("Competing hero treatments and effects remain stacked");
      }
      break;
    }
    case "simplify_conversion":
      if (!(project.primaryCta || "").trim()) {
        passed = false;
        notes.push("Primary CTA empty");
      }
      break;
    case "improve_rhythm":
      if (
        project.creativePolish?.spacing !== "comfortable" &&
        project.creativePolish?.spacing !== "airy"
      ) {
        notes.push("Spacing not explicitly set to comfortable");
      }
      break;
    case "tighten_messaging":
      if ((project.heroSubheadline || "").length > 280) {
        passed = false;
        notes.push("Hero subheadline still too long");
      }
      break;
    default:
      break;
  }

  return {
    passed,
    scoreContribution: passed ? goal.expectedImprovement : 0,
    notes,
  };
}

export function verifyBatchIntegrity(input: {
  before: BusinessProject;
  after: BusinessProject;
  brand: BrandScopeSnapshot;
  appliedGoalIds: TransformationGoalId[];
}): { passed: boolean; notes: string[] } {
  const notes: string[] = [];
  const brandViolations = brandIntegrityViolations(input.brand, input.after);
  if (brandViolations.length > 0) {
    notes.push(`Brand integrity: ${brandViolations.join(", ")}`);
    return { passed: false, notes };
  }
  if (!heroAssetPreserved(input.brand, input.after)) {
    notes.push("Hero asset was replaced unexpectedly");
    return { passed: false, notes };
  }
  if (
    input.appliedGoalIds.length > 0 &&
    creativeDirectorFingerprint(input.before) ===
      creativeDirectorFingerprint(input.after)
  ) {
    notes.push("Batch produced no visible project change");
  }
  return { passed: true, notes };
}

/**
 * Whole-page verification using dimension-aware outcome assessment.
 * Flat overall score alone is NOT a failure when targeted dimensions improve.
 */
export function verifyWholePageTransformation(input: {
  baselineProject: BusinessProject;
  finalProject: BusinessProject;
  plan: TransformationPlan;
  brand: BrandScopeSnapshot;
  criticalDependencyFailed: boolean;
  appliedGoals?: TransformationGoal[];
  blockedGoalIds?: TransformationGoalId[];
  batchCheckpoints?: BatchOutcomeCheckpoint[];
}): WholePageVerificationResult {
  const outcome = assessTransformationOutcome({
    baselineProject: input.baselineProject,
    finalProject: input.finalProject,
    plan: input.plan,
    brand: input.brand,
    appliedGoals: input.appliedGoals ?? [],
    blockedGoalIds: input.blockedGoalIds ?? [],
    criticalDependencyFailed: input.criticalDependencyFailed,
    batchCheckpoints: input.batchCheckpoints,
  });

  return wholePageFromOutcome(outcome, input.criticalDependencyFailed);
}

export function wholePageFromOutcome(
  outcome: TransformationOutcomeAssessment,
  criticalDependencyFailed: boolean,
): WholePageVerificationResult {
  const accessibilityRegression = outcome.criticalRegressions.some((r) =>
    /accessibility/i.test(r),
  );
  const brandIntegrityRegression = outcome.criticalRegressions.some((r) =>
    /brand integrity/i.test(r),
  );

  const passed =
    outcome.verdict === "verified_success" ||
    outcome.verdict === "verified_partial";

  const notes: string[] = [];
  if (outcome.verdict === "neutral_no_gain") {
    notes.push(
      "Changes were applied but did not produce a measurable improvement in the targeted design dimensions.",
    );
  }
  if (outcome.verdict === "critical_regression") {
    notes.push(...outcome.criticalRegressions.slice(0, 4));
  }
  if (outcome.verdict === "evaluation_inconclusive") {
    notes.push(
      "The evaluator could not confidently confirm the redesign result — treating this conservatively.",
    );
  }
  if (outcome.overallDelta <= 0 && outcome.meaningfulImprovements.length > 0) {
    notes.push(
      `Overall score was flat (${outcome.overallDelta >= 0 ? "+" : ""}${outcome.overallDelta}), but targeted dimensions improved.`,
    );
  }
  if (!outcome.highestPriorityProblemImproved) {
    notes.push("Highest-priority problem did not improve enough.");
  }
  if (criticalDependencyFailed) {
    notes.push("A critical dependency failed during execution.");
  }

  return {
    passed,
    baselineScore: outcome.baselineOverall,
    finalScore: outcome.finalOverall,
    verifiedScoreDelta: outcome.overallDelta,
    highestPriorityImproved: outcome.highestPriorityProblemImproved,
    accessibilityRegression,
    brandIntegrityRegression,
    criticalDependencyFailed,
    notes,
    outcome,
  };
}
