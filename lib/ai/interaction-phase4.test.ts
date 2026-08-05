/**
 * Sprint 29.4 — Retire mirrors + image continuation from canonical state.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  findRetiredMirrorKeys,
} from "@/lib/ai/atlas-interaction-migrate";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  assertImageContinuationFromActiveTask,
  assertInteractionInvariant,
  assertNoClarificationAsked,
  assertPlacementStoresCanonicalAsset,
  assertSingleClarification,
} from "@/lib/ai/interaction-invariants";
import {
  getInteractionState,
  normalizeInteractionState,
  roundTripProjectJson,
  setInteractionState,
} from "@/lib/ai/interaction-state";
import {
  resolveImageReference,
} from "@/lib/ai/image-reference-resolver";
import { storePendingClarification } from "@/lib/ai/atlas-action-memory";
import { readHeroImagePresentation } from "@/lib/ai/hero-image-presentation";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    type: "image",
    url: `https://cdn.example.com/${id}.jpg`,
    title,
    originalFilename: `${title}.jpg`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function base(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    heroImageId: "hero-busy",
    mediaLibrary: [
      asset("hero-busy", "Storefront"),
      asset("upload-1", "New Photo"),
      asset("g1", "Yard"),
      asset("g2", "Patio"),
    ],
    galleryImageIds: ["g1", "g2", "", ""],
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("Sprint 29.4 — legacy load → canonical save", () => {
  it("loads legacy mirrors then persists canonical-only", async () => {
    const legacy = base({
      atlasActionMemory: {
        updatedAt: "2026-01-01T00:00:00.000Z",
        activeVisualTask: {
          kind: "hero_image_fit",
          target: "hero",
          assetId: "hero-busy",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        lastExecution: {
          request: "prior",
          at: "2026-01-01T00:00:00.000Z",
          success: true,
          verified: true,
          operationTypes: [],
          operations: [],
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          explanation: "ok",
          paletteBefore: {
            primaryColor: "#111111",
            secondaryColor: "#222222",
            accentColor: "#c9a227",
            backgroundColor: "#ffffff",
            theme: "light",
          },
        },
      },
    });

    const result = await runAtlasBrain({
      project: legacy,
      request: "Don't crop it.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(findRetiredMirrorKeys(result.project.atlasActionMemory)).toEqual([]);
    expect(getInteractionState(result.project).activeTask?.kind).toMatch(
      /^hero_/,
    );
    expect(getInteractionState(result.project).version).toBe(1);
  });
});

describe("Sprint 29.4 — hero placement continuation after refresh", () => {
  it("Use as hero → refresh → full picture from activeTask", async () => {
    const placed = await runAtlasBrain({
      project: base({ heroImageId: null }),
      request: "Use this as the hero image",
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

    expect(placed.applyStatus).toBe("applied");
    expect(placed.project.heroImageId).toBe("upload-1");
    assertInteractionInvariant("I21_placement_stores_canonical_asset", () => {
      assertPlacementStoresCanonicalAsset(placed.project, "upload-1");
    });
    expect(findRetiredMirrorKeys(placed.project.atlasActionMemory)).toEqual([]);

    // Simulate refresh — strip any client ImageEditorState (not on project).
    const refreshed = normalizeInteractionState(
      roundTripProjectJson(placed.project),
    );
    assertInteractionInvariant("I20_image_continuation_from_active_task", () => {
      assertImageContinuationFromActiveTask(refreshed);
    });

    const resolved = resolveImageReference({
      interactionState: getInteractionState(refreshed),
      project: refreshed,
      message: "Use the full picture",
    });
    expect(resolved.source).toBe("active_task");
    expect(resolved.target?.kind).toBe("hero");
    expect(resolved.assetId).toBe("upload-1");

    const fit = await runAtlasBrain({
      project: refreshed,
      request: "Use the full picture",
    });
    expect(fit.applyStatus).toBe("applied");
    assertNoClarificationAsked(fit.explanation);
    expect(readHeroImagePresentation(fit.project).fit).toBe("full");
  });
});

describe("Sprint 29.4 — gallery continuation after refresh", () => {
  it("gallery metadata + lightbox from project truth + memory", async () => {
    const withGallery = base({
      galleryImageIds: ["g1", "g2", "", ""],
    });
    const titles = await runAtlasBrain({
      project: withGallery,
      request: "Remove titles from the gallery photos",
    });
    // May apply or no_changes depending on current titles — either is fine
    const afterRefresh = normalizeInteractionState(
      roundTripProjectJson(titles.project),
    );
    const lightbox = await runAtlasBrain({
      project: afterRefresh,
      request: "Add a photo viewer.",
    });
    expect(["applied", "no_changes", "needs_clarification"]).toContain(
      lightbox.applyStatus,
    );
    expect(findRetiredMirrorKeys(lightbox.project.atlasActionMemory)).toEqual(
      [],
    );
  });
});

describe("Sprint 29.4 — clarification survives refresh", () => {
  it("image-target ask → refresh → hero image resolves once", async () => {
    const asked = setInteractionState(
      base(),
      storePendingClarification(undefined, {
        question:
          "Which image should use the full-photo fit: the hero image or a gallery image?",
        kind: "image_target",
        destination: "apply_hero_fit",
      }),
    );
    const refreshed = normalizeInteractionState(roundTripProjectJson(asked));
    assertSingleClarification(refreshed);
    expect(findRetiredMirrorKeys(refreshed.atlasActionMemory)).toEqual([]);

    const resolved = await runAtlasBrain({
      project: refreshed,
      request: "hero image",
    });
    expect(resolved.applyStatus).toBe("applied");
    assertNoClarificationAsked(resolved.explanation);
    expect(getInteractionState(resolved.project).pendingClarification).toBeFalsy();
  });
});

describe("Sprint 29.4 — no transient attachment data persisted", () => {
  it("persists asset ids only after attach+send", async () => {
    const result = await runAtlasBrain({
      project: base({ heroImageId: null }),
      request: "Use this as the hero image",
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
    const raw = JSON.stringify(result.project.atlasActionMemory ?? {});
    expect(raw).not.toMatch(/blob:/i);
    expect(raw).not.toMatch(/object\/sign\//i);
    expect(getInteractionState(result.project).activeTask?.assetId).toBe(
      "upload-1",
    );
  });
});
