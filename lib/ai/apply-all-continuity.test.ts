/**
 * v1.6.7 — Apply All plan continuity contract.
 * Locks the production sequence: Complete / Review / Apply All / weakness.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  assessApplyAllPlanState,
  assertApplyAllHasExecutablePlan,
  canApplyAll,
  formatApplyAllContinuityFailure,
  isApplyAllRequest,
  NO_PLAN_APPLY_ALL_COPY,
  resolveApplyAllSource,
  STALE_PLAN_APPLY_ALL_COPY,
} from "@/lib/ai/apply-all-continuity";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  getActionMemory,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import { parseCritiqueMessage } from "@/lib/ai/critique-message-presentation";
import { ATLAS_DESIGNER_CLARIFICATION_OPTIONS } from "@/lib/ai/atlas-designer-voice";
import type { BusinessProject } from "@/types/business-project";

function baseProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    atlasActionMemory: undefined,
  };
}

function withReviewPlan(project: BusinessProject): BusinessProject {
  return {
    ...project,
    atlasActionMemory: storeRecommendations(undefined, {
      stored: [
        {
          id: "rec-hero",
          source: "design_critique",
          kind: "visual",
          title: "Simplify the hero treatment",
          explanation: "Reduce competing effects in the hero.",
          operations: [{ operation: "setCreativePolish", serviceIcons: false }],
          applyable: true,
          domain: "hero_composition",
          owner: "creative_director",
          objective: "Simplify the hero treatment",
        },
      ],
      reviewPlanSnapshot: {
        reviewPlanId: "rp-test-locked",
        projectRevision: "rev-locked",
        createdAt: new Date().toISOString(),
        strategicAssessmentId: "sa-test",
        highestPriorityOpportunityId: "hero_composition",
        highestPriorityTitle: "Simplify the hero treatment",
        recommendedLeader: "visual_composition",
        dependencyOrder: ["rec-hero"],
        recommendationIds: ["rec-hero"],
        websiteState: "developing",
        postCompletionEvidence: false,
      },
      sourceOverride: "design_critique",
    }),
  };
}

describe("apply-all-continuity helpers", () => {
  it("detects Apply All requests", () => {
    expect(isApplyAllRequest("Apply All")).toBe(true);
    expect(isApplyAllRequest("apply all")).toBe(true);
    expect(isApplyAllRequest("What's the biggest weakness?")).toBe(false);
  });

  it("canApplyAll requires applyAllPending + executable target", () => {
    expect(canApplyAll(undefined)).toBe(false);
    expect(canApplyAll(getActionMemory(withReviewPlan(baseProject())))).toBe(
      true,
    );
  });

  it("assertApplyAllHasExecutablePlan enforces UI invariant", () => {
    const memory = getActionMemory(baseProject());
    expect(assertApplyAllHasExecutablePlan(memory, false)).toBe(true);
    expect(assertApplyAllHasExecutablePlan(memory, true)).toBe(false);
  });

  it("resolution source prefers review snapshot", () => {
    expect(
      resolveApplyAllSource(getActionMemory(withReviewPlan(baseProject()))),
    ).toBe("review_plan_snapshot");
  });
});

describe("v1.6.7 production continuity sequence", () => {
  it("Complete my website executes without Apply All / Homepage review chrome", async () => {
    const result = await runAtlasBrain({
      project: baseProject(),
      request: "Complete my website",
    });

    expect(result.decision?.matchedSignals).toEqual(
      expect.arrayContaining(["execute_completion", "transformationHandoff"]),
    );
    expect(result.explanation).not.toMatch(/Say Apply all when you’re ready/i);
    expect(result.followUpSuggestions.join(" ")).not.toMatch(/Apply All/i);
    expect(
      result.project.atlasActionMemory?.activePlan?.applyAllPending,
    ).not.toBe(true);

    const parsed = parseCritiqueMessage(result.explanation);
    expect(parsed.kind).toBe("plain");
    expect(parsed.applyAllReady).toBe(false);
    expect(assessApplyAllPlanState({ project: result.project }).canApply).toBe(
      false,
    );
  });

  it("Review stores plan; Apply All executes it; never generic clarification", async () => {
    const reviewed = await runAtlasBrain({
      project: baseProject(),
      request: "Review my website",
    });
    expect(reviewed.applyStatus).toBe("no_changes");
    expect(reviewed.explanation).toMatch(/Highest priority|Apply all/i);
    const memory = getActionMemory(reviewed.project);
    expect(memory.activePlan?.applyAllPending).toBe(true);
    expect(memory.activePlan?.reviewPlanSnapshot).toBeTruthy();
    expect(assessApplyAllPlanState({ project: reviewed.project }).canApply).toBe(
      true,
    );

    const applied = await runAtlasBrain({
      project: reviewed.project,
      request: "Apply All",
    });
    expect(applied.applyStatus).not.toBe("needs_clarification");
    expect(applied.decision?.needsClarification).not.toBe(true);
    for (const chip of ATLAS_DESIGNER_CLARIFICATION_OPTIONS) {
      expect(applied.explanation).not.toContain(chip);
      expect(applied.followUpSuggestions.join(" ")).not.toContain(chip);
    }
    expect(applied.explanation).not.toMatch(/I want to be precise/i);
  });

  it("Apply All with no plan returns precise copy — not clarification chips", async () => {
    const result = await runAtlasBrain({
      project: baseProject(),
      request: "Apply All",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.decision?.needsClarification).not.toBe(true);
    expect(result.explanation).toBe(NO_PLAN_APPLY_ALL_COPY);
    for (const chip of ATLAS_DESIGNER_CLARIFICATION_OPTIONS) {
      expect(result.explanation).not.toContain(chip);
      expect(result.followUpSuggestions.join(" ")).not.toContain(chip);
    }
    expect(result.decision?.matchedSignals).toEqual(
      expect.arrayContaining(["apply_all_continuity", "no_plan"]),
    );
  });

  it("stale Apply All returns precise stale-plan response", async () => {
    const project = withReviewPlan(baseProject());
    // Mutate project so revision diverges from locked snapshot.
    const drifted: BusinessProject = {
      ...project,
      headline: `${project.headline} — revised`,
      primaryCta: "Book a consult",
    };
    const state = assessApplyAllPlanState({ project: drifted });
    expect(state.stale).toBe(true);
    expect(state.canApply).toBe(false);
    expect(formatApplyAllContinuityFailure({ stale: true })).toBe(
      STALE_PLAN_APPLY_ALL_COPY,
    );

    const result = await runAtlasBrain({
      project: drifted,
      request: "Apply All",
    });
    expect(result.explanation).toMatch(/changed since|refresh the plan/i);
    expect(result.decision?.needsClarification).not.toBe(true);
    for (const chip of ATLAS_DESIGNER_CLARIFICATION_OPTIONS) {
      expect(result.explanation).not.toContain(chip);
    }
  });

  it("advisory weakness does not orphan a visible Apply All plan", async () => {
    const reviewed = await runAtlasBrain({
      project: baseProject(),
      request: "Review my website",
    });
    expect(assessApplyAllPlanState({ project: reviewed.project }).canApply).toBe(
      true,
    );

    const advisory = await runAtlasBrain({
      project: reviewed.project,
      request: "What's the biggest weakness?",
    });
    expect(advisory.applyStatus).toBe("no_changes");
    expect(advisory.decision?.matchedSignals).toEqual(
      expect.arrayContaining(["advisory"]),
    );
    // Plan must remain executable (or UI must not show Apply All — here we keep it).
    expect(assessApplyAllPlanState({ project: advisory.project }).canApply).toBe(
      true,
    );
    expect(
      advisory.project.atlasActionMemory?.activePlan?.reviewPlanSnapshot,
    ).toBeTruthy();

    const applied = await runAtlasBrain({
      project: advisory.project,
      request: "Apply All",
    });
    expect(applied.decision?.needsClarification).not.toBe(true);
    for (const chip of ATLAS_DESIGNER_CLARIFICATION_OPTIONS) {
      expect(applied.explanation).not.toContain(chip);
    }
  });
});

describe("parseCritiqueMessage Complete vs Review", () => {
  it("Complete prose is plain — not Homepage review", () => {
    const body = [
      "The highest priority is simplifying the visual treatment so the page feels more polished and focused.",
      "",
      "What I’ll focus on",
      "1. Simplify the hero treatment",
      "2. Clarify the primary action",
    ].join("\n");
    const parsed = parseCritiqueMessage(body);
    expect(parsed.kind).toBe("plain");
    expect(parsed.applyAllReady).toBe(false);
  });

  it("Review body stays critique with Apply All ready", () => {
    const body = [
      "Here’s a focused homepage review.",
      "",
      "Highest priority",
      "Simplify the hero treatment",
      "",
      "Next improvements",
      "1. Simplify the hero treatment",
      "Why it matters: Competing effects dilute focus.",
      "",
      "Say Apply all when you’re ready, or pick any single improvement.",
    ].join("\n");
    const parsed = parseCritiqueMessage(body);
    expect(parsed.kind).toBe("critique");
    expect(parsed.applyAllReady).toBe(true);
  });
});
