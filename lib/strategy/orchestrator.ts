/**
 * Strategic Director orchestrator — gathers specialist outputs, never re-scores.
 */

import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import {
  analyzeProjectVisualComposition,
  evaluateVisualComposition,
} from "@/lib/composition";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import {
  applyConflictResolutions,
  detectStrategicConflicts,
} from "@/lib/strategy/conflicts";
import { defaultDependsOn } from "@/lib/strategy/dependencies";
import { assembleStrategicAssessment } from "@/lib/strategy/planner";
import { inferWebsiteState } from "@/lib/strategy/priority";
import type {
  StrategicAssessment,
  StrategicGatheredInputs,
  StrategicOpportunity,
  StrategicOpportunityId,
} from "@/lib/strategy/types";
import {
  logStrategicDiagnostics,
  verifyStrategicAssessment,
} from "@/lib/strategy/verification";
import { detectTransformationCapabilityGaps } from "@/lib/transformation/capability-gaps";
import { classifyTransformationGoals } from "@/lib/transformation/classify";
import { buildTransformationPlanForProject } from "@/lib/transformation/plan-from-project";
import type { BusinessProject } from "@/types/business-project";

function pushOpportunity(
  list: StrategicOpportunity[],
  op: StrategicOpportunity,
): void {
  if (list.some((existing) => existing.id === op.id)) return;
  if (list.some((existing) => existing.title === op.title)) return;
  list.push(op);
}

