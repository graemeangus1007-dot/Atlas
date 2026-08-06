/**
 * Visual Composition Engine Phase 1 — deterministic composition analysis.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  analyzeProjectVisualComposition,
  applyVisualCompositionToHero,
  buildVisualComposition,
  compositionTextSoundsLikeOverlayDefault,
  evaluateVisualComposition,
  explainCompositionDecision,
  refineHeroWithVisualComposition,
  scorePhotographyPreservation,
} from "@/lib/composition";
import {
  refineHeroComposition,
  resolveHeroCompositionFromProject,
} from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(
  id: string,
  title: string,
  size?: { width: number; height: number },
): MediaAsset {
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
    description: title,
    alt: title,
    ...(size ? { width: size.width, height: size.height } : {}),
  } as MediaAsset;
}

function projectFor(
  industry: string,
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: `${industry} Studio`,
    businessType: industry,
    heroHeadline: "Work that feels finished",
    heroSubheadline: "Clear offer, confident next step.",
    primaryCta: "Get a quote",
    heroImageId: "hero-1",
    heroOverlay: 50,
    mediaLibrary: [asset("hero-1", "Hero", { width: 1600, height: 900 })],
    ...overrides,
  };
}

const INDUSTRIES = [
  "Landscaping",
  "Coffee Shop",
  "Restaurant",
  "Luxury Home Builder",
  "Law Firm",
  "Dental",
  "Gym",
] as const;

describe("Visual Composition Engine — industries", () => {
  for (const industry of INDUSTRIES) {
    it(`analyzes ${industry} without requiring ML`, () => {
      const project = projectFor(industry);
      const visual = analyzeProjectVisualComposition({ project });
      expect(visual.version).toBe("1.0.0");
      expect(visual.negativeSpaceZones.length).toBeGreaterThan(3);
      expect(visual.recommendedContentZone.zone).toBeTruthy();
      expect(visual.recommendedCTAZone.zone).toBeTruthy();
      expect(visual.treatmentLadder[0]).toBe("analyze");
      expect(visual.treatmentLadder).not.toContain("blur");
      expect(visual.overlayStrength).toBeLessThanOrEqual(50);
      expect(explainCompositionDecision(visual)).not.toMatch(
        /increased the overlay/i,
      );
    });
  }
});

describe("Visual Composition Engine — image scenarios", () => {
  it("handles busy image with restrained overlay", () => {
    const project = projectFor("Landscaping", {
      heroOverlay: 75,
      heroImagePresentation: {
        fit: "cover",
        focalPoint: { x: 0.55, y: 0.42 },
        zoom: 1.1,
        position: "center",
      },
    });
    const visual = analyzeProjectVisualComposition({ project });
    expect(visual.overlayStrength).toBeLessThanOrEqual(25);
    expect(visual.preservePhotography).toBe(true);
    expect(visual.recommendedScrim?.enabled || visual.recommendedGradient).toBeTruthy();
  });

  it("handles minimal image with light treatment", () => {
    const project = projectFor("Law Firm", { heroOverlay: 0 });
    const composition = resolveHeroCompositionFromProject(project);
    composition.legacyLayoutKey = "minimal";
    composition.patternId = "hero.premium_minimal";
    const visual = analyzeProjectVisualComposition({ project, composition });
    expect(visual.overlayStrength).toBeLessThanOrEqual(25);
    expect(visual.treatmentLadder).toContain("use_whitespace");
  });

  it("handles portrait image height/focal advice", () => {
    const project = projectFor("Dental", {
      mediaLibrary: [asset("hero-1", "Portrait", { width: 900, height: 1400 })],
    });
    const visual = analyzeProjectVisualComposition({
      project,
      aspectRatio: 900 / 1400,
    });
    expect(["tall", "viewport", "medium"]).toContain(visual.recommendedHeight);
    expect(visual.focalPoint.y).toBeGreaterThan(0);
  });

  it("handles wide landscape / panoramic", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 2.4,
      focalPoint: { x: 0.5, y: 0.4 },
      imageFit: "cover",
      currentOverlay: 50,
      industry: "Restaurant",
    });
    expect(visual.recommendedHeight).toMatch(/tall|viewport/);
    expect(
      visual.negativeSpaceZones.some((z) => z.id === "lower_third"),
    ).toBe(true);
  });

  it("respects existing overlay by preferring to reduce, not raise", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.6,
      currentOverlay: 100,
      focalPoint: { x: 0.5, y: 0.5 },
      industry: "Gym",
    });
    expect(visual.overlayStrength).toBeLessThan(100);
    expect(visual.overlayStrength).toBeLessThanOrEqual(50);
  });

  it("works with no overlay", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.5,
      currentOverlay: 0,
      industry: "Coffee Shop",
    });
    expect(visual.overlayStrength).toBeLessThanOrEqual(25);
  });

  it("selects negative space away from focal subject", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.5,
      focalPoint: { x: 0.82, y: 0.45 },
      currentOverlay: 40,
      industry: "Landscaping",
    });
    expect(["left", "split_left", "lower_third", "upper_third", "center"]).toContain(
      visual.recommendedContentZone.zone,
    );
    // Should not prefer the subject-heavy right when left is quieter
    const left = visual.negativeSpaceZones.find((z) => z.id === "left");
    const right = visual.negativeSpaceZones.find((z) => z.id === "right");
    expect((left?.quietness ?? 0)).toBeGreaterThanOrEqual(right?.quietness ?? 0);
  });

  it("recommends CTA placement styles", () => {
    const single = buildVisualComposition({
      hasHeroImage: true,
      hasSecondaryCta: false,
      ctaLength: 12,
      headlineLength: 30,
      aspectRatio: 1.5,
    });
    expect(["single", "inline", "floating"]).toContain(
      single.recommendedCtaPlacement,
    );

    const stacked = buildVisualComposition({
      hasHeroImage: true,
      hasSecondaryCta: true,
      ctaLength: 32,
      headlineLength: 80,
      aspectRatio: 1.5,
      patternId: "hero.premium_minimal",
    });
    expect(stacked.recommendedCtaPlacement).toBe("stacked");
  });

  it("avoids blur in the default treatment ladder", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.7,
      currentOverlay: 75,
      industry: "Restaurant",
    });
    expect(visual.treatmentLadder).not.toContain("blur");
    expect(visual.recommendedScrim?.blur ?? null).toBeNull();
  });
});

describe("Photography preservation + refinement", () => {
  it("penalizes large blur and heavy overlay", () => {
    const visual = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.5,
      currentOverlay: 25,
    });
    const heavy = scorePhotographyPreservation({
      visual,
      composition: {
        ...resolveHeroCompositionFromProject(projectFor("Gym")),
        treatment: {
          overlay: 90,
          gradient: null,
          textScrim: { enabled: true, opacity: 0.5, blur: 12 },
        },
      },
    });
    const light = scorePhotographyPreservation({
      visual: { ...visual, overlayStrength: 15, preservePhotography: true },
      composition: {
        ...resolveHeroCompositionFromProject(projectFor("Gym")),
        treatment: {
          overlay: 15,
          gradient: {
            direction: "bottom",
            strength: 0.3,
            coverage: 0.5,
          },
          textScrim: { enabled: true, opacity: 0.2 },
        },
      },
    });
    expect(heavy.overall).toBeLessThan(light.overall);
    expect(heavy.blurIntrusion).toBeLessThan(70);
  });

  it("applies composition to HeroComposition without replacing it", () => {
    const project = projectFor("Luxury Home Builder", { heroOverlay: 75 });
    const base = resolveHeroCompositionFromProject(project);
    const result = refineHeroWithVisualComposition({ project, composition: base });
    expect(result.composition.patternId).toBe(base.patternId);
    expect(result.composition.version).toBe(base.version);
    expect(result.diagnostics.overlayAfter).toBeLessThanOrEqual(
      result.diagnostics.overlayBefore,
    );
    expect(result.diagnostics.blurSelected).toBe(false);
    expect(result.visual.decisionReason.length).toBeGreaterThan(20);
  });

  it("hero refine consumes VisualComposition (overlay not the default story)", () => {
    const project = projectFor("Landscaping", {
      heroOverlay: 75,
      heroComposition: {
        ...resolveHeroCompositionFromProject(
          projectFor("Landscaping", { heroOverlay: 75 }),
        ),
        patternId: "hero.coastal_service",
      },
    });
    const refined = refineHeroComposition({
      project,
      composition: project.heroComposition!,
    });
    expect(refined.composition.treatment.overlay).toBeLessThanOrEqual(25);
    const visual = analyzeProjectVisualComposition({
      project,
      composition: refined.composition,
    });
    expect(compositionTextSoundsLikeOverlayDefault(visual.decisionReason)).toBe(
      false,
    );
  });

  it("evaluates composition strengths and improvements", () => {
    const project = projectFor("Restaurant");
    const visual = analyzeProjectVisualComposition({ project });
    const evaluation = evaluateVisualComposition({ visual });
    expect(evaluation.overall).toBeGreaterThan(0);
    expect(evaluation.photographyPreservation.overall).toBeGreaterThan(0);
    expect(Array.isArray(evaluation.strengths)).toBe(true);
    expect(Array.isArray(evaluation.recommendedImprovements)).toBe(true);
  });

  it("future pixel hints improve confidence without replacing pipeline", () => {
    const base = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.5,
      focalPoint: { x: 0.5, y: 0.5 },
    });
    const enriched = buildVisualComposition({
      hasHeroImage: true,
      aspectRatio: 1.5,
      focalPoint: { x: 0.5, y: 0.5 },
      pixelAnalysis: {
        source: "future_pixel_analysis",
        quietRegions: [{ zone: "left", quietness: 92 }],
        subjectBoundingBox: { x: 0.55, y: 0.2, width: 0.4, height: 0.6 },
        brightnessMap: "mixed",
      },
    });
    expect(enriched.confidence).toBeGreaterThan(base.confidence);
    expect(enriched.negativeSpaceZones[0]?.id).toBeTruthy();
  });

  it("applyVisualCompositionToHero patches placement fields", () => {
    const project = projectFor("Coffee Shop");
    const composition = resolveHeroCompositionFromProject(project);
    const visual = analyzeProjectVisualComposition({ project, composition });
    const next = applyVisualCompositionToHero({ composition, visual });
    expect(next.contentAlignment).toBe(visual.recommendedAlignment);
    expect(next.minHeight).toBe(visual.recommendedHeight);
    expect(next.treatment.overlay).toBeLessThanOrEqual(visual.overlayStrength + 25);
  });
});
