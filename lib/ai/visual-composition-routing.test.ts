/**
 * Production regression: hero blur Q&A must never open Homepage Review /
 * Apply All / whole-site transformation.
 *
 * Transcript:
 *   Upload Cafepatio → Use this as the hero image
 *   → Why is half of the image blurred?
 *   → Fix it. Keep the photo clear and move the text somewhere easier to read.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { getActionMemory } from "@/lib/ai/atlas-action-memory";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import { touchActiveTask } from "@/lib/ai/active-task-policy";
import { getActiveVisualTask } from "@/lib/ai/active-visual-task";
import { getInteractionState } from "@/lib/ai/interaction-state";
import {
  classifyVisualCompositionIntent,
  isVisualCompositionExplanationRequest,
  isVisualCompositionRefinementRequest,
} from "@/lib/composition/intent";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import { scorePhotographyPreservation } from "@/lib/composition/evaluator";
import { analyzeProjectVisualComposition } from "@/lib/composition/layout-selector";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function patioAsset(id = "cafepatio"): MediaAsset {
  return {
    id,
    name: "Cafepatio.jpg",
    filename: "Cafepatio.jpg",
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 240_000,
    sizeLabel: "240 KB",
    createdAt: Date.now(),
    title: "Cafepatio",
    description: "Cafe patio",
    alt: "Cafe patio",
    width: 1600,
    height: 1067,
  } as MediaAsset;
}

function cafePatioProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  const asset = patioAsset();
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harbor Cafe",
    businessType: "Coffee Shop",
    heroHeadline: "Coffee on the patio",
    heroSubheadline: "Slow mornings, open air.",
    primaryCta: "Reserve a table",
    primaryColor: "#2f4a3c",
    accentColor: "#c4a35a",
    secondaryColor: "#2f4a3c",
    backgroundColor: "#f7f4ef",
    headingFont: "inter",
    bodyFont: "inter",
    heroImageId: asset.id,
    heroOverlay: 55,
    heroTreatment: {
      gradient: { direction: "bottom", strength: 0.72, coverage: 0.68 },
      textScrim: { enabled: true, opacity: 0.42, blur: 12 },
    },
    mediaLibrary: [asset],
    galleryImageIds: [],
    creativePolish: {
      spacing: "balanced",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function photoScore(project: BusinessProject): number {
  const composition = resolveHeroCompositionFromProject(project);
  const visual = analyzeProjectVisualComposition({ project, composition });
  return scorePhotographyPreservation({ visual, composition }).overall;
}

function blurOf(project: BusinessProject): number {
  return resolveHeroCompositionFromProject(project).treatment.textScrim?.blur ?? 0;
}

describe("visual composition intent", () => {
  it("classifies blur why-questions as explanation", () => {
    const request = "Why is half of the image blurred?";
    expect(isVisualCompositionExplanationRequest(request)).toBe(true);
    expect(isVisualCompositionRefinementRequest(request)).toBe(false);
    expect(classifyVisualCompositionIntent(request)?.kind).toBe(
      "visual_composition_explanation",
    );
  });

  it("classifies clear-photo fixes as refinement", () => {
    const request =
      "Fix it. Keep the photo clear and move the text somewhere easier to read.";
    expect(isVisualCompositionRefinementRequest(request)).toBe(true);
    expect(classifyVisualCompositionIntent(request)?.kind).toBe(
      "visual_composition_refinement",
    );
  });

  it("routes why-blur away from critique / question stubs", () => {
    const decided = decideWithAtlasBrainEngine({
      project: cafePatioProject(),
      request: "Why is half of the image blurred?",
    });
    expect(decided.stage).toBe("visual_composition");
    expect(decided.commandKind).toBe("visual_composition");
    expect(decided.decision.explanation).not.toMatch(
      /current design choices and what I’d improve/i,
    );
    expect(decided.decision.explanation).toMatch(/blur|overlay|scrim|photo/i);
    expect(decided.decision.shouldExecuteEdits).toBe(false);
  });
});

describe("production transcript — Cafepatio blur routing", () => {
  it("explains then refines hero-locally without Homepage Review", async () => {
    const asset = patioAsset();
    let project = cafePatioProject({
      heroImageId: null,
      mediaLibrary: [asset],
      heroTreatment: undefined,
      heroOverlay: 50,
    });

    const placed = await runAtlasBrain({
      project,
      request: "Use this as the hero image.",
      attachmentContexts: [
        {
          attachmentId: "att-patio",
          assetId: asset.id,
          type: "image",
          filename: "Cafepatio.jpg",
          position: 0,
        },
      ],
    });
    expect(placed.applyStatus).toBe("applied");
    expect(placed.project.heroImageId).toBe(asset.id);
    const placedTask = getInteractionState(placed.project).activeTask;
    expect(placedTask?.target).toEqual({ type: "hero" });
    expect(
      placedTask?.kind === "hero_composition" ||
        placedTask?.kind === "image_placement" ||
        placedTask?.kind === "hero_image_fit",
    ).toBe(true);

    // Simulate the post-placement blur treatment users complain about.
    project = {
      ...placed.project,
      heroOverlay: 55,
      heroTreatment: {
        gradient: { direction: "bottom", strength: 0.72, coverage: 0.68 },
        textScrim: { enabled: true, opacity: 0.42, blur: 12 },
      },
    };

    const brandBefore = {
      primary: project.primaryColor,
      accent: project.accentColor,
      heading: project.headingFont,
      body: project.bodyFont,
      motion: project.creativePolish?.motion,
      sectionOrder: project.sectionOrder,
    };
    const blurBefore = blurOf(project);
    const photoBefore = photoScore(project);
    expect(blurBefore).toBeGreaterThanOrEqual(6);

    const why = await runAtlasBrain({
      project,
      request: "Why is half of the image blurred?",
    });
    expect(why.applyStatus).toBe("no_changes");
    expect(why.decision?.decisionStage).toBe("visual_composition");
    expect(why.decision?.commandKind).toBe("visual_composition");
    expect(why.explanation).toMatch(/blur/i);
    expect(why.explanation).toMatch(/readability|easier to read|quieter/i);
    expect(why.explanation).not.toMatch(
      /I’ll explain the current design choices/i,
    );
    expect(why.explanation).not.toMatch(/Apply All|Homepage Review/i);
    expect(why.operations).toHaveLength(0);
    expect(getActiveVisualTask(getActionMemory(why.project))?.kind).toBe(
      "hero_composition",
    );
    expect(getActiveVisualTask(getActionMemory(why.project))?.assetId).toBe(
      asset.id,
    );
    project = why.project;

    const fix = await runAtlasBrain({
      project,
      request:
        "Fix it. Keep the photo clear and move the text somewhere easier to read.",
    });
    expect(fix.applyStatus).toBe("applied");
    expect(fix.decision?.decisionStage).toBe("visual_composition");
    expect(fix.decision?.commandKind).toBe("visual_composition");
    expect(fix.explanation).toMatch(/removed the broad blur|moved the hero copy/i);
    expect(fix.explanation).not.toMatch(/Apply All|Homepage Review/i);
    expect(fix.project.heroImageId).toBe(asset.id);
    expect(blurOf(fix.project)).toBeLessThan(blurBefore);
    expect(photoScore(fix.project) + 1).toBeGreaterThanOrEqual(photoBefore);

    expect(fix.project.primaryColor).toBe(brandBefore.primary);
    expect(fix.project.accentColor).toBe(brandBefore.accent);
    expect(fix.project.headingFont).toBe(brandBefore.heading);
    expect(fix.project.bodyFont).toBe(brandBefore.body);
    expect(fix.project.creativePolish?.motion).toBe(brandBefore.motion);
    expect(fix.project.sectionOrder).toEqual(brandBefore.sectionOrder);
  });

  it("Why is the image dark? explains only; Fix it. then refines once", async () => {
    let project = cafePatioProject({
      heroOverlay: 70,
      heroTreatment: {
        gradient: { direction: "bottom", strength: 0.8, coverage: 0.7 },
        textScrim: { enabled: true, opacity: 0.4, blur: 10 },
      },
    });
    project = touchActiveTask(project, {
      kind: "hero_composition",
      target: { type: "hero" },
      assetId: project.heroImageId,
      userGoal: "Use this as the hero image.",
    });

    const why = await runAtlasBrain({
      project,
      request: "Why is the image dark?",
    });
    expect(why.applyStatus).toBe("no_changes");
    expect(why.decision?.commandKind).toBe("visual_composition");
    expect(why.operations).toHaveLength(0);
    expect(why.explanation).toMatch(/overlay|dark|wash|scrim|blur|photo/i);

    const beforeIds = why.project.heroImageId;
    const fix = await runAtlasBrain({
      project: why.project,
      request: "Fix it.",
    });
    expect(fix.applyStatus).toBe("applied");
    expect(fix.decision?.commandKind).toBe("visual_composition");
    expect(fix.project.heroImageId).toBe(beforeIds);
    expect(blurOf(fix.project)).toBeLessThan(blurOf(why.project));
  });
});
