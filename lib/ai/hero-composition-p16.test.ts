/**
 * P1.6 — Hero intent ownership + composition quality regression tests.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { getInteractionState } from "@/lib/ai/interaction-state";
import { touchActiveTask } from "@/lib/ai/active-task-policy";
import {
  diagnoseGreyAreaSource,
  isHeroDomainRequest,
  isHeroGreyAreaComplaint,
} from "@/lib/ai/hero-intent";
import { isGalleryLightboxRequest } from "@/lib/ai/gallery-interaction";
import { isHeroFitRequest } from "@/lib/ai/hero-image-presentation";
import {
  heroPatternPreset,
  mirrorHeroCompositionToLegacyFields,
  verifyHeroPatternApplication,
} from "@/lib/ai/hero-pattern-application";
import {
  buildHeroRenderPlan,
  evaluateHeroComposition,
  refineHeroComposition,
  resolveHeroCompositionFromProject,
  type HeroComposition,
} from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function asset(
  id: string,
  title: string,
  dims?: { width: number; height: number },
): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1800,
    sizeLabel: "2 KB",
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
    unavailable: false,
    ...(dims ?? {}),
  };
}

function cinematicProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  const composition = heroPatternPreset("hero.cinematic_full_width");
  const hero = asset("hero-busy", "Hero", { width: 2400, height: 1200 });
  const base = mirrorHeroCompositionToLegacyFields(
    {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Harborview Landscaping",
      heroHeadline: "Outdoor spaces that feel finished",
      heroSubheadline: "Design, build, and care for yards that look intentional.",
      primaryCta: "Get a quote",
      heroImageId: "hero-busy",
      mediaLibrary: [hero, asset("g1", "Patio"), asset("g2", "Lawn")],
      galleryImageIds: ["g1", "g2"],
      atlasActionMemory: undefined,
      ...overrides,
    },
    composition,
  );
  return touchActiveTask(base, {
    kind: "hero_composition",
    target: { type: "hero" },
    userGoal: "Use a cinematic hero",
    assetId: "hero-busy",
  });
}

/** Production failure shape: contain letterbox + tall frame + grey wash. */
function brokenContainCinematic(): {
  project: BusinessProject;
  composition: HeroComposition;
} {
  const composition: HeroComposition = {
    ...heroPatternPreset("hero.cinematic_full_width"),
    image: {
      fit: "contain",
      position: "center",
      zoom: 1,
      focalPoint: { x: 0.5, y: 0.5 },
    },
    minHeight: "viewport",
    verticalAlignment: "bottom",
    treatment: {
      overlay: 50,
      gradient: { direction: "bottom", strength: 0.55, coverage: 0.75 },
      textScrim: { enabled: true, opacity: 0.4, blur: 8 },
    },
  };
  const project = mirrorHeroCompositionToLegacyFields(
    cinematicProject({
      heroImagePresentation: {
        fit: "full",
        focalPoint: { x: 0.5, y: 0.5 },
        zoom: 1,
        position: "center",
      },
      heroOverlay: 50,
    }),
    composition,
  );
  return { project, composition };
}

describe("P1.6 hero vs gallery ownership", () => {
  it("routes production grey/full-picture phrases to hero, not gallery", () => {
    const phrases = [
      "Get rid of that grey area covering the hero image.",
      "I need to see the entire picture.",
      "Show more of the hero photo.",
      "The overlay is hiding the image.",
      "Remove the grey layer from the hero.",
      "Keep the words readable but show the full photo.",
      "The picture is still being covered.",
    ];
    for (const phrase of phrases) {
      expect(isGalleryLightboxRequest(phrase), phrase).toBe(false);
      expect(
        isHeroDomainRequest(phrase) ||
          isHeroFitRequest(phrase) ||
          isHeroGreyAreaComplaint(phrase),
        phrase,
      ).toBe(true);
    }
  });

  it("still recognizes explicit gallery lightbox requests", () => {
    expect(
      isGalleryLightboxRequest(
        "Let visitors click gallery photos to view them full screen.",
      ),
    ).toBe(true);
    expect(isGalleryLightboxRequest("Open the gallery images larger.")).toBe(
      true,
    );
    expect(isGalleryLightboxRequest("Add a lightbox to the gallery.")).toBe(
      true,
    );
    expect(
      isGalleryLightboxRequest("Show the full gallery photo when clicked."),
    ).toBe(true);
  });

  it("Show the full image with active hero task stays on hero", async () => {
    const project = cinematicProject();
    const result = await runAtlasBrain({
      project,
      request: "Show the full image.",
    });
    expect(result.explanation.toLowerCase()).not.toMatch(/gallery/);
    expect(
      result.operations.some((op) => op.operation === "setGalleryInteraction"),
    ).toBe(false);
    const task = getInteractionState(result.project).activeTask;
    expect(task?.kind?.startsWith("hero_")).toBe(true);
  });

  it("Show the full gallery image when clicked → gallery lightbox", async () => {
    const project = cinematicProject();
    const result = await runAtlasBrain({
      project,
      request: "Show the full gallery photo when clicked.",
    });
    expect(
      result.operations.some((op) => op.operation === "setGalleryInteraction"),
    ).toBe(true);
  });
});