function extractOpportunities(
  gathered: StrategicGatheredInputs,
): StrategicOpportunity[] {
  const ops: StrategicOpportunity[] = [];
  const cd = gathered.creativeDirector;
  const conversion = gathered.conversionDirector;
  const taste = gathered.taste;
  const visual = gathered.visualComposition;
  const benchmark = gathered.benchmark;

  if (visual && visual.overall < 74) {
    pushOpportunity(ops, {
      id: "hero_composition",
      title: "Improve hero composition",
      leader: "visual_composition",
      owner: "visual_composition",
      domain: "hero_composition",
      sourceScore: visual.overall,
      businessImpact: Math.round(88 - visual.overall * 0.2),
      expectedImprovement: Math.round(Math.max(12, 78 - visual.overall)),
      implementationConfidence: 0.86 * 100,
      verificationConfidence: 0.84 * 100,
      blocked: false,
      dependsOn: defaultDependsOn("hero_composition"),
      explanation:
        visual.weaknesses[0] ||
        "Hero photography and copy placement are limiting first-impression clarity.",
    });
  }

  if (
    visual &&
    (visual.textRelationship < 70 ||
      (visual.photographyPreservation?.overall ?? 100) < 68)
  ) {
    pushOpportunity(ops, {
      id: "hero_readability",
      title: "Improve hero readability",
      leader: "visual_composition",
      owner: "visual_composition",
      domain: "hero_composition",
      sourceScore: Math.min(
        visual.textRelationship,
        visual.photographyPreservation?.overall ?? visual.textRelationship,
      ),
      businessImpact: 78,
      expectedImprovement: 16,
      implementationConfidence: 88,
      verificationConfidence: 86,
      blocked: false,
      dependsOn: defaultDependsOn("hero_readability"),
      explanation:
        "Readable hero copy should follow a clear composition treatment before CTA emphasis.",
    });
  }

  if ((cd.narrative?.score ?? 100) < 72) {
    pushOpportunity(ops, {
      id: "narrative",
      title: "Strengthen page narrative",
      leader: "creative_director",
      owner: "creative_director",
      domain: "narrative",
      sourceScore: cd.narrative.score,
      businessImpact: 74,
      expectedImprovement: Math.round(Math.max(10, 76 - cd.narrative.score)),
      implementationConfidence: 80,
      verificationConfidence: 78,
      blocked: false,
      dependsOn: defaultDependsOn("narrative"),
      explanation:
        cd.narrative.questionsOpen?.[0] ||
        cd.narrative.explanation ||
        "The page story is not yet sequenced clearly for visitors.",
    });
  }

  if ((cd.dimensions.informationArchitecture ?? 100) < 68) {
    pushOpportunity(ops, {
      id: "layout_structure",
      title: "Improve section structure",
      leader: "creative_director",
      owner: "creative_director",
      domain: "layout",
      sourceScore: cd.dimensions.informationArchitecture,
      businessImpact: 72,
      expectedImprovement: 14,
      implementationConfidence: 76,
      verificationConfidence: 74,
      blocked: false,
      dependsOn: defaultDependsOn("layout_structure"),
      explanation:
        "Section structure is holding back hierarchy and scanability.",
    });
  }

  if (conversion && conversion.trust < 72) {
    pushOpportunity(ops, {
      id: "trust",
      title: "Strengthen trust before the ask",
      leader: "conversion_director",
      owner: "conversion_director",
      domain: "trust",
      sourceScore: conversion.trust,
      businessImpact: 90,
      expectedImprovement: Math.round(Math.max(14, 80 - conversion.trust)),
      implementationConfidence: 82,
      verificationConfidence: 80,
      blocked: false,
      dependsOn: defaultDependsOn("trust"),
      explanation:
        conversion.weaknesses.find((w) => /trust|proof|credib/i.test(w)) ||
        "Visitor trust is weaker than the conversion ask requires.",
    });
  }

  if (conversion && conversion.proof < 72) {
    const needsInput = conversion.businessInputNeeded.some((t) =>
      /proof|testimonial|review/i.test(t),
    );
    pushOpportunity(ops, {
      id: "proof",
      title: "Put proof before the ask",
      leader: needsInput ? "capability_gap" : "conversion_director",
      owner: needsInput ? "capability_gap" : "conversion_director",
      domain: "proof",
      sourceScore: conversion.proof,
      businessImpact: 92,
      expectedImprovement: Math.round(Math.max(16, 82 - conversion.proof)),
      implementationConfidence: needsInput ? 40 : 80,
      verificationConfidence: needsInput ? 45 : 78,
      blocked: needsInput,
      blockedReason: needsInput
        ? "Verified customer proof must be supplied by the business."
        : undefined,
      dependsOn: defaultDependsOn("proof"),
      explanation:
        "Proof should appear before contact pressure so visitors have evidence at decision time.",
    });
  }

  if (conversion && conversion.ctaStrength < 70) {
    pushOpportunity(ops, {
      id: "cta",
      title: "Clarify the primary CTA",
      leader: "conversion_director",
      owner: "conversion_director",
      domain: "cta",
      sourceScore: conversion.ctaStrength,
      businessImpact: 84,
      expectedImprovement: 15,
      implementationConfidence: 85,
      verificationConfidence: 82,
      blocked: false,
      dependsOn: defaultDependsOn("cta"),
      explanation:
        "A more specific primary action would improve lead generation more than visual polish alone.",
    });
  }

  if (conversion && conversion.contactFlow < 68) {
    pushOpportunity(ops, {
      id: "contact_flow",
      title: "Simplify the contact path",
      leader: "conversion_director",
      owner: "conversion_director",
      domain: "contact_flow",
      sourceScore: conversion.contactFlow,
      businessImpact: 80,
      expectedImprovement: 14,
      implementationConfidence: 84,
      verificationConfidence: 80,
      blocked: false,
      dependsOn: defaultDependsOn("contact_flow"),
      explanation: "Contact options are incomplete or hard to act on.",
    });
  }

  if (
    taste &&
    taste.eligibleToJudge &&
    (taste.spacingHarmony < 74 || taste.polish < 74)
  ) {
    const spacingWeak = taste.spacingHarmony <= taste.polish;
    pushOpportunity(ops, {
      id: spacingWeak ? "spacing_polish" : "visual_polish",
      title: spacingWeak ? "Refine spacing" : "Apply final visual polish",
      leader: "taste",
      owner: "taste",
      domain: spacingWeak ? "spacing" : "visual_polish",
      sourceScore: spacingWeak ? taste.spacingHarmony : taste.polish,
      businessImpact: 55,
      expectedImprovement: 12,
      implementationConfidence: 88,
      verificationConfidence: 86,
      blocked: false,
      dependsOn: defaultDependsOn(
        spacingWeak ? "spacing_polish" : "visual_polish",
      ),
      explanation:
        "Spacing and finishing polish should wait until composition and conversion foundations are sound.",
    });
  }

  if (
    benchmark?.highestGap &&
    benchmark.highestGap.gap >= 10 &&
    !ops.some((o) => o.id === "narrative" || o.id === "trust")
  ) {
    pushOpportunity(ops, {
      id: "benchmark_gap",
      title: `Close the ${benchmark.highestGap.dimension
        .replace(/_/g, " ")
        .replace(/\s+quality$/i, "")} quality gap`,
      leader: "creative_director",
      owner: "benchmark",
      domain: "benchmark_comparison",
      sourceScore: Math.max(0, 100 - benchmark.highestGap.gap),
      businessImpact: 68,
      expectedImprovement: Math.min(22, Math.round(benchmark.highestGap.gap)),
      implementationConfidence: 70,
      verificationConfidence: 72,
      blocked: false,
      dependsOn: defaultDependsOn("benchmark_gap"),
      explanation:
        benchmark.recommendedFocus ||
        "A quality-bar gap is larger than local polish would solve.",
    });
  }

  for (const gap of gathered.capabilityGaps.slice(0, 3)) {
    if (!gap.userInputRequired && !gap.currentCapabilityMissing) continue;
    pushOpportunity(ops, {
      id: "capability_gap",
      title: gap.problem.slice(0, 72),
      leader: "capability_gap",
      owner: "capability_gap",
      domain: "proof",
      sourceScore: 40,
      businessImpact: gap.userInputRequired ? 88 : 70,
      expectedImprovement: 20,
      implementationConfidence: 30,
      verificationConfidence: 35,
      blocked: true,
      blockedReason: gap.recommendedNextStep,
      dependsOn: defaultDependsOn("capability_gap"),
      explanation: gap.recommendedNextStep,
    });
    break; // one capability gap slot — avoid duplicates
  }

  return ops;
}

