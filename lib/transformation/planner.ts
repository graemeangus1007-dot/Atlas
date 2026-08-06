/**
 * Transformation Planner — advisory only (Phase 1).
 * Creative Director → Design Strategy → Pattern Engine → Design Knowledge → Plan
 */

import type { DesignStrategy } from "@/lib/ai/design-strategy-types";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director";
import { detectTransformationConflicts } from "@/lib/transformation/conflicts";
import {
  dependenciesForGoals,
} from "@/lib/transformation/dependencies";
import {
  buildTransformationGraph,
  buildTransformationPhases,
} from "@/lib/transformation/graph";
import { prioritizeTransformationGoals } from "@/lib/transformation/prioritizer";
import {
  explainTransformationPlan,
  logTransformationDiagnostics,
} from "@/lib/transformation/presentation";
import { validateTransformationPlan } from "@/lib/transformation/validator";
import { buildWebsiteVision } from "@/lib/transformation/vision";
import {
  TRANSFORMATION_PLAN_VERSION,
  type TransformationGoal,
  type TransformationPlan,
} from "@/lib/transformation/types";

function goal(
  partial: TransformationGoal,
): TransformationGoal {
  return partial;
}

/**
 * Propose candidate goals from Creative Director + strategy signals.
 * No operations are attached — planning layer only.
 */
