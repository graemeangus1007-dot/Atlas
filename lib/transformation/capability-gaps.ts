/**
 * Capability-gap diagnosis when real weaknesses need unsupported ops or user input.
 */

import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import type { ClassifiedTransformationGoal } from "@/lib/transformation/execution-types";
import type {
  TransformationGoalId,
  TransformationPlan,
} from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

export type TransformationCapabilityGap = {
  problem: string;
  affectedSection: string;
  requiredCapability: string;
  currentCapabilityMissing: boolean;
  userInputRequired: boolean;
  recommendedNextStep: string;
};

export function detectTransformationCapabilityGaps(input: {
  project: BusinessProject;
  plan: TransformationPlan;
  evaluation: CreativeDirectorEvaluation | null | undefined;
  classified: ClassifiedTransformationGoal[];
}): TransformationCapabilityGap[] {
  const gaps: TransformationCapabilityGap[] = [];
  const { project, plan, evaluation, classified } = input;
  const byId = new Map(classified.map((c) => [c.goalId, c]));

  const push = (gap: TransformationCapabilityGap) => {
    if (gaps.some((g) => g.problem === gap.problem)) return;
    gaps.push(gap);
  };

  const trustScore = evaluation?.trust.score ?? 100;
  const testimonialCount = project.designSections?.testimonials?.length ?? 0;

  // Unsupported goals → explicit capability gaps
  for (const c of classified) {
    if (c.classification !== "blocked_unsupported") continue;
    push({
      problem:
        c.reason ||
        `Current transformation operations cannot complete “${c.goalId.replace(/_/g, " ")}”`,
      affectedSection: c.affectedSections[0] || "page",
      requiredCapability: `supported_operation:${c.goalId}`,
      currentCapabilityMissing: true,
      userInputRequired: false,
      recommendedNextStep:
        c.goalId === "sequence_proof_before_ask"
          ? "Add proof sections first, then reorder trust before the ask"
          : "A future layout or composition capability is required for this redesign",
    });
  }

  if (trustScore < 75 && testimonialCount === 0) {
    push({
      problem: "Visitors see the offer before enough evidence of completed work",
      affectedSection: "testimonials",
      requiredCapability: "verified_customer_reviews",
      currentCapabilityMissing: true,
      userInputRequired: true,
      recommendedNextStep: "Add verified customer reviews",
    });
  }

  const trustClass = byId.get("establish_trust");
  if (
    trustScore < 75 &&
    testimonialCount > 0 &&
    (trustClass?.classification === "already_satisfied" ||
      trustClass?.classification === "ready")
  ) {
    push({
      problem: "Generic placeholder testimonials do not earn real trust",
      affectedSection: "testimonials",
      requiredCapability: "verified_customer_reviews",
      currentCapabilityMissing: true,
      userInputRequired: true,
      recommendedNextStep: "Add verified customer reviews",
    });
  }

  if (
    byId.get("strengthen_proof")?.classification === "blocked_missing_asset" ||
    (project.galleryImageIds ?? []).filter(Boolean).length < 2
  ) {
    if (/contractor|landscap|roof|builder|plumb|electric/i.test(project.businessType)) {
      push({
        problem: "Project photography is too thin for an image-led business",
        affectedSection: "gallery",
        requiredCapability: "uploaded_proof_imagery",
        currentCapabilityMissing: true,
        userInputRequired: true,
        recommendedNextStep: "Upload finished project photography",
      });
    }
  }

  const heroClass = byId.get("strengthen_hero");
  if (
    heroClass?.classification === "already_satisfied" ||
    heroClass?.classification === "ready"
  ) {
    const heroSection = evaluation?.sections.find((s) => s.sectionId === "hero");
    if (
      heroSection &&
      heroSection.score < 80 &&
      Boolean(project.heroImageId)
    ) {
      push({
        problem: "The hero photograph or composition still weakens first impression",
        affectedSection: "hero",
        requiredCapability: "hero_image_replacement_or_advanced_composition",
        currentCapabilityMissing: true,
        userInputRequired: !project.heroImageId,
        recommendedNextStep: project.heroImageId
          ? "Try a stronger project photo in the hero, or a different composition direction"
          : "Add a hero photograph",
      });
    }
  }

  if (byId.get("clarify_services")?.classification === "blocked_unsupported") {
    push({
      problem: "Services need a new layout pattern beyond supported polish",
      affectedSection: "services",
      requiredCapability: "services_layout_pattern",
      currentCapabilityMissing: true,
      userInputRequired: false,
      recommendedNextStep: "A future services layout pattern is required for this redesign",
    });
  }

  // Weak proof positioning that ops couldn't fix meaningfully
  const problem = plan.vision.highestPriorityProblem.toLowerCase();
  if (
    /trust|proof|testimonial/.test(problem) &&
    (evaluation?.trust.score ?? 100) < 75 &&
    (project.designSections?.testimonials?.length ?? 0) > 0
  ) {
    push({
      problem: "Trust remains limited even after supported proof placement",
      affectedSection: "testimonials",
      requiredCapability: "stronger_testimonial_composition",
      currentCapabilityMissing: true,
      userInputRequired: true,
      recommendedNextStep: "Add verified customer reviews or richer project-proof content",
    });
  }

  return gaps.slice(0, 6);
}

export function capabilityGapSummary(
  gaps: TransformationCapabilityGap[],
): string | null {
  if (gaps.length === 0) return null;
  const userGaps = gaps.filter((g) => g.userInputRequired);
  const primary = userGaps[0] ?? gaps[0]!;
  return primary.recommendedNextStep;
}

export function goalsAttemptedIds(
  classified: ClassifiedTransformationGoal[],
): TransformationGoalId[] {
  return classified
    .filter((c) => c.classification === "ready" || c.classification === "already_satisfied")
    .map((c) => c.goalId);
}
