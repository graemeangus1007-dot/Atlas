/**
 * P1.5 — Hero composition evaluator + one-pass refinement.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  HERO_COMPOSITION_PASS_THRESHOLD,
  classifyImageAspect,
  compositionScorePasses,
  evaluateHeroComposition,
} from "@/lib/hero-composition/evaluator";
import { refineHeroComposition } from "@/lib/hero-composition/refine";
import {
  heroPatternPreset,
  prepareHeroPatternComposition,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(
  id: string,
  width: number,
  height: number,
): MediaAsset {
  return {
    id,
    name: `${id}.jpg`,
    filename: `${id}.jpg`,
    url: `https://example.com/${id}.jpg`,
    storagePath: null,
    mimeType: "image/jpeg",
    size: 2048,
    sizeLabel: "2 KB",
    width,
    height,
    createdAt: Date.now(),
    title: id,
    description: "",
    alt: id,
  };
}

function project(overrides: Partial<BusinessProject> = {}): BusinessProject {
  const hero = asset("hero-1", 1600, 900);
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessType: "Contractor",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Coastal yards with clear craft.",
    primaryCta: "Request a quote",
    secondaryCta: "View our work",
    heroImageId: "hero-1",
    mediaLibrary: [hero],
    heroComposition: null,
    ...overrides,
  };
}

describe("classifyImageAspect", () => {
  it("classifies panoramic / portrait / square", () => {
    expect(classifyImageAspect(2.4)).toBe("panoramic");
    expect(classifyImageAspect(1.6)).toBe("landscape");
    expect(classifyImageAspect(1.0)).toBe("square");
    expect(classifyImageAspect(0.7)).toBe("portrait");
  });
});

describe("evaluateHeroComposition", () => {
  it("rejects shallow contain banner strips", () => {
    const composition = heroPatternPreset("hero.cinematic_full_width");
    composition.minHeight = "short";
    composition.image.fit = "contain";
    composition.verticalAlignment = "center";
    composition.treatment = { overlay: 0, gradient: null, textScrim: null };
    const evaluation = evaluateHeroComposition({
      composition,
      project: project(),
      aspectRatio: 2.5,
    });
    expect(evaluation.problems).toEqual(
      expect.arrayContaining(["hero_too_shallow", "banner_strip_contain"]),
    );
    expect(compositionScorePasses(evaluation.overallScore)).toBe(false);
  });

  it("scores cinematic tall + lower text highly", () => {
    const evaluation = evaluateHeroComposition({
      composition: heroPatternPreset("hero.cinematic_full_width"),
      project: project(),
      aspectRatio: 2.3,
    });
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(
      HERO_COMPOSITION_PASS_THRESHOLD,
    );
    expect(evaluation.heroHeightDecision).toMatch(/panoramic|height/);
  });

  it("flags contractor when centered", () => {
    const composition = heroPatternPreset("hero.contractor_left");
    composition.contentAlignment = "center";
    composition.cta.alignment = "center";
    const evaluation = evaluateHeroComposition({
      composition,
      project: project(),
    });
    expect(evaluation.problems).toContain("contractor_not_left");
  });

  it("flags heavy coastal overlays", () => {
    const composition = heroPatternPreset("hero.coastal_service");
    composition.treatment.overlay = 75;
    const evaluation = evaluateHeroComposition({
      composition,
      project: project(),
    });
    expect(evaluation.problems).toEqual(
      expect.arrayContaining(["heavy_coastal", "overlay_abuse"]),
    );
  });
});

describe("refineHeroComposition — aspect cases", () => {
  it("raises panoramic shallow cinematic into a taller frame", () => {
    const before = heroPatternPreset("hero.cinematic_full_width");
    before.minHeight = "short";
    before.image.fit = "contain";
    before.verticalAlignment = "center";
    before.treatment = { overlay: 75, gradient: null, textScrim: null };

    const proj = project({
      mediaLibrary: [asset("hero-1", 2400, 900)],
    });
    const scoreBefore = evaluateHeroComposition({
      composition: before,
      project: proj,
      aspectRatio: 2400 / 900,
    }).overallScore;

    const refined = refineHeroComposition({
      project: proj,
      composition: before,
      aspectRatio: 2400 / 900,
    });

    expect(refined.refined).toBe(true);
    expect(refined.composition.minHeight).toMatch(/tall|viewport/);
    expect(refined.composition.image.fit).toBe("cover");
    expect(refined.composition.verticalAlignment).toBe("bottom");
    expect(refined.composition.treatment.overlay).toBeLessThanOrEqual(25);
    expect(refined.evaluation.overallScore).toBeGreaterThan(scoreBefore);
    expect(refined.diagnostics.refinementApplied).toBe(true);
    expect(compositionScorePasses(refined.evaluation.overallScore)).toBe(true);
  });

  it("crops portrait images with cover + focal rebalance", () => {
    const refined = refineHeroComposition({
      project: project({
        mediaLibrary: [asset("hero-1", 900, 1400)],
      }),
      composition: heroPatternPreset("hero.coastal_service"),
      aspectRatio: 900 / 1400,
    });
    expect(refined.composition.image.fit).toBe("cover");
    expect(refined.diagnostics.aspectClass).toBe("portrait");
    expect(refined.composition.patternId).toBe("hero.coastal_service");
  });

  it("rebalances square images without becoming a banner", () => {
    const weak = heroPatternPreset("hero.contractor_left");
    weak.minHeight = "short";
    weak.image.fit = "contain";
    const refined = refineHeroComposition({
      project: project({
        mediaLibrary: [asset("hero-1", 1000, 1000)],
      }),
      composition: weak,
      aspectRatio: 1,
    });
    expect(refined.composition.image.fit).toBe("cover");
    expect(refined.composition.minHeight).not.toBe("short");
    expect(refined.composition.contentAlignment).toBe("left");
  });
});

describe("refineHeroComposition — copy / CTA cases", () => {
  it("handles very long headlines by scaling type", () => {
    const refined = refineHeroComposition({
      project: project({
        heroHeadline:
          "Award-winning coastal outdoor living and hardscape design for families who want a finished yard",
      }),
      composition: heroPatternPreset("hero.cinematic_full_width"),
    });
    expect(refined.composition.typography.headingScale).not.toBe("xl");
    expect(refined.composition.patternId).toBe("hero.cinematic_full_width");
  });

  it("keeps short headlines cinematic and bold", () => {
    const refined = refineHeroComposition({
      project: project({ heroHeadline: "Finished yards" }),
      composition: heroPatternPreset("hero.cinematic_full_width"),
    });
    expect(refined.composition.typography.headingScale).toBe("xl");
  });

  it("hides secondary CTA emphasis path when absent", () => {
    const refined = refineHeroComposition({
      project: project({ secondaryCta: "" }),
      composition: heroPatternPreset("hero.contractor_left"),
    });
    expect(refined.composition.typography.showSecondaryCta).toBe(false);
  });

  it("stacks oversized CTA labels", () => {
    const refined = refineHeroComposition({
      project: project({
        primaryCta: "Request your complimentary coastal design consultation",
      }),
      composition: heroPatternPreset("hero.coastal_service"),
    });
    expect(refined.composition.cta.arrangement).toBe("stack");
  });
});

describe("pattern-specific refinement", () => {
  it("keeps premium minimal restrained", () => {
    const bloated = heroPatternPreset("hero.premium_minimal");
    bloated.minHeight = "viewport";
    bloated.typography.headingScale = "xl";
    bloated.accents = { showAccentWash: true, showGrid: true };
    const refined = refineHeroComposition({
      project: project({ heroImageId: null, mediaLibrary: [] }),
      composition: bloated,
    });
    expect(refined.composition.minHeight).toBe("short");
    expect(refined.composition.typography.headingScale).toBe("sm");
    expect(refined.composition.accents.showAccentWash).toBe(false);
    expect(refined.evaluation.overallScore).toBeGreaterThanOrEqual(
      HERO_COMPOSITION_PASS_THRESHOLD - 5,
    );
  });

  it("preserves pattern id across refinement", () => {
    for (const patternId of [
      "hero.cinematic_full_width",
      "hero.coastal_service",
      "hero.contractor_left",
      "hero.premium_minimal",
    ] as ExecutableHeroPatternId[]) {
      const prepared = prepareHeroPatternComposition({
        project: project(),
        composition: heroPatternPreset(patternId),
      });
      expect(prepared.composition.patternId).toBe(patternId);
      expect(
        compositionScorePasses(
          evaluateHeroComposition({
            composition: prepared.composition,
            project: project(),
          }).overallScore,
        ),
      ).toBe(true);
    }
  });

  it("improves mobile contractor stack", () => {
    const weak = heroPatternPreset("hero.contractor_left");
    weak.mobile = { layout: "keep_overlay", minHeight: "short" };
    const refined = refineHeroComposition({
      project: project(),
      composition: weak,
    });
    expect(refined.composition.mobile.layout).toBe("stack_copy_first");
    const mobileEval = evaluateHeroComposition({
      composition: refined.composition,
      project: project(),
      viewport: "mobile",
    });
    expect(mobileEval.mobileScore).toBeGreaterThanOrEqual(60);
  });
});