export function proposeTransformationGoals(input: {
  strategy: DesignStrategy;
  strategyInput: DesignStrategyInput;
  evaluation?: CreativeDirectorEvaluation | null;
}): TransformationGoal[] {
  const evaluation =
    input.evaluation ?? input.strategy.creativeDirectorEvaluation;
  const goals: TransformationGoal[] = [];

  goals.push(
    goal({
      id: "set_page_direction",
      objective: `Set page direction to “${input.strategy.overallDirection}”`,
      reason:
        "Every later change should serve one coordinated website vision.",
      priority: "critical",
      phase: "direction",
      dependencies: [],
      affectedSections: ["hero", "services", "contact"],
      expectedImprovement: 8,
      verificationCriteria: [
        "Vision direction is explicit",
        "Agency tones remain coherent",
      ],
      visitorImpact: 70,
      visualImpact: 55,
      risk: "low",
      effort: "low",
      requiredAssets: [],
      theme: "direction",
    }),
  );

  const heroScore =
    evaluation?.sections.find((s) => s.sectionId === "hero")?.score ?? 60;
  if (heroScore < 80 || !input.strategyInput.hasHeroImage) {
    goals.push(
      goal({
        id: "strengthen_hero",
        objective: "Strengthen the first impression",
        reason:
          evaluation?.executiveSummary.biggestStrength &&
          /first impression/i.test(
            evaluation.executiveSummary.biggestWeakness || "",
          )
            ? evaluation.executiveSummary.biggestWeakness
            : "The opening must carry the promise before visitors scroll.",
        priority: heroScore < 60 ? "critical" : "high",
        phase: "first_impression",
        dependencies: ["set_page_direction"],
        affectedSections: ["hero"],
        expectedImprovement: 14,
        verificationCriteria: [
          "Hero remains image-led when photography exists",
          "Primary CTA stays clear",
          "Brand palette unchanged",
        ],
        visitorImpact: 90,
        visualImpact: 92,
        risk: "medium",
        effort: "medium",
        requiredAssets: input.strategyInput.hasHeroImage
          ? []
          : ["hero photograph"],
        theme: "hero",
      }),
    );
  }

  const trustScore = evaluation?.trust.score ?? 50;
  if (trustScore < 70 || !input.strategyInput.hasTestimonials) {
    goals.push(
      goal({
        id: "establish_trust",
        objective: "Establish trust before the conversion ask",
        reason:
          "Visitors need evidence before they're asked to contact you.",
        priority: trustScore < 55 ? "critical" : "high",
        phase: "trust",
        dependencies: ["set_page_direction"],
        affectedSections: ["testimonials", "about", "faq"],
        expectedImprovement: 16,
        verificationCriteria: [
          "Trust signals appear before contact",
          "Social proof is present or planned",
        ],
        visitorImpact: 88,
        visualImpact: 50,
        risk: "low",
        effort: "medium",
        requiredAssets: input.strategyInput.hasTestimonials
          ? []
          : ["customer testimonials"],
        theme: "trust",
      }),
    );
  }

  if (input.strategyInput.sectionOrder.length > 0) {
    goals.push(
      goal({
        id: "clarify_services",
        objective: "Clarify the services offer",
        reason:
          "Services should translate the hero promise into scannable, specific options.",
        priority: "medium",
        phase: "offer",
        dependencies: ["set_page_direction"],
        affectedSections: ["services"],
        expectedImprovement: 10,
        verificationCriteria: [
          "Services remain scannable",
          "Offer matches business type",
        ],
        visitorImpact: 72,
        visualImpact: 48,
        risk: "low",
        effort: "medium",
        requiredAssets: [],
        theme: "messaging",
      }),
    );
  }

  const gallerySlots = input.strategyInput.galleryFilledSlots;
  if (gallerySlots < 4 || (evaluation?.trust.missing ?? []).some((m) => /gallery|imagery|photo/i.test(m))) {
    goals.push(
      goal({
        id: "strengthen_proof",
        objective: "Strengthen proof imagery and evidence",
        reason:
          "The hero promise needs visible proof — finished work, not claims alone.",
        priority: gallerySlots === 0 ? "high" : "medium",
        phase: "proof",
        dependencies: ["establish_trust", "clarify_services"],
        affectedSections: ["gallery", "testimonials"],
        expectedImprovement: 15,
        verificationCriteria: [
          "Proof imagery supports the hero claim",
          "Gallery depth is sufficient for the industry",
        ],
        visitorImpact: 84,
        visualImpact: 90,
        risk: "medium",
        effort: "high",
        requiredAssets: gallerySlots < 3 ? ["project photographs"] : [],
        theme: "proof",
      }),
    );
  }

  const askBeforeTrust = evaluation?.flow.issues.some(
    (i) =>
      i.kind === "ask_before_trust" ||
      i.kind === "contact_before_proof" ||
      i.kind === "testimonials_too_late",
  );
  if (askBeforeTrust || !input.strategyInput.hasTestimonials) {
    goals.push(
      goal({
        id: "sequence_proof_before_ask",
        objective: "Sequence proof before the contact ask",
        reason:
          "Moving proof immediately after services answers: “Can I trust this company?”",
        priority: "high",
        phase: "proof",
        dependencies: ["establish_trust"],
        affectedSections: ["services", "testimonials", "gallery", "contact"],
        expectedImprovement: 12,
        verificationCriteria: [
          "Proof appears before primary contact ask",
          "Section order supports trust → conversion",
        ],
        visitorImpact: 86,
        visualImpact: 40,
        risk: "low",
        effort: "low",
        requiredAssets: [],
        theme: "flow",
      }),
    );
  }

  goals.push(
    goal({
      id: "simplify_conversion",
      objective: "Simplify the conversion path",
      reason:
        "Once trust exists, every section should lead naturally to one clear next step.",
      priority: "high",
      phase: "conversion",
      dependencies: ["sequence_proof_before_ask", "strengthen_proof"],
      affectedSections: ["hero", "cta", "contact"],
      expectedImprovement: 11,
      verificationCriteria: [
        "CTA wording is specific",
        "Contact remains reachable",
        "No brand palette change",
      ],
      visitorImpact: 80,
      visualImpact: 45,
      risk: "low",
      effort: "low",
      requiredAssets: [],
      theme: "conversion",
    }),
  );

  if ((evaluation?.rhythm.score ?? 70) < 70) {
    goals.push(
      goal({
        id: "improve_rhythm",
        objective: "Improve visual rhythm across sections",
        reason:
          "Heavy stacks without lighter beats make the page feel exhausting.",
        priority: "medium",
        phase: "polish",
        dependencies: ["simplify_conversion"],
        affectedSections: ["about", "services", "gallery", "footer"],
        expectedImprovement: 7,
        verificationCriteria: ["Section pacing alternates heavy and light"],
        visitorImpact: 55,
        visualImpact: 70,
        risk: "low",
        effort: "medium",
        requiredAssets: [],
        theme: "rhythm",
      }),
    );
  }

  if (
    input.strategy.messageOverload ||
    (evaluation?.crossSectionInsights ?? []).some((i) =>
      /repeat|too long|overload/i.test(i.explanation),
    )
  ) {
    goals.push(
      goal({
        id: "tighten_messaging",
        objective: "Tighten repeated messaging",
        reason:
          "About and services should not retell the same story in different words.",
        priority: "medium",
        phase: "polish",
        dependencies: ["clarify_services"],
        affectedSections: ["about", "services"],
        expectedImprovement: 6,
        verificationCriteria: [
          "Messaging is non-redundant",
          "Proof sections are not removed",
        ],
        visitorImpact: 50,
        visualImpact: 30,
        risk: "low",
        effort: "medium",
        requiredAssets: [],
        theme: "messaging",
      }),
    );
  }

  // Bind dependencies only to goals that exist in this plan
  const idSet = new Set(goals.map((g) => g.id));
  return goals.map((g) => ({
    ...g,
    dependencies: g.dependencies.filter((d) => idSet.has(d)),
  }));
}

