/**
 * Design Pattern Engine — deterministic foundation tests.
 */

import { describe, expect, it } from "vitest";
import {
  arePatternsHardIncompatible,
  buildCompatibilityGraph,
  composeDesignPatterns,
  countDesignPatternsByCategory,
  explainDesignPatternComposition,
  getDesignPatternById,
  getDesignPatternsByCategory,
  inferIndustryAffinityTags,
  isCompatiblePatternSet,
  listAllDesignPatterns,
  scoreComposition,
  scorePatternForContext,
  scorePatternPairCompatibility,
  selectCandidatePatterns,
  textExposesDesignPatternIds,
} from "@/lib/ai/design-patterns";
import { buildDesignStrategy } from "@/lib/ai/design-strategy";
import type { DesignStrategyInput } from "@/lib/ai/design-strategy-types";
import { formatDesignStrategySection } from "@/lib/ai/design-strategy";

function strategyInput(
  overrides: Partial<DesignStrategyInput> = {},
): DesignStrategyInput {
  return {
    businessName: "Harborview Landscapes",
    industry: "Landscaping contractor",
    businessDescription:
      "Premium outdoor living and hardscaping for coastal homes.",
    targetAudience: "Homeowners who want a polished yard",
    primaryGoal: "Get more quote requests",
    heroTitle: "Outdoor spaces that feel finished",
    heroDescription: "Design, build, and care for yards that look intentional.",
    primaryCta: "Request a quote",
    sectionOrder: ["hero", "services", "gallery", "contact"],
    enabledSections: ["hero", "services", "gallery", "contact"],
    hasHeroImage: true,
    hasTestimonials: true,
    hasFaq: false,
    galleryFilledSlots: 4,
    libraryCount: 8,
    spacing: "comfortable",
    visualHierarchy: true,
    maturityLevel: "polished",
    overallCompleteness: 72,
    designLanguage: "Craft premium",
    businessTone: "trustworthy premium",
    ...overrides,
  };
}

describe("pattern registry", () => {
  it("registers patterns across all required categories", () => {
    const counts = countDesignPatternsByCategory();
    expect(counts.hero).toBeGreaterThanOrEqual(15);
    expect(counts.trust).toBeGreaterThanOrEqual(10);
    expect(counts.services).toBeGreaterThanOrEqual(10);
    expect(counts.gallery).toBeGreaterThanOrEqual(10);
    expect(counts.cta).toBeGreaterThanOrEqual(10);
    expect(listAllDesignPatterns().length).toBe(
      counts.hero +
        counts.trust +
        counts.services +
        counts.gallery +
        counts.cta,
    );
  });

  it("keeps ids unique and prefix-aligned", () => {
    const ids = listAllDesignPatterns().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of listAllDesignPatterns()) {
      expect(p.id.startsWith(`${p.category}.`)).toBe(true);
      expect(getDesignPatternById(p.id)?.name).toBe(p.name);
    }
  });
});

describe("compatibility", () => {
  it("blocks hard anti-pairs", () => {
    expect(
      arePatternsHardIncompatible("hero.luxury_center", "services.comparison"),
    ).toBe(true);
    expect(
      isCompatiblePatternSet([
        "hero.luxury_center",
        "services.comparison",
        "cta.luxury_contact",
      ]),
    ).toBe(false);
  });

  it("scores declared compatible pairs higher", () => {
    const hero = getDesignPatternById("hero.contractor_left")!;
    const trust = getDesignPatternById("trust.google_reviews")!;
    const clash = getDesignPatternById("gallery.pinterest")!;
    expect(scorePatternPairCompatibility(hero, trust)).toBeGreaterThan(
      scorePatternPairCompatibility(hero, clash),
    );
  });

  it("builds a compatibility graph with neighbors", () => {
    const graph = buildCompatibilityGraph();
    expect(graph.size).toBe(listAllDesignPatterns().length);
    expect((graph.get("hero.contractor_left") ?? []).length).toBeGreaterThan(0);
  });
});

describe("selectors + industry", () => {
  it("infers landscaping / contractor affinities", () => {
    const tags = inferIndustryAffinityTags({
      industry: "Landscaping contractor",
      businessDescription: "Outdoor living and hardscape",
    });
    expect(tags).toEqual(
      expect.arrayContaining(["landscaping", "contractor", "local_service"]),
    );
  });

  it("prefers contractor heroes for trades", () => {
    const heroes = selectCandidatePatterns(
      "hero",
      {
        industry: "Contractor",
        businessDescription: "Local remodeling and outdoor builds",
        agencyTones: ["trustworthy", "approachable"],
        hasHeroImage: true,
        galleryFilledSlots: 3,
        libraryCount: 5,
        hasTestimonials: true,
        primaryGoal: "Get more customers",
      },
      5,
    );
    expect(heroes.length).toBeGreaterThan(0);
    expect(
      heroes.some(
        (h) =>
          h.id.includes("contractor") ||
          h.id.includes("before_after") ||
          h.id.includes("conversion"),
      ),
    ).toBe(true);
  });

  it("scores luxury restaurant patterns toward luxury heroes", () => {
    const cinematic = scorePatternForContext(
      getDesignPatternById("hero.cinematic_full_width")!,
      {
        industry: "Luxury coastal restaurant",
        agencyTones: ["luxury", "premium"],
        hasHeroImage: true,
        libraryCount: 6,
        galleryFilledSlots: 4,
      },
    );
    const contractor = scorePatternForContext(
      getDesignPatternById("hero.contractor_left")!,
      {
        industry: "Luxury coastal restaurant",
        agencyTones: ["luxury", "premium"],
        hasHeroImage: true,
        libraryCount: 6,
        galleryFilledSlots: 4,
      },
    );
    expect(cinematic).toBeGreaterThan(contractor);
  });
});

