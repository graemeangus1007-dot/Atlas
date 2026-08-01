import { describe, expect, it } from "vitest";
import {
  buildDesignCritiqueContext,
  buildMockDesignCritique,
} from "@/lib/ai/design-critique";
import {
  applyDesignStrategyToCritique,
  buildDesignStrategy,
  formatDesignStrategySection,
  prioritizeImprovementsByStrategy,
  runDesignStrategyPass,
  scoreImprovementAgainstStrategy,
} from "@/lib/ai/design-strategy";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harbor Craft Builders",
    businessType: "Coastal custom home builder",
    description: "Luxury coastal craftsmanship and custom builds.",
    heroHeadline: "Homes shaped by the shoreline",
    heroSubheadline: "Premium custom builds with quiet, coastal detail.",
    primaryCta: "Request a quote",
    mediaLibrary: [],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<DesignStrategyInput> = {},
): DesignStrategyInput {
  return {
    businessName: "Harbor Craft Builders",
    industry: "Coastal custom home builder",
    businessDescription: "Luxury coastal craftsmanship and custom builds.",
    targetAudience: "Homeowners planning a high-end coastal renovation",
    primaryGoal: "Generate qualified quote requests",
    heroTitle: "Homes shaped by the shoreline",
    heroDescription: "Premium custom builds with quiet, coastal detail.",
    primaryCta: "Request a quote",
    sectionOrder: ["hero", "services", "about", "contact"],
    enabledSections: ["hero", "services", "about", "contact"],
    hasHeroImage: false,
    hasTestimonials: false,
    hasFaq: false,
    galleryFilledSlots: 0,
    libraryCount: 0,
    spacing: "default",
    visualHierarchy: false,
    maturityLevel: "draft",
    overallCompleteness: 42,
    designLanguage: "Warm editorial",
    businessTone: "premium coastal",
    ...overrides,
  };
}

describe("buildDesignStrategy", () => {
  it("answers agency strategy questions before edits", () => {
    const strategy = buildDesignStrategy(baseInput());
    expect(strategy.overallDirection).toMatch(/premium|craft|luxury|coastal/i);
    expect(strategy.agencyTones.length).toBeGreaterThan(0);
    expect(strategy.agencyTones).toEqual(
      expect.arrayContaining(["luxury", "premium"]),
    );
    expect(strategy.biggestProblem).toMatch(/visual proof|trust|unfinished/i);
    expect(strategy.currentImpression.length).toBeGreaterThan(20);
    expect(strategy.desiredEmotion.length).toBeGreaterThan(10);
    expect(strategy.customer).toMatch(/homeowners|coastal/i);
    expect(strategy.primaryFocusSection).toBe("hero");
    expect(strategy.designGoals.length).toBeGreaterThanOrEqual(3);
    expect(strategy.executionPlan.length).toBeGreaterThanOrEqual(3);
    expect(strategy.missingTrustSignals.length).toBeGreaterThan(0);
  });

  it("prioritizes proof when imagery exists but testimonials are missing", () => {
    const strategy = buildDesignStrategy(
      baseInput({
        hasHeroImage: true,
        libraryCount: 4,
        hasTestimonials: false,
      }),
    );
    expect(strategy.biggestProblem).toMatch(/proof|trust/i);
    expect(strategy.priorityFocus).toContain("proof");
    expect(strategy.executionPlan.some((s) => /testimonial/i.test(s))).toBe(
      true,
    );
  });
});

describe("prioritizeImprovementsByStrategy", () => {
  it("ranks proof/trust improvements above generic polish when strategy focuses on proof", () => {
    const context = buildDesignCritiqueContext(sampleProject());
    const critique = buildMockDesignCritique(context, "Complete my website");
    const strategy = buildDesignStrategy(
      baseInput({
        hasHeroImage: true,
        libraryCount: 2,
        hasTestimonials: false,
      }),
    );
    const ordered = prioritizeImprovementsByStrategy(
      critique.prioritizedImprovements,
      strategy,
    );
    const top = ordered[0];
    expect(top).toBeTruthy();
    const topBlob = `${top!.title} ${top!.rationale} ${top!.affectedAreas.join(" ")}`;
    expect(topBlob).toMatch(/testimonial|proof|trust|hero|image/i);
    expect(
      scoreImprovementAgainstStrategy(ordered[0]!, strategy),
    ).toBeGreaterThanOrEqual(
      scoreImprovementAgainstStrategy(ordered[ordered.length - 1]!, strategy),
    );
  });
});

describe("runDesignStrategyPass", () => {
  it("rewrites design direction from strategy and strategizes proof copy", () => {
    const context = buildDesignCritiqueContext(sampleProject());
    const critique = buildMockDesignCritique(context, "Review my website");
    const { strategy, critique: next } = runDesignStrategyPass({
      context,
      critique,
      request: "Complete my website",
    });

    expect(next.designDirection.name).toBe(strategy.overallDirection);
    expect(next.designDirection.rationale).toBe(strategy.biggestProblem);

    const proof = next.prioritizedImprovements.find((i) =>
      /testimonial/i.test(i.title),
    );
    if (proof) {
      expect(proof.rationale).toMatch(/below the hero|trust/i);
    }
  });

  it("formats a strategy section for the conversation", () => {
    const strategy = buildDesignStrategy(baseInput());
    const text = formatDesignStrategySection(strategy);
    expect(text).toMatch(/^Overall direction/m);
    expect(text).toMatch(/^Biggest problem/m);
    expect(text).toMatch(/^Design goals/m);
    expect(text).toMatch(/^Execution plan/m);
  });
});

describe("applyDesignStrategyToCritique", () => {
  it("keeps at most five prioritized improvements", () => {
    const context = buildDesignCritiqueContext(sampleProject());
    const critique = buildMockDesignCritique(context, "Review");
    const strategy = buildDesignStrategy(baseInput());
    const next = applyDesignStrategyToCritique(critique, strategy);
    expect(next.prioritizedImprovements.length).toBeLessThanOrEqual(5);
  });
});
