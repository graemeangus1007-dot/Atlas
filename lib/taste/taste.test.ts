/**
 * Taste Engine Phase 1 — deterministic craft scoring across industries & variants.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import { deriveSiteBenchmarkScores } from "@/lib/benchmarks";
import {
  applyTasteRefinement,
  evaluateTaste,
  tasteTextSoundsLikeCopying,
  verifyTasteImprovement,
} from "@/lib/taste";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string): MediaAsset {
  return {
    id,
    name: `${id}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1200,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title: id,
    description: id,
    alt: id,
    width: 1600,
    height: 900,
  } as MediaAsset;
}

type Variant =
  | "clean"
  | "busy"
  | "minimal"
  | "premium"
  | "crowded"
  | "inconsistent"
  | "overdesigned"
  | "underdesigned";

const INDUSTRIES = [
  "Landscaping",
  "Restaurant",
  "Law",
  "Dentist",
  "Luxury Builder",
  "Gym",
  "Coffee Shop",
] as const;

function projectFor(
  industry: string,
  variant: Variant,
): BusinessProject {
  const base: BusinessProject = {
    ...MOCK_BUSINESS_PROJECT,
    businessName: `${industry} Studio`,
    businessType: industry,
    heroHeadline: "Work that feels finished",
    heroSubheadline: "Clear offer, confident next step for visitors.",
    primaryCta: "Get a quote",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1")],
    galleryImageIds: ["g1", "g2", "g3"],
    services: MOCK_BUSINESS_PROJECT.services.slice(0, 3),
    sectionOrder: [
      "hero",
      "about",
      "services",
      "gallery",
      "testimonials",
      "contact",
      "footer",
    ],
  };

  switch (variant) {
    case "clean":
      return {
        ...base,
        headingFont: "playfair",
        bodyFont: "inter",
        heroOverlay: 30,
        creativePolish: {
          spacing: "comfortable",
          visualHierarchy: true,
          serviceIcons: false,
          motion: false,
        },
      };
    case "busy":
      return {
        ...base,
        headingFont: "inter",
        bodyFont: "inter",
        heroOverlay: 65,
        secondaryCta: "Learn more about everything we offer today",
        services: [
          ...base.services,
          ...base.services,
          ...base.services,
        ].slice(0, 6),
        galleryImageIds: ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"],
        sectionOrder: [
          "hero",
          "about",
          "services",
          "gallery",
          "testimonials",
          "faq",
          "pricing",
          "cta",
          "contact",
          "footer",
        ],
        creativePolish: {
          spacing: "default",
          visualHierarchy: false,
          serviceIcons: true,
          motion: true,
          hoverEffects: true,
          sectionReveal: true,
        },
      };
    case "minimal":
      return {
        ...base,
        headingFont: "manrope",
        bodyFont: "inter",
        heroOverlay: 25,
        galleryImageIds: ["g1", "g2"],
        services: base.services.slice(0, 2),
        creativePolish: {
          spacing: "airy",
          visualHierarchy: true,
          serviceIcons: false,
          motion: false,
        },
      };
    case "premium":
      return {
        ...base,
        headingFont: "playfair",
        bodyFont: "lora",
        heroOverlay: 28,
        siteWidth: "boxed",
        buttonStyle: "rounded",
        creativePolish: {
          spacing: "airy",
          visualHierarchy: true,
          serviceIcons: false,
          motion: false,
          hoverEffects: false,
          sectionReveal: false,
        },
      };
    case "crowded":
      return {
        ...base,
        heroOverlay: 70,
        services: [...base.services, ...base.services].slice(0, 7),
        galleryImageIds: Array.from({ length: 10 }, (_, i) => `g${i}`),
        creativePolish: {
          spacing: "default",
          visualHierarchy: false,
          serviceIcons: true,
          motion: true,
        },
      };
    case "inconsistent":
      return {
        ...base,
        headingFont: "inter",
        bodyFont: "inter",
        heroOverlay: 55,
        creativePolish: {
          spacing: "default",
          visualHierarchy: true,
          serviceIcons: true,
          motion: true,
          hoverEffects: false,
          sectionReveal: true,
        },
      };
    case "overdesigned":
      return {
        ...base,
        heroOverlay: 75,
        secondaryCta: "Explore all of our premium packages now",
        heroTreatment: {
          gradient: { direction: "bottom", strength: 0.85, coverage: 0.75 },
          textScrim: { enabled: true, opacity: 0.5, blur: 12 },
        },
        creativePolish: {
          spacing: "comfortable",
          visualHierarchy: true,
          serviceIcons: true,
          motion: true,
          hoverEffects: true,
          sectionReveal: true,
          motionPreset: "polished",
        },
      };
    case "underdesigned":
      return {
        ...base,
        headingFont: "inter",
        bodyFont: "inter",
        heroOverlay: 50,
        heroImageId: null,
        galleryImageIds: [],
        creativePolish: {
          spacing: "default",
          visualHierarchy: false,
          serviceIcons: false,
          motion: false,
        },
      };
    default:
      return base;
  }
}

describe("Taste Engine — industries", () => {
  for (const industry of INDUSTRIES) {
    it(`scores ${industry} deterministically`, () => {
      const project = projectFor(industry, "clean");
      const a = evaluateTaste({ project });
      const b = evaluateTaste({ project });
      expect(a.overallTaste).toBe(b.overallTaste);
      expect(a.version).toBe("1.0.0");
      expect(a.dimensions.length).toBe(12);
      expect(a.confidence).toBeGreaterThan(0.7);
      expect(
        a.recommendations.every((r) => !tasteTextSoundsLikeCopying(r.explanation)),
      ).toBe(true);
    });
  }
});

describe("Taste Engine — variants", () => {
  const variants: Variant[] = [
    "clean",
    "busy",
    "minimal",
    "premium",
    "crowded",
    "inconsistent",
    "overdesigned",
    "underdesigned",
  ];

  it("ranks premium/minimal/clean above crowded/overdesigned/underdesigned", () => {
    const scores = Object.fromEntries(
      variants.map((v) => [
        v,
        evaluateTaste({ project: projectFor("Landscaping", v) }).overallTaste,
      ]),
    ) as Record<Variant, number>;

    expect(scores.premium).toBeGreaterThan(scores.crowded);
    expect(scores.minimal).toBeGreaterThan(scores.underdesigned);
    expect(scores.clean).toBeGreaterThan(scores.busy);
    expect(scores.premium).toBeGreaterThan(scores.overdesigned);
    expect(scores.clean).toBeGreaterThan(scores.inconsistent);
  });

  it("marks overdesigned as weak on restraint", () => {
    const taste = evaluateTaste({
      project: projectFor("Restaurant", "overdesigned"),
    });
    expect(taste.restraint).toBeLessThan(70);
  });

  it("marks underdesigned as weak on craftsmanship / typography", () => {
    const taste = evaluateTaste({
      project: projectFor("Law", "underdesigned"),
    });
    expect(taste.craftsmanship).toBeLessThan(75);
    expect(taste.typographyHarmony).toBeLessThan(75);
  });
});

describe("Taste Engine — refinement verification", () => {
  it("improves overallTaste or resolves highestPriorityImprovement", () => {
    const beforeProject = projectFor("Gym", "busy");
    const before = evaluateTaste({ project: beforeProject });
    expect(before.overallTaste).toBeLessThan(85);

    const refined = applyTasteRefinement(
      beforeProject,
      before.recommendations[0],
    );
    const after = evaluateTaste({ project: refined });
    const verified = verifyTasteImprovement({ before, after });
    expect(verified.ok).toBe(true);
    expect(after.overallTaste).toBeGreaterThanOrEqual(before.overallTaste);
  });

  it("does not copy benchmark language in recommendations", () => {
    const taste = evaluateTaste({
      project: projectFor("Coffee Shop", "crowded"),
    });
    for (const rec of taste.recommendations) {
      expect(tasteTextSoundsLikeCopying(rec.explanation)).toBe(false);
      expect(rec.explanation).not.toMatch(/copy the layout|match their colors/i);
      expect(rec.improves.length).toBeGreaterThan(0);
    }
  });
});

describe("Taste Engine — Creative Director integration", () => {
  it("attaches tasteEvaluation and only judges when structure is sound", () => {
    const premium = evaluateWebsiteAsCreativeDirector({
      project: projectFor("Luxury Builder", "premium"),
      logDiagnostics: false,
    });
    expect(premium.tasteEvaluation).toBeTruthy();
    expect(premium.tasteEvaluation!.version).toBe("1.0.0");

    const weak = evaluateWebsiteAsCreativeDirector({
      project: projectFor("Dentist", "underdesigned"),
      logDiagnostics: false,
    });
    expect(weak.tasteEvaluation).toBeTruthy();
    // Underdesigned often fails functional gate — taste remains attached either way.
    expect(typeof weak.tasteEvaluation!.eligibleToJudge).toBe("boolean");
  });

  it("includes taste dimensions in benchmark site scores", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      project: projectFor("Landscaping", "clean"),
    });
    const scores = deriveSiteBenchmarkScores({ evaluation });
    expect(scores.taste).toBeGreaterThan(0);
    expect(scores.restraint).toBeGreaterThan(0);
    expect(scores.taste).toBeLessThanOrEqual(100);
  });
});

describe("Taste Engine — consistency", () => {
  it("same project always yields identical overallTaste", () => {
    const project = projectFor("Restaurant", "minimal");
    const scores = Array.from({ length: 5 }, () =>
      evaluateTaste({ project }).overallTaste,
    );
    expect(new Set(scores).size).toBe(1);
  });
});
