/**
 * Transformation Engine Phase 1 — planner only (no execution).
 */

import { describe, expect, it } from "vitest";
import {
  buildDesignStrategy,
  STRATEGY_VERSION,
} from "@/lib/ai/design-strategy";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import {
  planWebsiteTransformation,
  transformationTextExposesInternalIds,
} from "@/lib/transformation";

function strategyInput(
  overrides: Partial<DesignStrategyInput> = {},
): DesignStrategyInput {
  return {
    businessName: "Atlas Demo Co",
    industry: "Landscaping",
    businessDescription: "Outdoor design and build for local homeowners.",
    targetAudience: "Homeowners",
    primaryGoal: "Get more customers",
    heroTitle: "Outdoor spaces that feel finished",
    heroDescription: "Design, build, and care for yards that look intentional.",
    primaryCta: "Get a quote",
    sectionOrder: ["hero", "about", "services", "contact"],
    enabledSections: ["hero", "about", "services", "contact"],
    hasHeroImage: true,
    hasTestimonials: false,
    hasFaq: false,
    galleryFilledSlots: 1,
    libraryCount: 2,
    spacing: "comfortable",
    visualHierarchy: true,
    maturityLevel: "Developing",
    overallCompleteness: 52,
    designLanguage: "professional",
    businessTone: "trustworthy",
    ...overrides,
  };
}

const INDUSTRIES = [
  "Landscaping",
  "Roofing",
  "Restaurant",
  "Law",
  "Dental",
  "Luxury Builder",
  "Gym",
  "Plumber",
  "Electrician",
] as const;

describe("Transformation Engine Phase 1", () => {
  it("attaches transformation plan on Design Strategy 1.5", () => {
    expect(STRATEGY_VERSION).toBe("1.5.0");
    const strategy = buildDesignStrategy(strategyInput());
    expect(strategy.transformationPlan).toBeTruthy();
    expect(strategy.transformationPlan!.version).toBe("1.0.0");
    expect(strategy.transformationPlan!.goals.length).toBeGreaterThan(2);
    expect(strategy.transformationPlan!.graph.dependencyOrder.length).toBe(
      strategy.transformationPlan!.goals.length,
    );
  });

  it.each(INDUSTRIES)("builds a coherent plan for %s", (industry) => {
    const input = strategyInput({
      industry,
      businessName: `${industry} Studio`,
      businessTone: /luxury/i.test(industry) ? "luxury" : "professional",
      designLanguage: /luxury/i.test(industry) ? "premium" : "modern",
    });
    const strategy = buildDesignStrategy(input);
    const plan = strategy.transformationPlan!;

    expect(plan.vision.overallDirection.length).toBeGreaterThan(5);
    expect(plan.vision.constraints.some((c) => /brand/i.test(c))).toBe(true);
    expect(plan.phases.length).toBeGreaterThan(1);
    expect(plan.goals.length).toBeGreaterThan(2);
    expect(plan.graph.dependencyOrder.length).toBe(plan.goals.length);
    expect(plan.expectedScoreDelta).toBeGreaterThan(0);
    expect(plan.confidence).toBeGreaterThan(0.4);
    expect(plan.validation.dependencySafe).toBe(true);
    expect(plan.explanation.length).toBeGreaterThan(80);
    expect(transformationTextExposesInternalIds(plan.explanation)).toBe(false);

    // Conversion must not precede trust/proof when both exist
    const order = plan.graph.dependencyOrder;
    const trustIdx = order.indexOf("establish_trust");
    const proofIdx = order.indexOf("sequence_proof_before_ask");
    const convIdx = order.indexOf("simplify_conversion");
    if (convIdx >= 0 && trustIdx >= 0) {
      expect(convIdx).toBeGreaterThan(trustIdx);
    }
    if (convIdx >= 0 && proofIdx >= 0) {
      expect(convIdx).toBeGreaterThan(proofIdx);
    }
  });

  it("creates vision, graph, conflicts model, and natural presentation", () => {
    const strategy = buildDesignStrategy(
      strategyInput({
        hasTestimonials: false,
        galleryFilledSlots: 0,
      }),
    );
    const plan = planWebsiteTransformation({
      strategy,
      strategyInput: strategyInput({ hasTestimonials: false }),
      evaluation: strategy.creativeDirectorEvaluation,
    });

    expect(plan.vision.highestPriorityProblem.length).toBeGreaterThan(10);
    expect(plan.vision.visitorJourney.length).toBeGreaterThan(2);
    expect(plan.graph.nodes.length).toBe(plan.goals.length);
    expect(Array.isArray(plan.conflicts)).toBe(true);
    expect(plan.validation.complete).toBe(true);
    expect(plan.explanation.toLowerCase()).toMatch(
      /first|trust|conversion|redesign|strengthen/,
    );
    expect(plan.explanation).not.toMatch(/operation:/i);
    expect(
      plan.goals.every((g) => g.expectedImprovement > 0),
    ).toBe(true);
  });

  it("prioritizes trust/proof before conversion for weak-trust sites", () => {
    const strategy = buildDesignStrategy(
      strategyInput({
        hasTestimonials: false,
        galleryFilledSlots: 0,
      }),
    );
    const plan = strategy.transformationPlan!;
    const topThemes = plan.goals.slice(0, 4).map((g) => g.theme);
    expect(
      topThemes.some((t) => t === "trust" || t === "proof" || t === "flow"),
    ).toBe(true);
  });

  it("surfaces conflicts instead of silently ignoring them", () => {
    const strategy = buildDesignStrategy(
      strategyInput({
        industry: "Luxury Builder",
        designLanguage: "luxury",
        businessTone: "luxury premium",
        hasTestimonials: false,
      }),
    );
    const plan = strategy.transformationPlan!;
    // Conflicts array is always present; high-severity ones must include resolution text
    for (const conflict of plan.conflicts) {
      expect(conflict.explanation.length).toBeGreaterThan(20);
      expect(conflict.resolution.length).toBeGreaterThan(10);
    }
    expect(plan.validation).toMatchObject({
      complete: expect.any(Boolean),
      dependencySafe: expect.any(Boolean),
      brandCompatible: true,
    });
  });
});
