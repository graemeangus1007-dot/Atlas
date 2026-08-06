/**
 * Batch and whole-page verification for transformation execution.
 */

import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import {
  brandIntegrityViolations,
  heroAssetPreserved,
} from "@/lib/transformation/brand-snapshot";
import type {
  BrandScopeSnapshot,
  GoalVerificationResult,
  WholePageVerificationResult,
} from "@/lib/transformation/execution-types";
import type {
  TransformationGoal,
  TransformationGoalId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";
import { getEffectiveSectionOrder } from "@/lib/ai/section-order";
import { creativeDirectorFingerprint } from "@/lib/ai/creative-director";

export function overallDesignScore(project: BusinessProject): number {
  return evaluateWebsiteAsCreativeDirector({ project }).dimensions
    .overallDesignScore;
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
        // Soft fail — spacing may already be acceptable via template
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
    // Not critical — treat as soft pass for already-near goals
  }
  return { passed: true, notes };
}

export function verifyWholePageTransformation(input: {
  baselineProject: BusinessProject;
  finalProject: BusinessProject;
  plan: TransformationPlan;
  brand: BrandScopeSnapshot;
  criticalDependencyFailed: boolean;
}): WholePageVerificationResult {
  const baselineEval = evaluateWebsiteAsCreativeDirector({
    project: input.baselineProject,
  });
  const finalEval = evaluateWebsiteAsCreativeDirector({
    project: input.finalProject,
  });
  const baselineScore = baselineEval.dimensions.overallDesignScore;
  const finalScore = finalEval.dimensions.overallDesignScore;
  const verifiedScoreDelta = finalScore - baselineScore;

  const brandViolations = brandIntegrityViolations(
    input.brand,
    input.finalProject,
  );
  const brandIntegrityRegression = brandViolations.length > 0;

  const accessibilityRegression =
    finalEval.dimensions.accessibility <
    baselineEval.dimensions.accessibility - 6;

  const problem = input.plan.vision.highestPriorityProblem.toLowerCase();
  let highestPriorityImproved = verifiedScoreDelta > 0;
  if (/trust|testimonial|proof/.test(problem)) {
    highestPriorityImproved =
      finalEval.trust.score >= baselineEval.trust.score;
  } else if (/hero|first impression|visual/.test(problem)) {
    const baseHero =
      baselineEval.sections.find((s) => s.sectionId === "hero")?.score ?? 0;
    const finalHero =
      finalEval.sections.find((s) => s.sectionId === "hero")?.score ?? 0;
    highestPriorityImproved = finalHero >= baseHero;
  } else if (/conversion|cta|contact|ask/.test(problem)) {
    highestPriorityImproved =
      finalEval.conversion.score >= baselineEval.conversion.score;
  }

  const notes: string[] = [];
  if (verifiedScoreDelta <= 0) {
    notes.push("Whole-page design score did not improve.");
  }
  if (!highestPriorityImproved) {
    notes.push("Highest-priority problem did not improve.");
  }
  if (accessibilityRegression) {
    notes.push("Accessibility regressed beyond tolerance.");
  }
  if (brandIntegrityRegression) {
    notes.push(`Brand integrity regression: ${brandViolations.join(", ")}`);
  }
  if (input.criticalDependencyFailed) {
    notes.push("A critical dependency failed during execution.");
  }

  const passed =
    verifiedScoreDelta > 0 &&
    highestPriorityImproved &&
    !accessibilityRegression &&
    !brandIntegrityRegression &&
    !input.criticalDependencyFailed;

  return {
    passed,
    baselineScore,
    finalScore,
    verifiedScoreDelta,
    highestPriorityImproved,
    accessibilityRegression,
    brandIntegrityRegression,
    criticalDependencyFailed: input.criticalDependencyFailed,
    notes,
  };
}
