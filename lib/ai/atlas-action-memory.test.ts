/**
 * Sprint 26.1 — Atlas Brain Action Memory regression tests.
 */

import { describe, expect, it } from "vitest";
import {
  detectActionConfirmation,
  hasPendingClarification,
  matchClarificationAnswer,
  selectRecommendationsToApply,
  shouldExecuteActionMemory,
  storePendingClarification,
  storeRecommendations,
  type AtlasActionMemory,
  type AtlasStoredRecommendation,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

registerEditorPlanner(planEditOperations);

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
    unavailable: false,
  };
}

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    businessType: "Restaurant",
    mediaLibrary: [asset("asset-cookies", "fresh cookies")],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    designSections: undefined,
    creativePolish: undefined,
    atlasMemory: undefined,
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function storedRec(
  partial: Partial<AtlasStoredRecommendation> & Pick<AtlasStoredRecommendation, "id" | "title" | "kind">,
): AtlasStoredRecommendation {
  return {
    source: "creative_director",
    applyable: true,
    operations: [
      {
        operation: "setCreativePolish",
        serviceIcons: true,
        motion: true,
      },
    ],
    explanation: partial.title,
    ...partial,
  };
}

function memoryWithRecs(
  recs: AtlasStoredRecommendation[],
): AtlasActionMemory {
  return storeRecommendations(undefined, {
    creative: recs.map((r) => ({
      id: r.id,
      kind: (["visual", "content", "motion", "conversion", "brand"].includes(
        r.kind,
      )
        ? r.kind
        : "visual") as "visual",
      title: r.title,
      explanation: r.explanation || r.title,
      impact: "high",
      impactScore: 90,
      confidence: 0.9,
      operations: r.operations,
      capabilityIds: [],
      applyable: r.applyable,
      estimatedTime: "<10 seconds",
    })),
  });
}

describe("Apply All", () => {
  it("executes queued recommendations when the user says Apply All", () => {
    const memory = memoryWithRecs([
      storedRec({ id: "visual.icons", title: "Add service icons", kind: "visual" }),
      storedRec({
        id: "motion.scroll",
        title: "Add subtle motion",
        kind: "motion",
        operations: [{ operation: "setCreativePolish", motion: true }],
      }),
    ]);
    const project = sampleProject({ atlasActionMemory: memory });
    const result = runAtlasBrain({ project, request: "Apply All" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation.toLowerCase()).toMatch(/applied|done/);
    expect(result.project.creativePolish?.serviceIcons).toBe(true);
    expect(result.project.atlasActionMemory?.applyAllPending).toBe(false);
    expect(result.project.atlasActionMemory?.recommendations?.length ?? 0).toBe(0);
  });

  it("stores recommendations after a review so Apply All can follow", () => {
    const reviewed = runAtlasBrain({
      project: sampleProject(),
      request: "What should I improve?",
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(reviewed.project.atlasActionMemory?.applyAllPending).toBe(true);
    expect(
      (reviewed.project.atlasActionMemory?.recommendations?.length ?? 0) > 0,
    ).toBe(true);

    const applied = runAtlasBrain({
      project: reviewed.project,
      request: "Apply All",
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.applyStatus).toBe("applied");
    expect(applied.explanation.toLowerCase()).not.toMatch(/did you mean/i);
  });
});

describe("Apply / Yes / Go ahead", () => {
  it.each(["Apply", "Yes", "Go ahead", "Do it", "Everything", "All of them"])(
    "treats “%s” as confirmation when recommendations are active",
    (phrase) => {
      const memory = memoryWithRecs([
        storedRec({ id: "visual.icons", title: "Add icons", kind: "visual" }),
      ]);
      expect(shouldExecuteActionMemory(phrase, memory)).toBe(true);
      expect(detectActionConfirmation(phrase).kind).not.toBe("none");

      const result = runAtlasBrain({
        project: sampleProject({ atlasActionMemory: memory }),
        request: phrase,
      });
      expect(result.applyStatus).toBe("applied");
      expect(result.explanation.toLowerCase()).not.toMatch(/did you mean/i);
    },
  );
});

describe("clarification once", () => {
  it("stores pending clarification when Atlas asks", () => {
    const result = runAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(hasPendingClarification(result.project.atlasActionMemory)).toBe(
      true,
    );
    expect(
      result.project.atlasActionMemory?.pendingClarification?.allowedAnswers
        .length,
    ).toBeGreaterThan(1);
  });

  it("never asks the same clarification again on the next turn", () => {
    const first = runAtlasBrain({
      project: sampleProject(),
      request: "Not sure",
    });
    const second = runAtlasBrain({
      project: first.project,
      request: "Visuals",
    });
    expect(second.explanation.toLowerCase()).not.toMatch(
      /did you mean:\s*\n• better visuals/i,
    );
    expect(
      hasPendingClarification(second.project.atlasActionMemory),
    ).toBe(false);
  });
});

describe("clarification resolution", () => {
  it("resolves Better visuals without restarting routing into another clarify loop", () => {
    const pending = storePendingClarification(undefined, {
      question: "Did you mean?",
    });
    const withRecs = {
      ...pending,
      ...memoryWithRecs([
        storedRec({ id: "visual.icons", title: "Add icons", kind: "visual" }),
        storedRec({
          id: "content.faq",
          title: "Add FAQ",
          kind: "content",
          operations: [{ operation: "insertSection", type: "faq" }],
        }),
      ]),
      pendingClarification: pending.pendingClarification,
    };

    const matched = matchClarificationAnswer("Visuals", pending.pendingClarification!);
    expect(matched?.destination).toBe("visuals");

    const selected = selectRecommendationsToApply(
      withRecs,
      detectActionConfirmation("Visuals"),
      "visuals",
    );
    expect(selected.every((r) => ["visual", "brand", "motion"].includes(r.kind))).toBe(
      true,
    );

    const result = runAtlasBrain({
      project: sampleProject({ atlasActionMemory: withRecs }),
      request: "Visuals",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.creativePolish?.serviceIcons).toBe(true);
  });
});

describe("no clarification loops", () => {
  it("does not re-enter clarification when Apply All is typed after a review", () => {
    const reviewed = runAtlasBrain({
      project: sampleProject(),
      request: "Review my website",
    });
    const apply = runAtlasBrain({
      project: reviewed.project,
      request: "Apply All",
    });
    expect(apply.applyStatus).not.toBe("needs_clarification");
    expect(apply.explanation.toLowerCase()).not.toMatch(/did you mean/i);
  });

  it("skips intent routing entirely for Apply All with active recs", () => {
    const memory = memoryWithRecs([
      storedRec({ id: "visual.icons", title: "Add icons", kind: "visual" }),
    ]);
    expect(shouldExecuteActionMemory("Apply All", memory)).toBe(true);
  });
});

describe("recommendation continuity", () => {
  it("understands ordinal and kind filters from previous context", () => {
    const memory = memoryWithRecs([
      storedRec({ id: "a", title: "First", kind: "visual" }),
      storedRec({
        id: "b",
        title: "Second",
        kind: "content",
        operations: [{ operation: "insertSection", type: "faq" }],
      }),
    ]);
    const first = selectRecommendationsToApply(
      memory,
      detectActionConfirmation("the first one"),
    );
    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe("a");

    const visuals = selectRecommendationsToApply(
      memory,
      detectActionConfirmation("Actually just the visuals"),
      "visuals",
    );
    expect(visuals.every((r) => r.kind === "visual")).toBe(true);
  });
});
