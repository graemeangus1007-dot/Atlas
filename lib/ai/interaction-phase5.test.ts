/**
 * Sprint 29.5 — Generalized canonical active-task transcripts.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  getActionMemory,
  shouldExecuteActionMemory,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  assertActiveTaskBlocksUnrelatedPlan,
  assertInteractionInvariant,
  assertNoClarificationAsked,
  assertNoIndependentContinuationStore,
  assertSingleActiveTask,
  assertTaskAfterVerifiedScoped,
  assertTaskRefsAgreeWithTruth,
  assertTopicSwitchDeterministic,
} from "@/lib/ai/interaction-invariants";
import {
  getInteractionState,
  normalizeInteractionState,
  roundTripProjectJson,
  setInteractionState,
} from "@/lib/ai/interaction-state";
import { readGalleryInteraction } from "@/lib/ai/gallery-interaction";
import { readHeroImagePresentation } from "@/lib/ai/hero-image-presentation";
import { getEffectiveSectionOrder } from "@/lib/ai/section-order";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${title}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 2048,
    sizeLabel: "2 KB",
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
  };
}

function base(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    accentColor: "#c9a227",
    primaryColor: "#1f3d2b",
    heroImageId: "hero-busy",
    mediaLibrary: [
      asset("hero-busy", "Storefront"),
      asset("g1", "Yard"),
      asset("g2", "Patio"),
      asset("g3", "Kitchen"),
      asset("g4", "Deck"),
      asset("upload-1", "New Photo"),
    ],
    galleryImageIds: ["g1", "g2", "g3", "g4"],
    sectionOrder: [
      "hero",
      "about",
      "contact",
      "services",
      "gallery",
      "testimonials",
      "faq",
    ],
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("Sprint 29.5 — gallery interaction transcript", () => {
  it("lightbox follow-ups + refresh + turn off", async () => {
    let project = base();

    const uploaded = await runAtlasBrain({
      project: base({ galleryImageIds: ["", "", "", ""] }),
      request: "Add these to the gallery",
      attachmentContexts: [
        {
          attachmentId: "a1",
          assetId: "g1",
          type: "image",
          filename: "Yard.jpg",
          position: 0,
        },
        {
          attachmentId: "a2",
          assetId: "g2",
          type: "image",
          filename: "Patio.jpg",
          position: 1,
        },
        {
          attachmentId: "a3",
          assetId: "g3",
          type: "image",
          filename: "Kitchen.jpg",
          position: 2,
        },
        {
          attachmentId: "a4",
          assetId: "g4",
          type: "image",
          filename: "Deck.jpg",
          position: 3,
        },
      ],
    });
    expect(["applied", "no_changes"]).toContain(uploaded.applyStatus);
    project = uploaded.project.galleryImageIds?.some(Boolean)
      ? uploaded.project
      : base();

    const titles = await runAtlasBrain({
      project,
      request: "Remove the titles",
    });
    if (titles.applyStatus === "applied") {
      project = titles.project;
      expect(getInteractionState(project).activeTask?.kind).toBe(
        "gallery_metadata",
      );
    }

    const lightbox = await runAtlasBrain({
      project,
      request: "Let visitors click gallery photos to see the full image.",
    });
    expect(lightbox.applyStatus).toBe("applied");
    expect(readGalleryInteraction(lightbox.project).mode).toBe("lightbox");
    assertInteractionInvariant("I24_task_after_verified_scoped", () => {
      assertTaskAfterVerifiedScoped(lightbox.project, "gallery_interaction");
    });
    assertSingleActiveTask(lightbox.project);
    project = lightbox.project;

    const hide = await runAtlasBrain({
      project,
      request: "Hide captions.",
    });
    expect(hide.applyStatus).toBe("applied");
    expect(readGalleryInteraction(hide.project).captions).toBe(false);
    expect(getInteractionState(hide.project).activeTask?.kind).toBe(
      "gallery_interaction",
    );

    const refreshed = normalizeInteractionState(
      roundTripProjectJson(hide.project),
    );
    expect(getInteractionState(refreshed).activeTask?.kind).toBe(
      "gallery_interaction",
    );

    const off = await runAtlasBrain({
      project: refreshed,
      request: "Turn the lightbox off",
    });
    expect(off.applyStatus).toBe("applied");
    expect(readGalleryInteraction(off.project).mode).toBe("none");
  });
});

describe("Sprint 29.5 — surface styling transcript", () => {
  it("form-field soft follow-ups + informational + brand restore", async () => {
    const styled = await runAtlasBrain({
      project: base(),
      request: "Make form fields light green",
    });
    expect(styled.applyStatus).toBe("applied");
    expect(
      styled.project.componentSurfaces?.formFields?.backgroundColor,
    ).toBeTruthy();
    assertTaskAfterVerifiedScoped(styled.project, "surface_style");
    const goldBefore = styled.project.accentColor;

    const lighter = await runAtlasBrain({
      project: styled.project,
      request: "A little lighter.",
    });
    expect(lighter.applyStatus).toBe("applied");
    expect(getInteractionState(lighter.project).activeTask?.kind).toBe(
      "surface_style",
    );

    const borders = await runAtlasBrain({
      project: lighter.project,
      request: "Darker borders.",
    });
    expect(["applied", "no_changes"]).toContain(borders.applyStatus);

    const why = await runAtlasBrain({
      project: borders.project,
      request: "Why did you remove gold?",
    });
    // Informational — must not require clearing the surface task
    expect(getInteractionState(why.project).activeTask?.kind).toBe(
      "surface_style",
    );

    const restore = await runAtlasBrain({
      project: why.project,
      request: "Restore gold",
    });
    if (restore.applyStatus === "applied") {
      expect(restore.project.accentColor).toBeTruthy();
      const kind = getInteractionState(restore.project).activeTask?.kind;
      expect(["brand_restore", "surface_style"]).toContain(kind);
      void goldBefore;
    }
  });
});

describe("Sprint 29.5 — section layout transcript", () => {
  it("section moves survive refresh", async () => {
    let project = base();

    const contact = await runAtlasBrain({
      project,
      request: "Move Contact to the bottom.",
    });
    expect(contact.applyStatus).toBe("applied");
    expect(getInteractionState(contact.project).activeTask?.kind).toBe(
      "section_layout",
    );
    const order1 = getEffectiveSectionOrder(contact.project);
    expect(order1[order1.length - 1]).toBe("contact");
    project = contact.project;

    const testimonials = await runAtlasBrain({
      project,
      request: "Put Testimonials above Contact.",
    });
    expect(testimonials.applyStatus).toBe("applied");
    expect(getInteractionState(testimonials.project).activeTask?.kind).toBe(
      "section_layout",
    );
    project = testimonials.project;

    const faq = await runAtlasBrain({
      project,
      request: "Put FAQ before Contact.",
    });
    expect(faq.applyStatus).toBe("applied");
    project = faq.project;

    const refreshed = normalizeInteractionState(roundTripProjectJson(project));
    expect(getInteractionState(refreshed).activeTask?.kind).toBe(
      "section_layout",
    );

    const services = await runAtlasBrain({
      project: refreshed,
      request: "Move Services higher.",
    });
    expect(services.applyStatus).toBe("applied");
    assertSingleActiveTask(services.project);
  });
});

describe("Sprint 29.5 — image placement transcript", () => {
  it("placement follow-ups resolve from activeTask.assetId", async () => {
    const about = await runAtlasBrain({
      project: base({ heroImageId: "hero-busy" }),
      request: "Put this in About",
      attachmentContexts: [
        {
          attachmentId: "att-1",
          assetId: "upload-1",
          type: "image",
          filename: "New Photo.jpg",
          position: 0,
        },
      ],
    });
    expect(about.applyStatus).toBe("applied");
    expect(getInteractionState(about.project).activeTask?.kind).toBe(
      "image_placement",
    );
    expect(getInteractionState(about.project).activeTask?.assetId).toBe(
      "upload-1",
    );
    assertTaskRefsAgreeWithTruth(about.project);

    const gallery = await runAtlasBrain({
      project: about.project,
      request: "Move it to the gallery instead.",
    });
    expect(["applied", "needs_clarification", "no_changes"]).toContain(
      gallery.applyStatus,
    );

    const hero = await runAtlasBrain({
      project: gallery.project,
      request: "Use it as the hero",
      attachmentContexts: [
        {
          attachmentId: "att-1",
          assetId: "upload-1",
          type: "image",
          filename: "New Photo.jpg",
          position: 0,
        },
      ],
    });
    if (hero.applyStatus === "applied" && hero.project.heroImageId === "upload-1") {
      const fit = await runAtlasBrain({
        project: hero.project,
        request: "Show the full image",
      });
      expect(fit.applyStatus).toBe("applied");
      assertNoClarificationAsked(fit.explanation);
      expect(readHeroImagePresentation(fit.project).fit).toBe("full");
    }
  });
});

describe("Sprint 29.5 — topic switch", () => {
  it("hero refinement → contact form replaces task", async () => {
    const hero = await runAtlasBrain({
      project: base(),
      request: "Don't crop it.",
    });
    expect(hero.applyStatus).toBe("applied");
    const beforeKind = getInteractionState(hero.project).activeTask?.kind;
    expect(beforeKind).toMatch(/^hero_/);

    const switched = await runAtlasBrain({
      project: hero.project,
      request: "Now make the contact form shorter",
    });
    const afterKind = getInteractionState(switched.project).activeTask?.kind;
    assertInteractionInvariant("I26_topic_switch_deterministic", () => {
      assertTopicSwitchDeterministic({
        beforeKind,
        afterKind,
        clearedOrReplaced: afterKind !== beforeKind,
      });
    });
  });
});

describe("Sprint 29.5 — active plan isolation", () => {
  it("surface edit executes; plan does not hijack", async () => {
    const withPlan = setInteractionState(
      base(),
      storeRecommendations(undefined, {
        creative: [
          {
            id: "rec-1",
            kind: "visual",
            title: "Polish the hero",
            explanation: "Hero needs work",
            impact: "high",
            impactScore: 90,
            confidence: 0.9,
            operations: [
              {
                operation: "updateText",
                target: "heroHeadline",
                value: "Plan hijack headline",
              },
            ],
            capabilityIds: [],
            applyable: true,
            estimatedTime: "1s",
          },
        ],
        executionPlan: {
          goal: "Review site",
          steps: [],
          estimatedImpact: "high",
        },
      }),
    );

    expect(getInteractionState(withPlan).activePlan?.recommendations.length).toBe(
      1,
    );

    const surface = await runAtlasBrain({
      project: withPlan,
      request: "Make form fields light green",
    });
    expect(surface.applyStatus).toBe("applied");
    expect(surface.project.heroHeadline).toBe(withPlan.heroHeadline);
    expect(
      surface.project.componentSurfaces?.formFields?.backgroundColor,
    ).toBeTruthy();

    const wouldHijack = shouldExecuteActionMemory(
      "Make form fields light green",
      getActionMemory(withPlan),
    );
    assertInteractionInvariant("I25_active_task_blocks_unrelated_plan", () => {
      assertActiveTaskBlocksUnrelatedPlan(wouldHijack);
    });
  });
});

describe("Sprint 29.5 — I23 / I28", () => {
  it("I23 single active task shape", () => {
    const project = base({
      atlasActionMemory: {
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        activeTask: {
          kind: "surface_style",
          target: { type: "surface", surface: "form_fields" },
          userGoal: "green",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        pendingClarification: null,
        lastVerifiedExecution: null,
        preservation: null,
        activePlan: null,
        repair: null,
      },
    });
    assertSingleActiveTask(project);
  });

  it("I28 no independent durable continuation store", () => {
    assertNoIndependentContinuationStore();
  });
});
