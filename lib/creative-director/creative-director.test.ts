/**
 * Whole-page Creative Director evaluation — analysis only.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  buildDesignStrategy,
  STRATEGY_VERSION,
} from "@/lib/ai/design-strategy";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import {
  evaluateWebsiteAsCreativeDirector,
  textExposesInternalIds,
} from "@/lib/creative-director";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1200,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
    unavailable: false,
  };
}

function strategyInput(
  overrides: Partial<DesignStrategyInput> = {},
): DesignStrategyInput {
  return {
    businessName: "Harborview Landscaping",
    industry: "Landscaping",
    businessDescription:
      "Outdoor design and build for homeowners who want finished yards.",
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
    galleryFilledSlots: 0,
    libraryCount: 1,
    spacing: "comfortable",
    visualHierarchy: true,
    maturityLevel: "Developing",
    overallCompleteness: 55,
    designLanguage: "professional",
    businessTone: "trustworthy",
    ...overrides,
  };
}

function projectFor(
  industry: string,
  extras: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: `${industry} Co`,
    businessType: industry as BusinessProject["businessType"],
    description: `${industry} professionals serving local customers with quality work.`,
    heroHeadline: `${industry} done right`,
    heroSubheadline: `Trusted ${industry.toLowerCase()} for homes and businesses.`,
    primaryCta: "Contact us",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1", "Hero")],
    galleryImageIds: [],
    designSections: undefined,
    atlasActionMemory: undefined,
    ...extras,
  };
}

const INDUSTRIES = [
  "Landscaping",
  "Roofing",
  "Law",
  "Dental",
  "Restaurant",
  "Gym",
  "Plumber",
  "Electrician",
  "Luxury Home Builder",
  "Photographer",
] as const;

describe("Creative Director whole-page evaluation", () => {
  it("strategy version attaches creative director evaluation", () => {
    expect(["1.4.0", "1.5.0"]).toContain(STRATEGY_VERSION);
    const strategy = buildDesignStrategy(strategyInput());
    expect(strategy.creativeDirectorEvaluation).toBeTruthy();
    expect(strategy.creativeDirectorEvaluation!.version).toBe("1.0.0");
    expect(
      strategy.creativeDirectorEvaluation!.dimensions.overallDesignScore,
    ).toBeGreaterThan(0);
  });

  it.each(INDUSTRIES)("evaluates %s without leaking internal IDs", (industry) => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      project: projectFor(industry),
      strategyInput: strategyInput({
        industry,
        businessName: `${industry} Co`,
        heroTitle: `${industry} done right`,
      }),
    });

    expect(evaluation.sections.length).toBeGreaterThan(3);
    expect(evaluation.dimensions.overallDesignScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.dimensions.overallDesignScore).toBeLessThanOrEqual(100);
    expect(evaluation.flow.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.rhythm.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.trust.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.conversion.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.narrative.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.health.professionalism).toBeGreaterThanOrEqual(0);
    expect(evaluation.recommendations.length).toBeGreaterThan(0);
    expect(evaluation.recommendations[0]!.estimatedImpact).toBeGreaterThanOrEqual(
      evaluation.recommendations.at(-1)?.estimatedImpact ?? 0,
    );

    const blob = [
      evaluation.executiveSummary.professionalAssessment,
      evaluation.executiveSummary.fastestImprovement,
      ...evaluation.recommendations.map((r) => r.creativeDirectorExplanation),
      ...evaluation.crossSectionInsights.map((i) => i.explanation),
    ].join("\n");
    expect(textExposesInternalIds(blob)).toBe(false);
  });

  it("scores sections, narrative, flow, trust, conversion, rhythm", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      strategyInput: strategyInput({
        hasTestimonials: false,
        galleryFilledSlots: 0,
      }),
    });

    const hero = evaluation.sections.find((s) => s.sectionId === "hero");
    expect(hero?.present).toBe(true);
    expect(hero?.score).toBeGreaterThan(40);

    expect(evaluation.narrative.beginning.toLowerCase()).toMatch(/opens|unclear/);
    expect(evaluation.flow.issues.some((i) => i.kind === "ask_before_trust")).toBe(
      true,
    );
    expect(evaluation.trust.missing.length).toBeGreaterThan(0);
    expect(evaluation.conversion.decisionConfidence).toBeLessThan(90);
    expect(evaluation.rhythm.cadence.length).toBeGreaterThan(0);
    expect(evaluation.diagnostics.highestROIRecommendation).toBeTruthy();
  });

  it("improves trust/flow when proof exists in better order", () => {
    const weak = evaluateWebsiteAsCreativeDirector({
      strategyInput: strategyInput({
        hasTestimonials: false,
        galleryFilledSlots: 0,
        sectionOrder: ["hero", "services", "contact"],
      }),
    });
    const strong = evaluateWebsiteAsCreativeDirector({
      project: projectFor("Landscaping", {
        galleryImageIds: ["g1", "g2", "g3", "g4"],
        mediaLibrary: [
          asset("hero-1", "Hero"),
          asset("g1", "Patio"),
          asset("g2", "Lawn"),
          asset("g3", "Walkway"),
          asset("g4", "Garden"),
        ],
        designSections: {
          enabled: ["testimonials", "faq"],
          testimonials: [
            { quote: "Amazing work", author: "Sam", role: "Homeowner" },
            { quote: "On time and clean", author: "Alex", role: "Homeowner" },
          ],
          faq: [{ question: "How soon?", answer: "This week." }],
        },
        sectionOrder: [
          "hero",
          "about",
          "services",
          "gallery",
          "testimonials",
          "faq",
          "contact",
        ],
      }),
      strategyInput: strategyInput({
        hasTestimonials: true,
        hasFaq: true,
        galleryFilledSlots: 4,
        sectionOrder: [
          "hero",
          "about",
          "services",
          "gallery",
          "testimonials",
          "faq",
          "contact",
        ],
        enabledSections: [
          "hero",
          "about",
          "services",
          "gallery",
          "testimonials",
          "faq",
          "contact",
        ],
      }),
    });

    expect(strong.trust.score).toBeGreaterThan(weak.trust.score);
    expect(strong.flow.score).toBeGreaterThanOrEqual(weak.flow.score);
    expect(strong.dimensions.overallDesignScore).toBeGreaterThan(
      weak.dimensions.overallDesignScore,
    );
  });

  it("speaks like a creative director, not a terse instruction", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      strategyInput: strategyInput({ hasTestimonials: false }),
    });
    const top = evaluation.recommendations[0]!;
    expect(top.creativeDirectorExplanation.length).toBeGreaterThan(60);
    expect(top.creativeDirectorExplanation.toLowerCase()).toMatch(
      /visitor|trust|evidence|proof|contact|question/,
    );
    expect(top.creativeDirectorExplanation).not.toMatch(/^Move testimonials\.?$/i);
  });

  it("exposes Health Score 2.0 dimensions", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      strategyInput: strategyInput(),
    });
    expect(evaluation.health).toMatchObject({
      overall: expect.any(Number),
      design: expect.any(Number),
      trust: expect.any(Number),
      conversion: expect.any(Number),
      narrative: expect.any(Number),
      visualHierarchy: expect.any(Number),
      readability: expect.any(Number),
      brand: expect.any(Number),
      mobile: expect.any(Number),
      accessibility: expect.any(Number),
      professionalism: expect.any(Number),
    });
  });
});
