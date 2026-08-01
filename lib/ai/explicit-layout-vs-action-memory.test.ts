/**
 * Explicit layout edits must never be gated by Action Memory / active plans.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  detectActionConfirmation,
  shouldExecuteActionMemory,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  getEffectiveSectionOrder,
  parseSectionMoveRequest,
} from "@/lib/ai/section-order";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    atlasActionMemory: undefined,
    sectionOrder: [
      "hero",
      "contact",
      "about",
      "services",
      "features",
      "gallery",
      "testimonials",
      "faq",
    ],
    designSections: {
      enabled: ["testimonials", "faq"],
      testimonials: [{ quote: "Great work.", author: "Sam" }],
      faq: [{ question: "Area?", answer: "Coastal towns." }],
    },
    ...overrides,
  };
}

function activePlanMemory() {
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

describe("Action Memory must not gate explicit layout edits", () => {
  it("does not treat “below everything else” as Apply All", () => {
    const request =
      "Move the contact section below everything else, at the bottom of the site.";
    expect(detectActionConfirmation(request).kind).toBe("none");
    expect(
      shouldExecuteActionMemory(request, activePlanMemory()),
    ).toBe(false);
  });

  it("parses contact-to-bottom phrasing including “below everything else”", () => {
    const parsed = parseSectionMoveRequest(
      "Move the contact section below everything else, at the bottom of the site.",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.intent.section).toBe("contact");
      expect(parsed.intent.position).toBe("last");
    }
  });

  it("routes contact-to-bottom with no active plan through section reorder", async () => {
    const result = await runAtlasBrain({
      project: sampleProject(),
      request:
        "Move the contact section below everything else, at the bottom of the site.",
    });
    expect(result.explanation).not.toMatch(
      /applyable improvements queued|Review the site first|Apply All/i,
    );
    expect(result.applyStatus).toBe("applied");
    expect(
      result.operations.some((op) => op.operation === "moveSection"),
    ).toBe(true);
    const order = getEffectiveSectionOrder(result.project);
    expect(order[order.length - 1]).toBe("contact");
    expect(order[0]).toBe("hero");
  });

  it("applies contact-to-bottom while an unrelated plan exists", async () => {
    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: activePlanMemory() }),
      request:
        "Move the contact section below everything else, at the bottom of the site.",
    });
    expect(result.explanation).not.toMatch(
      /applyable improvements queued|Review the site first/i,
    );
    expect(result.applyStatus).toBe("applied");
    expect(
      result.operations.some((op) => op.operation === "moveSection"),
    ).toBe(true);
    expect(getEffectiveSectionOrder(result.project).at(-1)).toBe("contact");
    // Unrelated plan remains available — we did not consume Apply All
    expect(result.project.atlasActionMemory?.applyAllPending).toBe(true);
  });

  it("puts testimonials above services with or without an active plan", async () => {
    const bare = await runAtlasBrain({
      project: sampleProject(),
      request: "Put testimonials above services",
    });
    expect(bare.applyStatus).toBe("applied");
    expect(
      getEffectiveSectionOrder(bare.project).indexOf("testimonials"),
    ).toBeLessThan(getEffectiveSectionOrder(bare.project).indexOf("services"));

    const withPlan = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: activePlanMemory() }),
      request: "Put testimonials above services",
    });
    expect(withPlan.applyStatus).toBe("applied");
    expect(withPlan.explanation).not.toMatch(/applyable improvements queued/i);
    expect(
      getEffectiveSectionOrder(withPlan.project).indexOf("testimonials"),
    ).toBeLessThan(
      getEffectiveSectionOrder(withPlan.project).indexOf("services"),
    );
  });

  it("moves gallery below About without plan gating", async () => {
    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: activePlanMemory() }),
      request: "Move the gallery below the About section",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation).not.toMatch(/applyable improvements queued/i);
    const order = getEffectiveSectionOrder(result.project);
    expect(order.indexOf("gallery")).toBeGreaterThan(order.indexOf("about"));
  });

  it("clarifies ambiguous “move the hero higher” instead of Apply All", async () => {
    const decision = decideWithAtlasBrainEngine({
      project: sampleProject({ atlasActionMemory: activePlanMemory() }),
      request: "Move the hero higher",
    });
    expect(decision.stage).not.toBe("continuation");

    const result = await runAtlasBrain({
      project: sampleProject({ atlasActionMemory: activePlanMemory() }),
      request: "Move the hero higher",
    });
    expect(result.explanation).not.toMatch(/applyable improvements queued/i);
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.explanation).toMatch(/hero is already at the top/i);
  });

  it("still allows explicit plan references while a plan exists", () => {
    expect(detectActionConfirmation("Apply the first one").kind).toBe(
      "ordinal",
    );
    expect(
      shouldExecuteActionMemory("Apply All", activePlanMemory()),
    ).toBe(true);
    expect(
      shouldExecuteActionMemory("Apply the first one", activePlanMemory()),
    ).toBe(true);
  });
});
