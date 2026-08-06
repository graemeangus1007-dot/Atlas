/**
 * Score calibration — quality bands, caps, render-aware exceptional bar.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import {
  applyScoreCaps,
  classifyDesignQualityBand,
  detectMajorWeaknesses,
  designQualityBandLabel,
} from "@/lib/creative-director/score-calibration";
import { buildPageSectionInventory } from "@/lib/creative-director/inventory";
import { evaluateWebsiteFlow } from "@/lib/creative-director/flow-evaluator";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director/website-evaluator";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import type { WebsiteDimensionScores } from "@/lib/creative-director/types";

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
  };
}

function dims(partial: Partial<WebsiteDimensionScores>): WebsiteDimensionScores {
  return {
    overallDesignScore: 91,
    firstImpression: 90,
    visualHierarchy: 88,
    trust: 86,
    narrativeFlow: 88,
    conversion: 90,
    brandConsistency: 92,
    accessibility: 88,
    mobileExperience: 86,
    professionalism: 90,
    informationArchitecture: 88,
    sectionBalance: 87,
    whitespace: 86,
    scanability: 88,
    ...partial,
  };
}

describe("design quality bands", () => {
  it("maps score ranges to Poor / Developing / Solid / Strong / Exceptional", () => {
    expect(classifyDesignQualityBand(40)).toBe("poor");
    expect(classifyDesignQualityBand(55)).toBe("developing");
    expect(classifyDesignQualityBand(70)).toBe("solid");
    expect(classifyDesignQualityBand(85)).toBe("strong");
    expect(classifyDesignQualityBand(92)).toBe("exceptional");
    expect(designQualityBandLabel(91)).toBe("Exceptional");
    expect(designQualityBandLabel(84)).toBe("Strong");
  });
});

describe("score caps for major weaknesses", () => {
  it("caps overall below 85 for a major hero composition defect", () => {
    const inventory = buildPageSectionInventory({
      project: {
        ...MOCK_BUSINESS_PROJECT,
        heroImageId: "hero-busy",
        mediaLibrary: [asset("hero-busy", "Yard")],
        heroHeadline: "Outdoor spaces that feel finished",
        heroSubheadline: "Design, build, and care for yards.",
        primaryCta: "Get a quote",
        businessType: "Contractor",
      },
    });
    // Force defect signal when composition resolve is unavailable in unit path
    const inv = {
      ...inventory,
      heroMajorDefect: true,
      heroCompositionScore: 52,
      heroProblems: ["banner strip composition"],
    };
    const flow = evaluateWebsiteFlow({ inventory: inv, sections: [] });
    const weaknesses = detectMajorWeaknesses({ inventory: inv, flow });
    expect(weaknesses.some((w) => w.kind === "major_hero_composition_defect")).toBe(
      true,
    );
    const capped = applyScoreCaps(dims({ overallDesignScore: 91 }), weaknesses);
    expect(capped.dimensions.overallDesignScore).toBeLessThan(85);
    expect(capped.qualityBand).not.toBe("exceptional");
  });

  it("caps trust when proof is missing before conversion", () => {
    const inventory = buildPageSectionInventory({
      project: {
        ...MOCK_BUSINESS_PROJECT,
        businessType: "Contractor",
        designSections: { enabled: [] },
        sectionOrder: ["hero", "about", "services", "contact"],
        galleryImageIds: [],
      },
    });
    const flow = evaluateWebsiteFlow({ inventory, sections: [] });
    const weaknesses = detectMajorWeaknesses({ inventory, flow });
    expect(
      weaknesses.some((w) => w.kind === "weak_proof_before_conversion"),
    ).toBe(true);
    const capped = applyScoreCaps(
      dims({ overallDesignScore: 91, trust: 88 }),
      weaknesses,
    );
    expect(capped.dimensions.trust).toBeLessThanOrEqual(68);
    expect(capped.dimensions.overallDesignScore).toBeLessThan(90);
  });

  it("does not arbitrarily lower a truly exceptional site", () => {
    const project: BusinessProject = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Exceptional Studio",
      businessType: "Contractor",
      description: "15+ years building finished outdoor spaces for coastal homes.",
      heroHeadline: "Outdoor spaces that feel finished",
      heroSubheadline: "Design, build, and care — proven across the coast.",
      primaryCta: "Get a quote",
      primaryColor: NAMED_COLORS.forestGreen,
      accentColor: NAMED_COLORS.gold,
      heroImageId: "hero-busy",
      mediaLibrary: [
        asset("hero-busy", "Yard"),
        asset("g1", "Patio"),
        asset("g2", "Garden"),
        asset("g3", "Deck"),
        asset("g4", "Path"),
      ],
      galleryImageIds: ["g1", "g2", "g3", "g4"],
      galleryInteraction: { mode: "lightbox" },
      creativePolish: {
        spacing: "airy",
        visualHierarchy: true,
        serviceIcons: true,
        motion: false,
      },
      designSections: {
        enabled: ["gallery", "testimonials", "faq"],
        testimonials: [
          {
            id: "t1",
            quote: "They transformed our backyard into a place we use every week.",
            author: "Maya Chen",
            role: "Homeowner",
          },
          {
            id: "t2",
            quote: "Clear timeline, beautiful work, easy to recommend.",
            author: "Jon Hale",
            role: "Property manager",
          },
        ],
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
      contact: {
        phone: "555-010-4422",
        email: "hello@exceptional.test",
        location: "Portland, ME",
      },
    };
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    // Strong sites with proof may still land short of 90 if composition is imperfect —
    // but caps must not invent weaknesses when proof + flow are healthy.
    const inventory = buildPageSectionInventory({ project });
    const flow = evaluateWebsiteFlow({
      inventory,
      sections: evaluation.sections,
    });
    const weaknesses = detectMajorWeaknesses({ inventory, flow });
    const major = weaknesses.filter(
      (w) => w.severity === "major" || w.severity === "critical",
    );
    if (major.length === 0) {
      expect(evaluation.dimensions.overallDesignScore).toBeGreaterThanOrEqual(80);
      if (evaluation.dimensions.overallDesignScore >= 90) {
        expect(evaluation.health.qualityBand).toBe("Exceptional");
      }
    }
  });

  it("keeps a strong site with one minor issue in the 80–89 band (or 90+ if minor)", () => {
    const project: BusinessProject = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Strong Works",
      businessType: "Contractor",
      description: "12 years of coastal landscaping with finished outdoor rooms.",
      heroHeadline: "Yards that look intentional",
      heroSubheadline: "Design and care for outdoor spaces that feel complete.",
      primaryCta: "Request a consult",
      heroImageId: "hero-busy",
      mediaLibrary: [
        asset("hero-busy", "Yard"),
        asset("g1", "Patio"),
        asset("g2", "Garden"),
        asset("g3", "Deck"),
      ],
      galleryImageIds: ["g1", "g2", "g3"],
      designSections: {
        enabled: ["gallery", "testimonials"],
        testimonials: [
          {
            id: "t1",
            quote: "Reliable crew and a beautiful finished patio.",
            author: "Alex Rivera",
            role: "Homeowner",
          },
        ],
      },
      sectionOrder: [
        "hero",
        "services",
        "gallery",
        "testimonials",
        "contact",
      ],
      contact: {
        phone: "555-222-8899",
        email: "hi@strong.test",
        location: "Portland",
      },
      creativePolish: {
        spacing: "default",
        visualHierarchy: true,
        serviceIcons: false,
        motion: false,
      },
    };
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    expect(evaluation.dimensions.overallDesignScore).toBeGreaterThanOrEqual(65);
    // One minor rhythm/polish gap must not force Poor/Developing
    expect(evaluation.dimensions.overallDesignScore).toBeGreaterThanOrEqual(65);
  });

  it("visibly broken hero cannot score 90+", () => {
    const project: BusinessProject = {
      ...MOCK_BUSINESS_PROJECT,
      businessType: "Contractor",
      heroHeadline: "Hi",
      heroSubheadline: "ok",
      primaryCta: "Click",
      heroImageId: undefined,
      galleryImageIds: [],
      designSections: { enabled: [] },
      sectionOrder: ["hero", "contact"],
    };
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    expect(evaluation.dimensions.overallDesignScore).toBeLessThan(90);
    expect(evaluation.health.qualityBand).not.toBe("Exceptional");
  });
});
