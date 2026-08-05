/**
 * v1.3 — Continuous hero editing + image fit controls.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  getActionMemory,
  getLastExecution,
  matchClarificationAnswer,
  shouldExecuteActionMemory,
  storePendingClarification,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import {
  isHeroFitRequest,
  readHeroImagePresentation,
} from "@/lib/ai/hero-image-presentation";
import { getActiveVisualTask } from "@/lib/ai/active-visual-task";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function greenGoldProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "Contractor",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Get a quote",
    primaryColor: NAMED_COLORS.forestGreen,
    accentColor: NAMED_COLORS.gold,
    secondaryColor: NAMED_COLORS.forestGreen,
    backgroundColor: "#f7f8fa",
    theme: "light",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    siteWidth: "boxed",
    heroOverlay: 75,
    heroImageId: "hero-busy",
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function planMemory() {
  return storeRecommendations(undefined, {
    creative: [
      {
        id: "visual.icons",
        kind: "visual",
        title: "Add icons",
        explanation: "Icons",
        impact: "high",
        impactScore: 90,
        confidence: 0.9,
        operations: [{ operation: "setCreativePolish", serviceIcons: true }],
        capabilityIds: [],
        applyable: true,
        estimatedTime: "<10 seconds",
      },
    ],
  });
}

describe("continuous hero editing sequence", () => {
  it("keeps the full production follow-up chain in hero context", async () => {
    let project = greenGoldProject({
      heroOverlay: 50,
      atlasActionMemory: planMemory(),
    });

    const turns = [
      "Make the image clearer while keeping the words readable.",
      "Make the image a little bit easier to see.",
      "The image is hard to see.",
      "Still bad. Make it professional.",
      "Use the full picture.",
    ] as const;

    const results = [];
    for (const request of turns) {
      const result = await runAtlasBrain({ project, request });
      results.push(result);
      project = result.project;
      expect(result.explanation).not.toMatch(
        /don’t have applyable improvements queued/i,
      );
      expect(result.explanation).not.toMatch(
        /What should lead the next pass/i,
      );
      expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
      expect(result.project.primaryColor).toBe(NAMED_COLORS.forestGreen);
      expect(result.project.headingFont).toBe("inter");
    }

    expect(
      results.some((r) => r.decision?.commandKind === "hero_balance"),
    ).toBe(true);
    expect(project.heroImagePresentation?.fit).toMatch(/full|contain/);
    expect(getActiveVisualTask(getActionMemory(project))?.target).toBe("hero");

    // Pending target clarification resolves with “Hero image”.
    const clarified = storePendingClarification(getActionMemory(project), {
      question:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const resolve = await runAtlasBrain({
      project: { ...project, atlasActionMemory: clarified },
      request: "Hero image",
    });
    expect(resolve.explanation).toMatch(/full-image fit|full photo|hero/i);
    expect(resolve.explanation).not.toMatch(
      /don’t have applyable improvements queued/i,
    );
    expect(resolve.project.heroImagePresentation?.fit).toMatch(/full|contain/);
    expect(resolve.project.accentColor).toBe(NAMED_COLORS.gold);
  });

  it("never lets an active critique plan hijack hero fit", async () => {
    const project = greenGoldProject({
      atlasActionMemory: planMemory(),
    });
    expect(shouldExecuteActionMemory("Use the full picture.", planMemory())).toBe(
      false,
    );
    expect(shouldExecuteActionMemory("Hero image", planMemory())).toBe(false);
    expect(
      shouldExecuteActionMemory("Still bad. Make it professional.", planMemory()),
    ).toBe(false);

    const result = await runAtlasBrain({
      project,
      request: "Use the full picture.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.creativePolish?.serviceIcons).not.toBe(true);
    expect(result.project.heroImagePresentation?.fit).toMatch(/full|contain/);
  });
});

describe("Complete my website — no active plan", () => {
  it("creates a fresh plan instead of empty-plan copy", async () => {
    const result = await runAtlasBrain({
      project: greenGoldProject({
        atlasActionMemory: {
          updatedAt: new Date().toISOString(),
          applyAllPending: true,
          recommendations: [],
        },
      }),
      request: "Complete my website",
    });
    expect(result.explanation).not.toMatch(
      /don’t have applyable improvements queued/i,
    );
    expect(result.decision.needsClarification).toBe(false);
    expect(result.explanation).toMatch(
      /Overall direction|Biggest problem|Design goals|Execution plan|Done\.|Apply All|strategy/i,
    );
  });
});

describe("typed clarifications", () => {
  it("resolves gold color clarification", async () => {
    const memory = storePendingClarification(undefined, {
      question: "Which accent should I restore?",
      kind: "color",
      destination: "restore_accent",
    });
    expect(matchClarificationAnswer("gold", memory.pendingClarification!).resolvedColor).toBe(
      NAMED_COLORS.gold,
    );
    expect(shouldExecuteActionMemory("gold", memory)).toBe(true);
  });

  it("resolves hero image target clarification", () => {
    const memory = storePendingClarification(undefined, {
      question:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const matched = matchClarificationAnswer(
      "Hero image",
      memory.pendingClarification!,
    );
    expect(matched?.destination).toBe("apply_hero_fit");
    expect(shouldExecuteActionMemory("Hero image", memory)).toBe(true);
  });
});

describe("production hero placement → entire picture", () => {
  function photoAsset(id = "photo-1"): BusinessProject["mediaLibrary"][number] {
    return {
      id,
      name: "Photo 1.jpg",
      filename: "Photo 1.jpg",
      url: `https://example.com/${id}.jpg`,
      storagePath: `user/proj/${id}.jpg`,
      mimeType: "image/jpeg",
      size: 2048,
      sizeLabel: "2 KB",
      createdAt: Date.now(),
      title: "Photo 1",
      description: "",
      alt: "Photo 1",
    };
  }

  it("Use this as the hero image → Use the entire picture (no clarification)", async () => {
    const asset = photoAsset("photo-1");
    let project = greenGoldProject({
      heroImageId: null,
      mediaLibrary: [asset],
      galleryImageIds: [],
      heroImagePresentation: {
        fit: "cover",
        focalPoint: { x: 0.5, y: 0.5 },
        zoom: 1.2,
        position: "center",
      },
    });

    const placed = await runAtlasBrain({
      project,
      request: "Use this as the hero image.",
      attachmentContexts: [
        {
          attachmentId: "att1",
          assetId: "photo-1",
          type: "image",
          filename: "Photo 1.jpg",
          position: 0,
        },
      ],
    });
    expect(placed.applyStatus).toBe("applied");
    expect(placed.project.heroImageId).toBe("photo-1");
    expect(getActiveVisualTask(getActionMemory(placed.project))?.kind).toBe(
      "hero_image_fit",
    );
    expect(getActiveVisualTask(getActionMemory(placed.project))?.assetId).toBe(
      "photo-1",
    );
    project = placed.project;

    const fit = await runAtlasBrain({
      project,
      request: "Use the entire picture.",
    });
    expect(fit.applyStatus).toBe("applied");
    expect(fit.explanation).not.toMatch(/which image|tell me which image/i);
    expect(fit.project.heroImageId).toBe("photo-1");
    const pres = readHeroImagePresentation(fit.project);
    expect(pres.fit).toBe("full");
    expect(pres.zoom).toBe(1);
    expect(pres.focalPoint).toEqual({ x: 0.5, y: 0.5 });
    expect(pres.position).toBe("center");
  });

  it("survives refresh: hero placement → reload memory → entire picture", async () => {
    const asset = photoAsset("photo-2");
    const placed = await runAtlasBrain({
      project: greenGoldProject({
        heroImageId: null,
        mediaLibrary: [asset],
        galleryImageIds: [],
      }),
      request: "Use this as the hero image.",
      attachmentContexts: [
        {
          attachmentId: "att1",
          assetId: "photo-2",
          type: "image",
          filename: "Photo 1.jpg",
          position: 0,
        },
      ],
    });
    expect(placed.project.heroImageId).toBe("photo-2");

    // Simulate refresh: project JSON round-trip keeps atlasActionMemory + heroImageId.
    const refreshed = JSON.parse(
      JSON.stringify(placed.project),
    ) as BusinessProject;

    const fit = await runAtlasBrain({
      project: refreshed,
      request: "Use the entire picture.",
    });
    expect(fit.applyStatus).toBe("applied");
    expect(fit.explanation).not.toMatch(/which image|tell me which image/i);
    expect(fit.project.heroImageId).toBe("photo-2");
    expect(readHeroImagePresentation(fit.project).fit).toBe("full");
  });

  it("hero image resolves image_target without re-asking", async () => {
    const project = greenGoldProject({
      heroImageId: "hero-busy",
      atlasActionMemory: storePendingClarification(undefined, {
        question:
          "Tell me which image to change — for example, “Replace the hero image” or “Move the gallery above Testimonials.”",
        kind: "image_target",
        destination: "apply_hero_fit",
        allowedAnswers: ["Hero image", "Gallery image"],
        context: { intent: "hero_full_picture" },
      }),
    });
    const withTask = {
      ...project,
      atlasActionMemory: {
        ...getActionMemory(project),
        activeVisualTask: {
          kind: "hero_image_fit" as const,
          target: "hero" as const,
          assetId: "hero-busy",
          updatedAt: new Date().toISOString(),
        },
      },
    };

    const resolve = await runAtlasBrain({
      project: withTask,
      request: "hero image",
    });
    expect(resolve.applyStatus).toBe("applied");
    expect(resolve.explanation).not.toMatch(/which image|tell me which image/i);
    expect(readHeroImagePresentation(resolve.project).fit).toBe("full");
    expect(
      getActionMemory(resolve.project).pendingClarification,
    ).toBeFalsy();
  });

  it("cut-off / entire hero phrases map to full fit", async () => {
    for (const request of [
      "Use the entire picture.",
      "Use the whole picture.",
      "Show the whole image.",
      "Don't crop it.",
      "It's being cut off.",
      "The hero image is cropped.",
      "Use the entire hero image. It's being cut off.",
      "Show more of the photo.",
    ]) {
      expect(isHeroFitRequest(request), request).toBe(true);
      const result = await runAtlasBrain({
        project: greenGoldProject({ heroImageId: "hero-busy" }),
        request,
      });
      expect(result.applyStatus, request).toBe("applied");
      expect(result.explanation, request).not.toMatch(
        /which image|tell me which image/i,
      );
      expect(readHeroImagePresentation(result.project).fit, request).toBe(
        "full",
      );
    }
  });
});

describe("hero fit model", () => {
  it("detects full-picture phrases", () => {
    expect(isHeroFitRequest("Use the full picture.")).toBe(true);
    expect(isHeroFitRequest("Use the entire picture.")).toBe(true);
    expect(isHeroFitRequest("Show the whole photo.")).toBe(true);
    expect(isHeroFitRequest("Don't crop it.")).toBe(true);
    expect(isHeroFitRequest("Fit the entire image.")).toBe(true);
    expect(isHeroFitRequest("It's being cut off.")).toBe(true);
    expect(isHeroFitRequest("The hero image is cropped.")).toBe(true);
    expect(isHeroFitRequest("Show more of the photo.")).toBe(true);
  });

  it("applies and verifies fit with preview/publish parity", async () => {
    const before = greenGoldProject({ heroOverlay: 50 });
    const result = await runAtlasBrain({
      project: before,
      request: "Use the full picture.",
    });
    expect(result.applyStatus).toBe("applied");
    const pres = readHeroImagePresentation(result.project);
    expect(pres.fit).toBe("full");
    expect(pres.zoom).toBe(1);
    expect(result.project.heroImageId).toBe(before.heroImageId);

    const style = buildSiteDesignStyle(result.project) as Record<string, string>;
    const css = buildStaticSiteCss(result.project);
    expect(style["--site-hero-object-fit"]).toBe("contain");
    expect(css).toContain("--site-hero-object-fit");
    expect(css).toContain("object-fit: var(--site-hero-object-fit");

    const last = getLastExecution(getActionMemory(result.project));
    expect(last?.scope).toBe("hero");
    expect(last?.paletteBefore?.accentColor).toBe(NAMED_COLORS.gold);
  });

  it("max-safe balance points to full picture next", async () => {
    const project = greenGoldProject({
      heroOverlay: 50,
      heroTreatment: {
        gradient: { direction: "bottom", strength: 0.8, coverage: 0.62 },
        textScrim: { enabled: true, opacity: 0.45, blur: 8 },
      },
    });
    const balanced = await runAtlasBrain({
      project,
      request: "The image is hard to see.",
    });
    expect(balanced.explanation).toMatch(/safest balance|full image/i);

    const fit = await runAtlasBrain({
      project: balanced.project,
      request: "Use the full picture.",
    });
    expect(fit.applyStatus).toBe("applied");
    expect(fit.project.heroImagePresentation?.fit).toMatch(/full|contain/);
  });
});
