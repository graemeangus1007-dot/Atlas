/**
 * Sprint 29.2 — Single typed clarification state.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  clearPendingClarification,
  countPendingClarifications,
  getActionMemory,
  matchClarificationAnswer,
  storePendingClarification,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  assertNoClarificationAsked,
  assertSingleClarification,
} from "@/lib/ai/interaction-invariants";
import { getInteractionDiagnostics } from "@/lib/ai/interaction-diagnostics";
import {
  normalizeInteractionState,
  roundTripProjectJson,
  setInteractionState,
} from "@/lib/ai/interaction-state";
import { readHeroImagePresentation } from "@/lib/ai/hero-image-presentation";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function base(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    accentColor: NAMED_COLORS.gold,
    primaryColor: NAMED_COLORS.forestGreen,
    heroImageId: "hero-busy",
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("legacy nested clarification promotion", () => {
  it("promotes nested-only pending to top-level once and strips nested", () => {
    const legacy = base({
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        activeVisualTask: {
          kind: "hero_image_fit",
          target: "hero",
          assetId: "hero-busy",
          pendingClarification: {
            kind: "image_target",
            allowedTargets: ["hero", "gallery"],
          },
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const once = normalizeInteractionState(legacy);
    expect(countPendingClarifications(getActionMemory(once))).toBe(1);
    expect(getActionMemory(once).pendingClarification?.kind).toBe("image_target");
    expect(
      getActionMemory(once).activeVisualTask?.pendingClarification,
    ).toBeUndefined();
    assertSingleClarification(once);

    const twice = normalizeInteractionState(once);
    expect(getActionMemory(twice).pendingClarification?.pendingQuestion).toBe(
      getActionMemory(once).pendingClarification?.pendingQuestion,
    );
    expect(
      getActionMemory(twice).activeVisualTask?.pendingClarification,
    ).toBeUndefined();
  });

  it("top-level wins when both exist", () => {
    const both = base({
      atlasActionMemory: {
        ...storePendingClarification(undefined, {
          question: "Top-level question about the hero?",
          kind: "image_target",
          destination: "apply_hero_fit",
        }),
        activeVisualTask: {
          kind: "hero_image_fit",
          target: "hero",
          pendingClarification: {
            kind: "image_target",
            allowedTargets: ["gallery"],
          },
          updatedAt: new Date().toISOString(),
        },
      },
    });

    const normalized = normalizeInteractionState(both);
    expect(getActionMemory(normalized).pendingClarification?.pendingQuestion).toBe(
      "Top-level question about the hero?",
    );
    expect(
      getActionMemory(normalized).activeVisualTask?.pendingClarification,
    ).toBeUndefined();
    assertSingleClarification(normalized);
  });
});

describe("typed clarification single-shot", () => {
  it("color: gold resolves once, applies, clears", async () => {
    const asked = await runAtlasBrain({
      project: {
        ...base({ accentColor: "#111111" }),
        atlasActionMemory: {
          updatedAt: new Date().toISOString(),
          lastExecution: {
            request: "style form",
            at: new Date().toISOString(),
            success: true,
            verified: true,
            operationTypes: ["setComponentSurface"],
            operations: [],
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: [],
            explanation: "styled",
            paletteBefore: null,
            scope: "unknown",
          },
        },
      },
      request: "Why did you get rid of the gold?",
    });
    expect(asked.applyStatus).toBe("needs_clarification");
    expect(getActionMemory(asked.project).pendingClarification?.kind).toBe(
      "color",
    );

    const resolved = await runAtlasBrain({
      project: asked.project,
      request: "gold",
    });
    expect(resolved.applyStatus).toBe("applied");
    expect(resolved.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(getActionMemory(resolved.project).pendingClarification).toBeFalsy();
    expect(resolved.explanation).not.toMatch(/which accent|tell me the accent/i);
  });

  it("image target: hero image resolves once without repeat", async () => {
    const pending = storePendingClarification(undefined, {
      question:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const project = setInteractionState(base(), pending);
    const resolve = await runAtlasBrain({
      project,
      request: "hero image",
    });
    expect(resolve.applyStatus).toBe("applied");
    assertNoClarificationAsked(resolve.explanation);
    expect(readHeroImagePresentation(resolve.project).fit).toBe("full");
    expect(getActionMemory(resolve.project).pendingClarification).toBeFalsy();
    expect(getActionMemory(resolve.project).lastClarificationClear?.reason).toBe(
      "resolved",
    );
  });
});

describe("plan storage preserves pending", () => {
  it("storeRecommendations keeps unanswered clarification", () => {
    const withPending = storePendingClarification(undefined, {
      question: "Which image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const after = storeRecommendations(withPending, {
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
    expect(after.pendingClarification?.kind).toBe("image_target");
    expect(after.activePlan?.recommendations?.length).toBe(1);
  });
});

describe("critique override clears with explicit reason", () => {
  it("stale clarification is cleared for critique request", async () => {
    const pending = storePendingClarification(undefined, {
      question: "Which image?",
      kind: "image_target",
      destination: "apply_hero_fit",
    });
    const project = setInteractionState(base(), pending);
    const result = await runAtlasBrain({
      project,
      request: "Review my website",
    });
    expect(getActionMemory(result.project).pendingClarification).toBeFalsy();
    expect(
      getActionMemory(result.project).lastClarificationClear?.reason,
    ).toBe("critique_override");
    expect(result.explanation).not.toMatch(/which image should use the full/i);
  });
});

describe("refresh: ask → serialize → answer", () => {
  it("resolves after JSON round-trip with one pending", async () => {
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
    expect(countPendingClarifications(getActionMemory(refreshed))).toBe(1);

    const matched = matchClarificationAnswer(
      "Hero image",
      getActionMemory(refreshed).pendingClarification!,
    );
    expect(matched?.destination).toBe("apply_hero_fit");

    const resolved = await runAtlasBrain({
      project: refreshed,
      request: "Hero image",
    });
    expect(resolved.applyStatus).toBe("applied");
    expect(getActionMemory(resolved.project).pendingClarification).toBeFalsy();
  });
});

describe("diagnostics", () => {
  it("reports pending source and clear reason in development", () => {
    const project = setInteractionState(
      base(),
      clearPendingClarification(
        storePendingClarification(undefined, {
          question: "Which accent?",
          kind: "color",
          destination: "restore_accent",
        }),
        { reason: "resolved" },
      ),
    );
    const snap = getInteractionDiagnostics(project);
    expect(snap?.adapterPhase).toBe(5);
    expect(snap?.legacyDirectWrites).toBe(0);
    expect(snap?.lastClarificationClearReason).toBe("resolved");
    expect(snap?.duplicateClarificationDetected).toBe(false);
  });
});