describe("P1.6 production transcript", () => {
  it("keeps the exact failure sequence on hero and never opens gallery", async () => {
    let project = cinematicProject();
    const brand = project.primaryColor;

    const turns = [
      "Use a cinematic hero.",
      "Show the entire picture.",
      "Make the hero text easier to read.",
      "Get rid of that grey area covering the hero image. I need to see the entire picture.",
    ] as const;

    for (const request of turns) {
      const result = await runAtlasBrain({ project, request });
      expect(result.explanation.toLowerCase(), request).not.toMatch(/gallery/);
      expect(
        result.operations.some((op) => op.operation === "setGalleryInteraction"),
        request,
      ).toBe(false);
      project = result.project;
    }

    const task = getInteractionState(project).activeTask;
    expect(task?.kind?.startsWith("hero_")).toBe(true);

    const fit =
      project.heroComposition?.image?.fit ??
      project.heroImagePresentation?.fit;
    expect(fit === "contain" || fit === "full").toBe(false);
    expect(project.heroComposition?.minHeight).toMatch(/viewport|tall/);
    expect(project.primaryColor).toBe(brand);
  });

  it("diagnoses grey area as contain letterbox exposing site bg", () => {
    const { project } = brokenContainCinematic();
    expect(diagnoseGreyAreaSource(project)).toBe(
      "contain_letterbox_exposes_site_bg",
    );
  });

  it("idempotent grey correction after success", async () => {
    let project = brokenContainCinematic().project;
    const first = await runAtlasBrain({
      project,
      request:
        "Get rid of that grey area covering the hero image. I need to see the entire picture.",
    });
    expect(first.explanation.toLowerCase()).not.toMatch(/gallery/);
    project = first.project;
    const second = await runAtlasBrain({
      project,
      request: "It still looks like a grey block.",
    });
    expect(second.explanation.toLowerCase()).not.toMatch(/gallery/);
    expect(second.explanation.toLowerCase()).not.toMatch(
      /which image|clarify|gallery or hero/,
    );
  });
});

describe("P1.6 composition evaluator", () => {
  it("fails the production shallow contain cinematic screenshot shape", () => {
    const { project, composition } = brokenContainCinematic();
    const evaluation = evaluateHeroComposition({ composition, project });
    expect(evaluation.overallScore).toBeLessThan(68);
    expect(evaluation.problems).toEqual(
      expect.arrayContaining([
        "contain_mode_breaks_composition",
        "cinematic_pattern_not_cinematic",
      ]),
    );
    const verify = verifyHeroPatternApplication({
      before: project,
      after: project,
      expected: composition,
    });
    expect(verify.verified).toBe(false);
    expect(verify.failures.length).toBeGreaterThan(0);
  });

  it("cinematic weak image impact fails; premium minimal allows more negative space", () => {
    const cinematic = heroPatternPreset("hero.cinematic_full_width");
    cinematic.minHeight = "short";
    cinematic.image.fit = "contain";
    const project = cinematicProject();
    const cinematicEval = evaluateHeroComposition({
      composition: cinematic,
      project,
    });
    expect(cinematicEval.imageImpact).toBeLessThan(72);

    const minimal = heroPatternPreset("hero.premium_minimal");
    const minimalEval = evaluateHeroComposition({
      composition: minimal,
      project: { ...project, heroComposition: minimal },
    });
    expect(minimalEval.imageImpact).toBeGreaterThanOrEqual(40);
  });

  it("one refine pass improves broken contain cinematic", () => {
    const { project, composition } = brokenContainCinematic();
    const refined = refineHeroComposition({ project, composition });
    expect(refined.diagnostics.finalCompositionScore!).toBeGreaterThan(
      refined.diagnostics.initialCompositionScore!,
    );
    expect(refined.composition.image.fit).toBe("cover");
    expect(refined.composition.minHeight).toBe("viewport");
  });

  it("wide / portrait / square aspect refinements stay attached", () => {
    const project = cinematicProject();
    const base = heroPatternPreset("hero.cinematic_full_width");

    const wide = refineHeroComposition({
      project,
      composition: base,
      aspectRatio: 2.4,
    });
    expect(wide.composition.minHeight).toMatch(/viewport|tall/);
    expect(wide.composition.image.fit).toBe("cover");

    const portrait = refineHeroComposition({
      project,
      composition: base,
      aspectRatio: 0.7,
    });
    expect(portrait.composition.image.fit).toBe("cover");

    const square = refineHeroComposition({
      project,
      composition: base,
      aspectRatio: 1,
    });
    expect(square.composition.cta.alignment).toBe(
      square.composition.contentAlignment,
    );
  });
});

describe("P1.6 parity + professional compromise", () => {
  it("Editor/Preview/Publish share the same render plan after correction", async () => {
    const broken = brokenContainCinematic().project;
    const result = await runAtlasBrain({
      project: broken,
      request: "Show the entire picture.",
    });
    const resolved = resolveHeroCompositionFromProject(result.project);
    const plan = buildHeroRenderPlan(resolved);
    expect(plan.contract.minHeight).toMatch(/viewport|tall/);
    expect(resolved.image.fit).toBe("cover");
  });

  it("professional compromise copy is honest when cinematic is active", async () => {
    const result = await runAtlasBrain({
      project: cinematicProject(),
      request: "Show the entire picture.",
    });
    expect(result.explanation.toLowerCase()).toMatch(
      /showed more|lighter crop|tall|cinematic|banner|every edge/,
    );
    expect(result.explanation.toLowerCase()).not.toMatch(
      /shows the full photo instead of cropping/,
    );
  });
});
