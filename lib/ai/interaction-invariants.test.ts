/**
 * Sprint 29.0–29.1 — Interaction contract suite (I1–I13).
 * Locks adapter write ownership + production transcripts.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  clearPendingClarification,
  getActionMemory,
  getLastExecution,
  shouldExecuteActionMemory,
  storePendingClarification,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { getActiveVisualTask } from "@/lib/ai/active-visual-task";
import {
  getInteractionDiagnostics,
  logInteractionDiagnostics,
} from "@/lib/ai/interaction-diagnostics";
import {
  ALLOWED_INTERACTION_WRITE_MODULES,
  assertHeroPlacementTask,
  assertInteractionInvariant,
  assertInteractionWritesGoThroughAdapter,
  assertNoClarificationAsked,
  assertPersistenceRoundTrip,
  assertPrefsUntouched,
  assertScopedMutation,
  assertSingleClarification,
  assertVerifiedExecution,
  listChangedRootKeys,
} from "@/lib/ai/interaction-invariants";
import {
  cloneInteractionState,
  getInteractionState,
  INTERACTION_ADAPTER_PHASE,
  INTERACTION_STATE_VERSION,
  normalizeInteractionState,
  roundTripProjectJson,
  setInteractionState,
  updateInteractionState,
} from "@/lib/ai/interaction-state";
import { readHeroImagePresentation } from "@/lib/ai/hero-image-presentation";
import { captureBrandPalette } from "@/lib/ai/hero-readability";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function asset(id: string, title = "Photo 1"): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${title}.jpg`,
    url: `https://example.com/${id}.jpg`,
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

function baseProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    primaryColor: NAMED_COLORS.forestGreen,
    accentColor: NAMED_COLORS.gold,
    secondaryColor: NAMED_COLORS.forestGreen,
    backgroundColor: "#f7f8fa",
    headingFont: "inter",
    bodyFont: "inter",
    heroOverlay: 50,
    heroImageId: "hero-busy",
    atlasActionMemory: undefined,
    atlasMemory: {
      businessTone: "warm",
      preferredLayouts: ["classic"],
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("Phase 3 interaction adapter", () => {
  it("reads/writes canonical v1 with derived legacy mirrors", () => {
    const project = baseProject();
    const withMem = setInteractionState(
      project,
      storePendingClarification(undefined, {
        question: "Which accent?",
        kind: "color",
        destination: "restore_accent",
      }),
    );
    const state = getInteractionState(withMem);
    expect(state.version).toBe(1);
    expect(state.pendingClarification?.kind).toBe("color");
    expect(INTERACTION_STATE_VERSION).toBe(1);
    expect(INTERACTION_ADAPTER_PHASE).toBe(5);
    // Persisted payload is canonical-only.
    expect(withMem.atlasActionMemory).toMatchObject({
      version: 1,
      pendingClarification: state.pendingClarification,
    });
    expect(
      (withMem.atlasActionMemory as Record<string, unknown>).activeVisualTask,
    ).toBeUndefined();

    const updated = updateInteractionState(withMem, (current) => ({
      ...current,
      pendingClarification: null,
      lastClarificationClear: {
        reason: "explicit",
        at: new Date().toISOString(),
      },
    }));
    expect(getInteractionState(updated).pendingClarification).toBeNull();

    const cloned = cloneInteractionState(state);
    expect(cloned).toEqual(state);
    expect(cloned).not.toBe(state);

    const normalized = normalizeInteractionState({
      ...project,
      atlasActionMemory: undefined,
    });
    expect(getInteractionState(normalized).version).toBe(1);
    expect(getInteractionState(normalized).updatedAt).toBeTruthy();
  });
});

describe("interaction diagnostics (dev only)", () => {
  it("returns a snapshot outside production", () => {
    const project = setInteractionState(
      baseProject(),
      storeRecommendations(undefined, {
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
            estimatedTime: "1s",
          },
        ],
      }),
    );
    const snap = getInteractionDiagnostics(project);
    expect(snap).not.toBeNull();
    expect(snap?.interactionOwner).toBe("atlasActionMemory");
    expect(snap?.interactionVersion).toBe(1);
    expect(snap?.adapterPhase).toBe(5);
    expect(snap?.serializationMode).toBe("canonical_only");
    expect(snap?.canonicalStatePresent).toBe(true);
    expect(snap?.adapterUsage).toBe(true);
    expect(snap?.legacyDirectWrites).toBe(0);
    expect(snap?.writeCount).toBeGreaterThan(0);
    expect(snap?.writeOrigin).toBeTruthy();
    expect(snap?.plan.recommendationCount).toBe(1);
    expect(() => logInteractionDiagnostics(project)).not.toThrow();
  });
});

describe("I1 / I2 — clarification", () => {
  it("I1: at most one Action Memory clarification object", () => {
    const project = setInteractionState(
      baseProject(),
      storePendingClarification(undefined, {
        question: "Which image?",
        kind: "image_target",
        destination: "apply_hero_fit",
      }),
    );
    assertInteractionInvariant("I1_single_clarification", () => {
      assertSingleClarification(project);
    });
  });

  it("I2: hero image resolves image_target once", async () => {
    const pending = storePendingClarification(undefined, {
      question:
        "Tell me which image to change — for example, “Replace the hero image”.",
      kind: "image_target",
      destination: "apply_hero_fit",
      allowedAnswers: ["Hero image", "Gallery image"],
      context: { intent: "hero_full_picture" },
    });
    const project = {
      ...baseProject({ heroImageId: "hero-busy" }),
      atlasActionMemory: {
        ...pending,
        activeVisualTask: {
          kind: "hero_image_fit" as const,
          target: "hero" as const,
          assetId: "hero-busy",
          updatedAt: new Date().toISOString(),
        },
      },
    };
    const first = await runAtlasBrain({ project, request: "hero image" });
    assertInteractionInvariant("I2_no_repeat_clarification", () => {
      assertNoClarificationAsked(first.explanation);
      expect(first.applyStatus).toBe("applied");
      // Typed pending must clear on successful resolve (no sticky re-ask of same pending).
      expect(getActionMemory(first.project).pendingClarification).toBeFalsy();
      expect(readHeroImagePresentation(first.project).fit).toBe("full");
    });
  });
});

describe("I3 / I4 / I9 / I11 — hero placement → fit → refresh", () => {
  it("locks production transcript: place → entire picture → refresh → entire picture", async () => {
    const photo = asset("photo-1", "Photo 1");
    let project = baseProject({
      heroImageId: null,
      mediaLibrary: [photo],
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
    assertInteractionInvariant("I3_hero_placement_task", () => {
      assertHeroPlacementTask(placed.project, "photo-1");
    });
    project = placed.project;

    const fit = await runAtlasBrain({
      project,
      request: "Use the entire picture.",
    });
    assertInteractionInvariant("I4_hero_fit_no_clarify", () => {
      assertNoClarificationAsked(fit.explanation);
    });
    expect(fit.applyStatus).toBe("applied");
    expect(fit.project.heroImageId).toBe("photo-1");
    expect(readHeroImagePresentation(fit.project).fit).toBe("full");
    assertScopedMutation(project, fit.project, "hero_image_fit");
    assertVerifiedExecution({
      applyStatus: fit.applyStatus,
      project: fit.project,
    });
    assertPersistenceRoundTrip(fit.project);

    const refreshed = roundTripProjectJson(fit.project);
    assertInteractionInvariant("I9_persistence_round_trip", () => {
      assertPersistenceRoundTrip(refreshed);
    });

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

describe("I5 — plan does not hijack scoped intents", () => {
  it("active critique plan never executes for hero fit", () => {
    const memory = storeRecommendations(undefined, {
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
          estimatedTime: "1s",
        },
      ],
    });
    assertInteractionInvariant("I5_plan_does_not_hijack_scoped", () => {
      expect(shouldExecuteActionMemory("Use the entire picture.", memory)).toBe(
        false,
      );
      expect(
        shouldExecuteActionMemory(
          "Let people click photos to see the full image.",
          memory,
        ),
      ).toBe(false);
    });
  });
});

describe("I6 / I7 — verified execution + preservation", () => {
  it("hero fit records verified lastExecution with paletteBefore", async () => {
    const before = baseProject({
      accentColor: NAMED_COLORS.gold,
      primaryColor: NAMED_COLORS.forestGreen,
    });
    const palette = captureBrandPalette(before);
    const result = await runAtlasBrain({
      project: before,
      request: "Use the full picture.",
    });
    expect(result.applyStatus).toBe("applied");
    assertInteractionInvariant("I6_applied_means_verified", () => {
      assertVerifiedExecution({
        applyStatus: result.applyStatus,
        project: result.project,
      });
    });
    const last = getLastExecution(getActionMemory(result.project));
    expect(last?.paletteBefore?.accentColor).toBe(palette.accentColor);
    assertInteractionInvariant("I7_preservation_captured", () => {
      expect(last?.paletteBefore).toBeTruthy();
    });
  });
});

describe("I8 — plan store clarification policy", () => {
  it("storeRecommendations preserves unanswered clarification", () => {
    const withPending = storePendingClarification(undefined, {
      question: "Which image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const afterPlan = storeRecommendations(withPending, {
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
          estimatedTime: "1s",
        },
      ],
    });
    assertInteractionInvariant("I8_plan_store_clarification_policy", () => {
      expect(afterPlan.pendingClarification?.kind).toBe("image_target");
      expect(afterPlan.activePlan?.recommendations?.length).toBe(1);
    });
  });
});

describe("I10 — write ownership freeze", () => {
  it("assertInteractionWritesGoThroughAdapter — zero legacy direct writes", () => {
    assertInteractionInvariant("I10_write_ownership", () => {
      assertInteractionWritesGoThroughAdapter();
      expect(ALLOWED_INTERACTION_WRITE_MODULES).toContain(
        "lib/ai/interaction-state.ts",
      );
      expect(INTERACTION_ADAPTER_PHASE).toBe(5);
    });
  });
});

describe("I12 — preferences untouched by clarify clear", () => {
  it("clearing pending clarification does not mutate atlasMemory", () => {
    const before = setInteractionState(
      baseProject(),
      storePendingClarification(undefined, {
        question: "Which accent?",
        kind: "color",
        destination: "restore_accent",
      }),
    );
    const after = setInteractionState(
      before,
      clearPendingClarification(getActionMemory(before)),
    );
    assertInteractionInvariant("I12_prefs_untouched_by_clarify_clear", () => {
      assertPrefsUntouched(before, after);
    });
  });
});

describe("I13 — scoped mutation domains", () => {
  it("hero fit does not touch palette, typography, gallery, or layout", async () => {
    const before = baseProject({
      galleryImageIds: ["g1", "g2", "", ""],
      sectionOrder: ["hero", "about", "services", "gallery", "contact"],
      galleryInteraction: { mode: "none", navigation: true, captions: false },
    });
    const result = await runAtlasBrain({
      project: before,
      request: "Don't crop it.",
    });
    expect(result.applyStatus).toBe("applied");
    assertInteractionInvariant("I13_scoped_mutation", () => {
      assertScopedMutation(before, result.project, "hero_image_fit");
    });
    expect(listChangedRootKeys(before, result.project)).toEqual(
      expect.arrayContaining(["heroImagePresentation", "atlasActionMemory"]),
    );
  });

  it("gallery lightbox does not alter hero or typography", async () => {
    const g1 = asset("a1", "Yard");
    const before = baseProject({
      mediaLibrary: [g1],
      galleryImageIds: ["a1", "", "", ""],
      heroImageId: "hero-busy",
      headingFont: "inter",
      bodyFont: "inter",
    });
    const result = await runAtlasBrain({
      project: before,
      request: "Add a photo viewer.",
    });
    expect(result.applyStatus).toBe("applied");
    assertScopedMutation(before, result.project, "gallery_interaction");
    expect(result.project.heroImageId).toBe("hero-busy");
    expect(result.project.headingFont).toBe("inter");
  });

  it("surface styling does not replace imagery or section order", async () => {
    const before = baseProject({
      heroImageId: "hero-busy",
      galleryImageIds: ["g1", "", "", ""],
      sectionOrder: ["hero", "about", "services", "contact"],
    });
    const result = await runAtlasBrain({
      project: before,
      request: "Make the contact form fields light green.",
    });
    if (result.applyStatus === "applied") {
      assertScopedMutation(before, result.project, "surface_style");
      expect(result.project.heroImageId).toBe("hero-busy");
      expect(result.project.sectionOrder).toEqual(before.sectionOrder);
    }
  });
});

describe("active task helper smoke", () => {
  it("exposes active visual task through interaction state", () => {
    const project = baseProject({
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        activeVisualTask: {
          kind: "hero_image_fit",
          target: "hero",
          assetId: "hero-busy",
          updatedAt: new Date().toISOString(),
        },
      },
    });
    expect(getActiveVisualTask(getInteractionState(project))?.kind).toBe(
      "hero_image_fit",
    );
  });
});
