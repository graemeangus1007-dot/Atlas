/**
 * Whole-page Creative Director evaluation orchestrator (analysis only).
 */

import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import { buildPageSectionInventory } from "@/lib/creative-director/inventory";
import { evaluateWebsiteConversion } from "@/lib/creative-director/conversion-evaluator";
import { evaluateWebsiteFlow } from "@/lib/creative-director/flow-evaluator";
import { evaluateWebsiteNarrative } from "@/lib/creative-director/narrative-evaluator";
import {
  buildCreativeDirectorRecommendations,
  buildCrossSectionInsights,
  buildDiagnostics,
  buildExecutiveSummary,
  buildWebsiteHealthV2,
  evaluateDesignConsistency,
  evaluatePersonality,
  logCreativeDirectorDiagnostics,
} from "@/lib/creative-director/presentation";
import { evaluateVisualRhythm } from "@/lib/creative-director/rhythm-evaluator";
import { evaluateWebsiteSections } from "@/lib/creative-director/section-evaluator";
import { evaluateWebsiteTrust } from "@/lib/creative-director/trust-evaluator";
import {
  CREATIVE_DIRECTOR_EVAL_VERSION,
  type CreativeDirectorEvaluation,
  type DimensionExplanation,
  type WebsiteDimensionScores,
} from "@/lib/creative-director/types";
import type { BusinessProject } from "@/types/business-project";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildDimensions(input: {
  sections: ReturnType<typeof evaluateWebsiteSections>;
  flow: ReturnType<typeof evaluateWebsiteFlow>;
  rhythm: ReturnType<typeof evaluateVisualRhythm>;
  trust: ReturnType<typeof evaluateWebsiteTrust>;
  conversion: ReturnType<typeof evaluateWebsiteConversion>;
  narrative: ReturnType<typeof evaluateWebsiteNarrative>;
  consistency: ReturnType<typeof evaluateDesignConsistency>;
  inventory: ReturnType<typeof buildPageSectionInventory>;
}): WebsiteDimensionScores {
  const present = input.sections.filter((s) => s.present);
  const avgSection =
    present.length > 0
      ? present.reduce((s, x) => s + x.score, 0) / present.length
      : 50;

  const firstImpression = present.find((s) => s.sectionId === "hero")?.score ?? 50;
  const visualHierarchy = input.inventory.visualHierarchy
    ? clamp(avgSection + 8)
    : clamp(avgSection - 6);
  const whitespace =
    input.inventory.spacing === "airy"
      ? 84
      : input.inventory.spacing === "comfortable"
        ? 76
        : 64;
  const scanability = clamp(
    (present.filter((s) => s.readingDifficulty === "easy").length /
      Math.max(1, present.length)) *
      100,
  );
  const sectionBalance = clamp(
    100 - Math.abs(input.rhythm.cadence.filter((c) => c === "heavy").length * 8),
  );
  const brandConsistency = input.consistency.score;
  const accessibility = clamp(
    70 +
      (input.inventory.contactPhone ? 6 : -8) +
      (input.inventory.visualHierarchy ? 8 : 0),
  );
  const mobileExperience = clamp(72 + (input.inventory.visualHierarchy ? 6 : 0));
  const emotionalTone = clamp(
    (firstImpression + input.narrative.momentum + input.trust.score) / 3,
  );
  const professionalism = clamp(
    (brandConsistency +
      input.trust.score +
      firstImpression +
      input.flow.score) /
      4,
  );
  const informationArchitecture = clamp(
    (input.flow.score + sectionBalance + scanability) / 3,
  );

  const overallDesignScore = clamp(
    firstImpression * 0.12 +
      visualHierarchy * 0.08 +
      input.trust.score * 0.12 +
      input.narrative.score * 0.1 +
      input.conversion.score * 0.12 +
      brandConsistency * 0.08 +
      accessibility * 0.06 +
      mobileExperience * 0.05 +
      professionalism * 0.08 +
      informationArchitecture * 0.05 +
      sectionBalance * 0.04 +
      whitespace * 0.03 +
      scanability * 0.03 +
      input.rhythm.score * 0.06 +
      emotionalTone * 0.04,
  );

  return {
    overallDesignScore,
    firstImpression: clamp(firstImpression),
    visualHierarchy,
    trust: input.trust.score,
    narrativeFlow: input.narrative.score,
    conversion: input.conversion.score,
    brandConsistency,
    accessibility,
    mobileExperience,
    professionalism,
    informationArchitecture,
    sectionBalance,
    whitespace,
    scanability,
    visualRhythm: input.rhythm.score,
    emotionalTone,
  };
}