describe("composition + scoring", () => {
  it("assembles hero → trust → services → gallery → cta flow", () => {
    const composition = composeDesignPatterns({
      industry: "Landscaping",
      businessDescription: "Premium outdoor living",
      agencyTones: ["premium", "trustworthy", "handcrafted"],
      hasHeroImage: true,
      hasTestimonials: true,
      galleryFilledSlots: 4,
      libraryCount: 8,
      primaryGoal: "Collect leads",
    });
    expect(composition.patternIds.some((id) => id.startsWith("hero."))).toBe(
      true,
    );
    expect(composition.patternIds.some((id) => id.startsWith("cta."))).toBe(
      true,
    );
    expect(composition.slots.map((s) => s.section)).toEqual([
      "hero",
      "trust",
      "services",
      "gallery",
      "cta",
      "contact",
      "footer",
    ]);
    expect(isCompatiblePatternSet(composition.patternIds)).toBe(true);
    expect(composition.score).toBeGreaterThan(0.3);
  });

  it("scores compositions with all required dimensions", () => {
    const composition = composeDesignPatterns({
      industry: "Contractor",
      agencyTones: ["trustworthy", "modern"],
      hasHeroImage: true,
      galleryFilledSlots: 3,
      libraryCount: 4,
      hasTestimonials: true,
    });
    const { score, dimensions } = scoreComposition(composition, {
      industry: "Contractor",
      agencyTones: ["trustworthy", "modern"],
      hasHeroImage: true,
      galleryFilledSlots: 3,
      hasTestimonials: true,
    });
    expect(score).toBe(composition.score);
    for (const key of Object.keys(dimensions)) {
      expect(dimensions[key as keyof typeof dimensions]).toBeGreaterThanOrEqual(
        0,
      );
      expect(dimensions[key as keyof typeof dimensions]).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for the same context", () => {
    const ctx = {
      industry: "Coastal landscaping",
      agencyTones: ["premium", "timeless"] as const,
      hasHeroImage: true,
      galleryFilledSlots: 4,
      libraryCount: 6,
      hasTestimonials: true,
    };
    const a = composeDesignPatterns({ ...ctx, agencyTones: [...ctx.agencyTones] });
    const b = composeDesignPatterns({ ...ctx, agencyTones: [...ctx.agencyTones] });
    expect(a.patternIds).toEqual(b.patternIds);
    expect(a.score).toBe(b.score);
  });
});

describe("explanations", () => {
  it("explains without exposing pattern ids", () => {
    const composition = composeDesignPatterns({
      industry: "Landscaping",
      hasHeroImage: true,
      galleryFilledSlots: 4,
      libraryCount: 6,
      agencyTones: ["premium", "handcrafted"],
    });
    const text = explainDesignPatternComposition(composition, {
      industry: "Landscaping",
      hasHeroImage: true,
      galleryFilledSlots: 4,
    });
    expect(text.length).toBeGreaterThan(40);
    expect(textExposesDesignPatternIds(text)).toBe(false);
    expect(text).not.toMatch(/\bhero\./i);
  });
});

describe("strategy integration", () => {
  it("attaches pattern composition to design strategy", () => {
    const strategy = buildDesignStrategy(strategyInput());
    expect(strategy.patternComposition).toBeTruthy();
    expect(strategy.patternComposition!.patternIds.length).toBeGreaterThan(0);
    expect(strategy.patternComposition!.explanation.length).toBeGreaterThan(20);
    expect(
      textExposesDesignPatternIds(strategy.patternComposition!.explanation),
    ).toBe(false);
    expect(strategy.patternComposition!.sectionFlow.length).toBeGreaterThan(3);
  });

  it("surfaces composition approach in formatted strategy without ids", () => {
    const strategy = buildDesignStrategy(strategyInput());
    const formatted = formatDesignStrategySection(strategy);
    expect(formatted).toMatch(/Composition approach/i);
    expect(textExposesDesignPatternIds(formatted)).toBe(false);
  });

  it("selects differently for restaurant vs contractor industries", () => {
    const restaurant = buildDesignStrategy(
      strategyInput({
        industry: "Fine dining restaurant",
        businessDescription: "Luxury coastal tasting menus",
        businessTone: "luxury editorial",
        primaryCta: "Reserve a table",
      }),
    );
    const contractor = buildDesignStrategy(
      strategyInput({
        industry: "Local plumbing contractor",
        businessDescription: "Emergency and remodel plumbing",
        businessTone: "trustworthy approachable",
        primaryCta: "Call now",
      }),
    );
    expect(restaurant.patternComposition!.patternIds.join(",")).not.toBe(
      contractor.patternComposition!.patternIds.join(","),
    );
  });
});

describe("no prompt regressions", () => {
  it("does not put pattern ids into category listing names", () => {
    for (const category of [
      "hero",
      "trust",
      "services",
      "gallery",
      "cta",
    ] as const) {
      for (const p of getDesignPatternsByCategory(category)) {
        expect(p.name).not.toMatch(/\./);
        expect(p.strengths.join(" ")).not.toMatch(
          new RegExp(`${category}\\.`, "i"),
        );
      }
    }
  });
});