export function gatherStrategicInputs(input: {
  project: BusinessProject;
  requestId?: string | null;
}): StrategicGatheredInputs {
  const creativeDirector = evaluateWebsiteAsCreativeDirector({
    project: input.project,
    requestId: input.requestId,
    logDiagnostics: false,
  });

  let visualComposition = null;
  try {
    const composition = resolveHeroCompositionFromProject(input.project);
    const visual = analyzeProjectVisualComposition({
      project: input.project,
      composition,
    });
    visualComposition = evaluateVisualComposition({ visual, composition });
  } catch {
    visualComposition = null;
  }

  let transformationPlan = null;
  let capabilityGaps: StrategicGatheredInputs["capabilityGaps"] = [];
  try {
    const built = buildTransformationPlanForProject(
      input.project,
      "Strategic Director assessment",
    );
    transformationPlan = built.plan;
    const classified = classifyTransformationGoals({
      plan: built.plan,
      project: input.project,
    });
    capabilityGaps = detectTransformationCapabilityGaps({
      project: input.project,
      plan: built.plan,
      evaluation: creativeDirector,
      classified,
    });
  } catch {
    transformationPlan = null;
    capabilityGaps = [];
  }

  return {
    creativeDirector,
    conversionDirector: creativeDirector.conversionDirectorEvaluation ?? null,
    taste: creativeDirector.tasteEvaluation ?? null,
    visualComposition,
    benchmark: creativeDirector.benchmarkComparison ?? null,
    transformationPlan,
    capabilityGaps,
  };
}

/**
 * Produce a StrategicAssessment from existing specialist outputs only.
 */
export function assessStrategicPriorities(input: {
  project: BusinessProject;
  requestId?: string | null;
  logDiagnostics?: boolean;
}): StrategicAssessment {
  const gathered = gatherStrategicInputs({
    project: input.project,
    requestId: input.requestId,
  });

  let opportunities = extractOpportunities(gathered);
  const conflicts = detectStrategicConflicts({ gathered, opportunities });
  opportunities = applyConflictResolutions(opportunities, conflicts);

  const openCount = opportunities.filter((o) => !o.blocked).length;
  const websiteState = inferWebsiteState({
    overallDesign: gathered.creativeDirector.dimensions.overallDesignScore,
    overallConversion: gathered.conversionDirector?.overallConversion ?? null,
    overallTaste: gathered.taste?.overallTaste ?? null,
    visualOverall: gathered.visualComposition?.overall ?? null,
    hasBlockingGaps: opportunities.some((o) => o.blocked),
    openOpportunityCount: openCount,
  });

  let confidence = 0.8;
  if (gathered.conversionDirector) confidence += 0.04;
  if (gathered.taste) confidence += 0.04;
  if (gathered.visualComposition) confidence += 0.04;
  if (gathered.benchmark) confidence += 0.02;
  confidence = Math.min(0.96, confidence);

  const assessment = assembleStrategicAssessment({
    opportunities,
    conflicts,
    websiteState,
    confidence,
  });

  const verified = verifyStrategicAssessment(assessment);
  if (!verified.ok && process.env.NODE_ENV === "development") {
    console.warn("[atlas:strategic-director:verify]", verified.failures);
  }

  if (input.logDiagnostics || process.env.NODE_ENV === "development") {
    logStrategicDiagnostics({
      assessment,
      requestId: input.requestId,
    });
  }

  return assessment;
}

/** Map assessment sequence into Transformation-friendly goal hints (titles only). */
export function strategicExecutionTitles(
  assessment: StrategicAssessment,
): string[] {
  return assessment.executionSequence
    .filter((s) => !s.blocked)
    .map((s) => s.title);
}

export type { StrategicOpportunityId };