/**
 * Build a full advisory Transformation Plan.
 * Does not execute edits or mutate the website.
 */
export function planWebsiteTransformation(input: {
  strategy: DesignStrategy;
  strategyInput: DesignStrategyInput;
  evaluation?: CreativeDirectorEvaluation | null;
  requestId?: string | null;
  logDiagnostics?: boolean;
}): TransformationPlan {
  const evaluation =
    input.evaluation ?? input.strategy.creativeDirectorEvaluation;
  const vision = buildWebsiteVision({
    strategy: input.strategy,
    strategyInput: input.strategyInput,
    evaluation,
  });

  const proposed = proposeTransformationGoals({
    strategy: input.strategy,
    strategyInput: input.strategyInput,
    evaluation,
  });
  const prioritized = prioritizeTransformationGoals(proposed, evaluation);
  const dependencies = dependenciesForGoals(prioritized);

  // Align goal.dependencies with edge list
  const goals = prioritized.map((g) => ({
    ...g,
    dependencies: dependencies
      .filter((d) => d.to === g.id)
      .map((d) => d.from),
  }));

  const graph = buildTransformationGraph(goals, dependencies);
  // Reorder goals to dependency order while keeping priority as secondary sort
  const orderIndex = new Map(graph.dependencyOrder.map((id, i) => [id, i]));
  const orderedGoals = [...goals].sort(
    (a, b) =>
      (orderIndex.get(a.id) ?? 99) - (orderIndex.get(b.id) ?? 99),
  );

  const phases = buildTransformationPhases(orderedGoals);
  const conflicts = detectTransformationConflicts({
    goals: orderedGoals,
    dependencies,
    vision,
    strategy: input.strategy,
    evaluation,
  });
  const validation = validateTransformationPlan({
    vision,
    goals: orderedGoals,
    graph,
    conflicts,
    strategy: input.strategy,
  });

  const expectedScoreDelta = Math.min(
    28,
    Math.round(
      orderedGoals.reduce((sum, g) => sum + g.expectedImprovement, 0) * 0.45,
    ),
  );

  const riskCounts = { low: 0, medium: 0, high: 0 };
  for (const g of orderedGoals) riskCounts[g.risk] += 1;
  const planRisk =
    conflicts.some((c) => c.severity === "high")
      ? "high"
      : riskCounts.high > 0
        ? "medium"
        : "low";

  const confidence = Math.max(
    0.45,
    Math.min(
      0.92,
      input.strategy.confidence * 0.5 +
        (validation.passed ? 0.25 : 0.1) +
        (conflicts.length === 0 ? 0.15 : 0.05) +
        Math.min(0.12, expectedScoreDelta / 100),
    ),
  );

  const draft: TransformationPlan = {
    version: TRANSFORMATION_PLAN_VERSION,
    createdAt: new Date().toISOString(),
    vision,
    phases,
    goals: orderedGoals,
    dependencies,
    graph,
    conflicts,
    validation,
    expectedScoreDelta,
    risk: planRisk,
    confidence: Math.round(confidence * 100) / 100,
    explanation: "",
  };
  draft.explanation = explainTransformationPlan(draft);

  if (input.logDiagnostics) {
    logTransformationDiagnostics(draft, input.requestId);
  }

  return draft;
}