function explainDimensions(
  dimensions: WebsiteDimensionScores,
): DimensionExplanation[] {
  const map: Record<keyof WebsiteDimensionScores, string> = {
    overallDesignScore: "Combined judgment of story, trust, conversion, and craft.",
    firstImpression: "Strength of the opening hero promise and visual impact.",
    visualHierarchy: "Whether one element leads and supporting content follows.",
    trust: "How quickly the page earns belief before asking for contact.",
    narrativeFlow: "Beginning → middle → end progression and open questions.",
    conversion: "Clarity of offer, CTA, and decision confidence.",
    brandConsistency: "Coordination of type, spacing, and imagery language.",
    accessibility: "Practical readability and contact accessibility signals.",
    mobileExperience: "Likelihood the structure remains scannable on small screens.",
    professionalism: "Agency-level polish visitors associate with competence.",
    informationArchitecture: "Order and balance of sections as a journey.",
    sectionBalance: "Whether section weights feel intentional.",
    whitespace: "Breathing room versus compression across the page.",
    scanability: "How easily a visitor can skim to the next decision.",
    visualRhythm: "Heavy/light pacing instead of stacked density.",
    emotionalTone: "Emotional consistency from first impression to close.",
  };
  return (Object.keys(dimensions) as Array<keyof WebsiteDimensionScores>).map(
    (dimension) => ({
      dimension,
      score: dimensions[dimension],
      explanation: map[dimension],
    }),
  );
}

/**
 * Evaluate the whole website as one coordinated experience.
 * Analysis only — never mutates the project or emits edit operations.
 */
export function evaluateWebsiteAsCreativeDirector(input: {
  project?: BusinessProject | null;
  strategyInput?: DesignStrategyInput | null;
  requestId?: string | null;
  logDiagnostics?: boolean;
}): CreativeDirectorEvaluation {
  const inventory = buildPageSectionInventory({
    project: input.project,
    strategyInput: input.strategyInput,
  });
  const sections = evaluateWebsiteSections(inventory);
  const flow = evaluateWebsiteFlow({ inventory, sections });
  const rhythm = evaluateVisualRhythm({ inventory, sections });
  const trust = evaluateWebsiteTrust({ inventory, sections });
  const conversion = evaluateWebsiteConversion({
    inventory,
    sections,
    trustScore: trust.score,
  });
  const narrative = evaluateWebsiteNarrative({
    inventory,
    sections,
    flowScore: flow.score,
  });
  const personality = evaluatePersonality(inventory);
  const consistency = evaluateDesignConsistency(inventory);
  const dimensions = buildDimensions({
    sections,
    flow,
    rhythm,
    trust,
    conversion,
    narrative,
    consistency,
    inventory,
  });
  const crossSectionInsights = buildCrossSectionInsights({
    inventory,
    sections,
    flow,
    trust,
  });
  const recommendations = buildCreativeDirectorRecommendations({
    inventory,
    sections,
    flow,
    trust,
    conversion,
    insights: crossSectionInsights,
  });
  const executiveSummary = buildExecutiveSummary({
    dimensions,
    inventory,
    recommendations,
    personality,
    trust,
  });
  const health = buildWebsiteHealthV2(dimensions);
  const diagnostics = buildDiagnostics({
    dimensions,
    flow,
    rhythm,
    trust,
    conversion,
    narrative,
    sections,
    recommendations,
    executiveSummary,
  });

  if (input.logDiagnostics) {
    logCreativeDirectorDiagnostics(diagnostics, input.requestId);
  }

  return {
    version: CREATIVE_DIRECTOR_EVAL_VERSION,
    reviewedAt: new Date().toISOString(),
    dimensions,
    dimensionExplanations: explainDimensions(dimensions),
    sections,
    flow,
    rhythm,
    trust,
    conversion,
    narrative,
    personality,
    consistency,
    crossSectionInsights,
    recommendations,
    executiveSummary,
    health,
    diagnostics,
  };
}
