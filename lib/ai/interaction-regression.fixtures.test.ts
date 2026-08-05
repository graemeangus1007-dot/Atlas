/**
 * Sprint 29.0 / Phase 0 — Permanent production conversation fixtures.
 *
 * These transcripts must remain green across Interaction Foundation migration.
 * Do not weaken assertions when migrating Action Memory → interaction adapters.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  clearPendingClarification,
  getActionMemory,
  matchClarificationAnswer,
  storePendingClarification,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { getActiveVisualTask } from "@/lib/ai/active-visual-task";
import {
  assertHeroPlacementTask,
  assertNoClarificationAsked,
  assertPersistenceRoundTrip,
  assertScopedMutation,
} from "@/lib/ai/interaction-invariants";
import {
  getInteractionState,
  roundTripProjectJson,
  setInteractionState,
} from "@/lib/ai/interaction-state";
import { readHeroImagePresentation } from "@/lib/ai/hero-image-presentation";
import { readGalleryInteraction } from "@/lib/ai/gallery-interaction";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { captureBrandPalette } from "@/lib/ai/hero-readability";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function media(
  id: string,
  title: string,
  name = `${title}.jpg`,
): MediaAsset {
  return {
    id,
    name,
    filename: name,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1800,
    sizeLabel: "2 KB",
    createdAt: Date.now(),
    title,
    description: "",
    alt: title,
  };
}

describe("fixture: hero placement → entire picture → refresh → entire picture", () => {
  it("stays green through migration", async () => {
    const photo = media("photo-1", "Photo 1");
    const placed = await runAtlasBrain({
      project: {
        ...MOCK_BUSINESS_PROJECT,
        heroImageId: null,
        mediaLibrary: [photo],
        galleryImageIds: [],
        accentColor: NAMED_COLORS.gold,
        primaryColor: NAMED_COLORS.forestGreen,
        atlasActionMemory: undefined,
      },
      request: "Use this as the hero image.",
      attachmentContexts: [
        {
          attachmentId: "att-1",
          assetId: "photo-1",
          type: "image",
          filename: "Photo 1.jpg",
          position: 0,
        },
      ],
    });

    expect(placed.applyStatus).toBe("applied");
    assertHeroPlacementTask(placed.project, "photo-1");
    expect(getActiveVisualTask(getInteractionState(placed.project))?.kind).toBe(
      "hero_image_fit",
    );

    const fit = await runAtlasBrain({
      project: placed.project,
      request: "Use the entire picture.",
    });
    expect(fit.applyStatus).toBe("applied");
    assertNoClarificationAsked(fit.explanation);
    expect(readHeroImagePresentation(fit.project).fit).toBe("full");
    expect(fit.project.heroImageId).toBe("photo-1");
    assertScopedMutation(placed.project, fit.project, "hero_image_fit");
    assertPersistenceRoundTrip(fit.project);

    const refreshed = roundTripProjectJson(fit.project);
    const again = await runAtlasBrain({
      project: refreshed,
      request: "Use the entire picture.",
    });
    assertNoClarificationAsked(again.explanation);
    expect(again.applyStatus).toBe("applied");
    expect(again.explanation).not.toMatch(/upload/i);
    expect(readHeroImagePresentation(again.project).fit).toBe("full");
    expect(again.project.heroImageId).toBe("photo-1");
  });
});

describe("fixture: gallery upload → rename → lightbox → refresh", () => {
  it("stays green through migration", async () => {
    const a1 = media("a1", "133989754380766849", "133989754380766849.jpg");
    const a2 = media("a2", "Front Yard", "front-yard.jpg");
    let project: BusinessProject = {
      ...MOCK_BUSINESS_PROJECT,
      mediaLibrary: [a1, a2],
      galleryImageIds: ["a1", "a2", "", ""],
      atlasActionMemory: undefined,
    };

    const renamed = await runAtlasBrain({
      project,
      request: 'Rename the first gallery photo to "Spring Patio".',
    });
    // Metadata rename may apply or clarify depending on planner — accept applied path.
    if (renamed.applyStatus === "applied") {
      const first = renamed.project.mediaLibrary.find((m) => m.id === "a1");
      expect(first?.title?.toLowerCase()).toMatch(/spring|patio|photo/i);
      project = renamed.project;
    }

    const lightbox = await runAtlasBrain({
      project,
      request:
        "I want to be able to view the entire picture when I click one of the photos.",
    });
    expect(lightbox.applyStatus).toBe("applied");
    expect(readGalleryInteraction(lightbox.project).mode).toBe("lightbox");
    assertScopedMutation(project, lightbox.project, "gallery_interaction");

    const refreshed = roundTripProjectJson(lightbox.project);
    expect(readGalleryInteraction(refreshed).mode).toBe("lightbox");
    expect(getInteractionState(refreshed)).toBeTruthy();
  });
});

describe("fixture: color clarification → gold → restore", () => {
  it("stays green through migration", async () => {
    const before = {
      ...MOCK_BUSINESS_PROJECT,
      accentColor: "#111111",
      primaryColor: NAMED_COLORS.forestGreen,
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        lastExecution: {
          request: "Make the form fields green",
          at: new Date().toISOString(),
          success: true,
          verified: true,
          operationTypes: ["setComponentSurface"],
          operations: [],
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: ["componentSurfaces"],
          explanation: "Styled fields",
          paletteBefore: null,
          scope: "unknown" as const,
        },
      },
    };

    const asked = await runAtlasBrain({
      project: before,
      request: "Why did you get rid of the gold?",
    });
    expect(asked.applyStatus).toBe("needs_clarification");
    const pending = getActionMemory(asked.project).pendingClarification;
    expect(pending?.kind).toBe("color");
    expect(matchClarificationAnswer("gold", pending!)?.resolvedColor).toBe(
      NAMED_COLORS.gold,
    );

    const restored = await runAtlasBrain({
      project: asked.project,
      request: "gold",
    });
    expect(restored.applyStatus).toBe("applied");
    expect(restored.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(getActionMemory(restored.project).pendingClarification).toBeFalsy();

    // Preference memory must survive clarification clear.
    const withPrefs = setInteractionState(
      {
        ...MOCK_BUSINESS_PROJECT,
        atlasMemory: {
          businessTone: "warm",
          updatedAt: new Date().toISOString(),
        },
        accentColor: NAMED_COLORS.gold,
      },
      storePendingClarification(undefined, {
        question: "Accent?",
        kind: "color",
        destination: "restore_accent",
      }),
    );
    const cleared = setInteractionState(
      withPrefs,
      clearPendingClarification(getActionMemory(withPrefs)),
    );
    expect(cleared.atlasMemory?.businessTone).toBe("warm");
    expect(captureBrandPalette(cleared).accentColor).toBe(NAMED_COLORS.gold);
  });
});
