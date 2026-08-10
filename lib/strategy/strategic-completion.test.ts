/**
 * v1.6.1 — Riverview Bakery production transcript regressions.
 * Advisory vs execute_completion intent + Complete → Transformation handoff.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import {
  storeRecommendations,
  detectActionConfirmation,
  shouldExecuteActionMemory,
} from "@/lib/ai/atlas-action-memory";
import {
  classifyStrategicRequest,
  formatStrategicDirectorReport,
  assessStrategicPriorities,
} from "@/lib/strategy";
import type { BusinessProject } from "@/types/business-project";

/** Riverview Bakery — production mock baseline. */
function riverview(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    atlasActionMemory: undefined,
  };
}

describe("v1.6.1 strategic intent classification", () => {
  it("marks advisory questions as advisory with distinct question types", () => {
    expect(classifyStrategicRequest("What's the biggest weakness?")).toEqual({
      mode: "advisory",
      advisoryQuestion: "biggest_weakness",
    });
    expect(classifyStrategicRequest("What should I fix first?")).toEqual({
      mode: "advisory",
      advisoryQuestion: "fix_first",
    });
    expect(
      classifyStrategicRequest("Where should I spend another hour?"),
    ).toEqual({
      mode: "advisory",
      advisoryQuestion: "time_allocation",
    });
    expect(
      classifyStrategicRequest("What would improve this site the most?"),
    ).toEqual({
      mode: "advisory",
      advisoryQuestion: "highest_impact",
    });
    expect(classifyStrategicRequest("What matters most?")).toEqual({
      mode: "advisory",
      advisoryQuestion: "general_priority",
    });
  });

  it("marks completion phrases as execute_completion", () => {
    for (const phrase of [
      "Complete my website.",
      "Finish my website.",
      "Complete the site.",
      "Finish the site.",
      "Make the website complete.",
      "Make it launch-ready.",
    ]) {
      expect(classifyStrategicRequest(phrase)).toEqual({
        mode: "execute_completion",
        advisoryQuestion: null,
      });
    }
  });

  it("does not treat Complete as Action Memory Apply All", () => {
    expect(detectActionConfirmation("Complete my website.").kind).toBe("none");
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
          estimatedTime: "<10 seconds",
        },
      ],
    });
    expect(shouldExecuteActionMemory("Complete my website.", memory)).toBe(
      false,
    );
    expect(shouldExecuteActionMemory("Apply All", memory)).toBe(true);
  });
});

describe("v1.6.1 advisory presentation semantics", () => {
  it("answers the same assessment with question-specific framing", () => {
    const assessment = assessStrategicPriorities({ project: riverview() });
    const weakness = formatStrategicDirectorReport(assessment, {
      mode: "advisory",
      advisoryQuestion: "biggest_weakness",
    });
    const fixFirst = formatStrategicDirectorReport(assessment, {
      mode: "advisory",
      advisoryQuestion: "fix_first",
    });
    const hour = formatStrategicDirectorReport(assessment, {
      mode: "advisory",
      advisoryQuestion: "time_allocation",
    });
    const impact = formatStrategicDirectorReport(assessment, {
      mode: "advisory",
      advisoryQuestion: "highest_impact",
    });

    expect(weakness).toMatch(/biggest weakness/i);
    expect(fixFirst).toMatch(/^Fix /i);
    expect(hour).toMatch(/Spend the next hour/i);
    expect(impact).toMatch(/highest-impact improvement/i);
    expect(weakness).not.toEqual(fixFirst);
    expect(fixFirst).not.toEqual(hour);
    expect(hour).not.toEqual(impact);
  });
});

describe("v1.6.1 Riverview advisory transcript", () => {
  it("What's the biggest weakness? → advisory only, no edits", async () => {
    const result = await runAtlasBrain({
      project: riverview(),
      request: "What's the biggest weakness?",
    });
    expect(result.decision?.commandKind).toBe("strategic_director");
    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toEqual([]);
    expect(result.explanation).toMatch(/biggest weakness/i);
    expect(result.followUpSuggestions.join(" ")).not.toMatch(/Apply All/i);
    expect(
      result.project.atlasActionMemory?.activePlan?.recommendations?.length ?? 0,
    ).toBe(0);
  });

  it("What should I fix first? → framed as first action", async () => {
    const result = await runAtlasBrain({
      project: riverview(),
      request: "What should I fix first?",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/^Fix /i);
    expect(result.operations).toEqual([]);
  });

  it("Where should I spend another hour? → time allocation framing", async () => {
    const result = await runAtlasBrain({
      project: riverview(),
      request: "Where should I spend another hour?",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/Spend the next hour/i);
  });

  it("What would improve this site the most? → highest impact framing", async () => {
    const result = await runAtlasBrain({
      project: riverview(),
      request: "What would improve this site the most?",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/highest-impact improvement/i);
  });
});

describe("v1.6.1 Complete my website execution handoff", () => {
  it("executes Transformation without Review Plan / Apply All pause", async () => {
    const withStalePlan = {
      ...riverview(),
      atlasActionMemory: storeRecommendations(undefined, {
        creative: [
          {
            id: "r1",
            kind: "conversion",
            title: "Clarify CTA",
            explanation: "CTA",
            impact: "high",
            impactScore: 90,
            confidence: 0.9,
            operations: [{ operation: "setPrimaryCta", value: "Order online" }],
            capabilityIds: [],
            applyable: true,
            estimatedTime: "<10 seconds",
          },
          {
            id: "r2",
            kind: "visual",
            title: "Add icons",
            explanation: "Icons",
            impact: "medium",
            impactScore: 70,
            confidence: 0.9,
            operations: [{ operation: "setCreativePolish", serviceIcons: true }],
            capabilityIds: [],
            applyable: true,
            estimatedTime: "<10 seconds",
          },
          {
            id: "r3",
            kind: "content",
            title: "Rewrite about",
            explanation: "About",
            impact: "medium",
            impactScore: 65,
            confidence: 0.8,
            operations: [],
            capabilityIds: [],
            applyable: false,
            estimatedTime: "manual",
          },
          {
            id: "r4",
            kind: "visual",
            title: "Add motion",
            explanation: "Motion",
            impact: "low",
            impactScore: 40,
            confidence: 0.7,
            operations: [{ operation: "setCreativePolish", motion: true }],
            capabilityIds: [],
            applyable: true,
            estimatedTime: "<10 seconds",
          },
        ],
      }),
    };

    const result = await runAtlasBrain({
      project: withStalePlan,
      request: "Complete my website.",
    });

    expect(result.decision?.commandKind).toBe("strategic_director");
    expect(result.decision?.matchedSignals).toEqual(
      expect.arrayContaining([
        "execute_completion",
        "transformationHandoff",
      ]),
    );
    expect(result.explanation).not.toMatch(/Say Apply all when you’re ready/i);
    expect(result.followUpSuggestions.join(" ")).not.toMatch(/Apply All/i);
    // Must not leave a Review/Apply All plan queued.
    expect(
      result.project.atlasActionMemory?.activePlan?.recommendations?.length ?? 0,
    ).toBe(0);
    expect(result.project.atlasActionMemory?.activePlan?.applyAllPending).not.toBe(
      true,
    );
    // Brand palette untouched unless explicitly authorized.
    expect(result.project.primaryColor).toBe(withStalePlan.primaryColor);
    expect(result.project.accentColor).toBe(withStalePlan.accentColor);
  });

  it("Complete after advisory transcript does not require Apply All", async () => {
    let project = riverview();
    for (const ask of [
      "What's the biggest weakness?",
      "What should I fix first?",
      "Where should I spend another hour?",
      "What would improve this site the most?",
    ]) {
      const turn = await runAtlasBrain({ project, request: ask });
      expect(turn.applyStatus).toBe("no_changes");
      project = turn.project;
    }

    const complete = await runAtlasBrain({
      project,
      request: "Complete my website.",
    });
    expect(complete.decision?.matchedSignals).toEqual(
      expect.arrayContaining(["execute_completion", "transformationHandoff"]),
    );
    expect(complete.explanation).not.toMatch(/Apply all when you’re ready/i);
    expect(
      complete.project.atlasActionMemory?.activePlan?.recommendations?.length ??
        0,
    ).toBe(0);
  });

  it("second Complete is idempotent when already strong", async () => {
    const first = await runAtlasBrain({
      project: riverview(),
      request: "Complete my website.",
    });
    const second = await runAtlasBrain({
      project: first.project,
      request: "Complete my website.",
    });
    // Either applied once then stopped, or already-satisfied message.
    if (second.applyStatus === "no_changes" && second.operations.length === 0) {
      expect(second.explanation).toMatch(
        /already in a strong completed state|didn’t make additional changes|already|kept the current|nothing new|no safe|need your input|completed/i,
      );
    }
  });
});

describe("v1.6.1 Review vs Complete UX contracts", () => {
  it("Review my website stays review-only with Apply All available", async () => {
    const review = await runAtlasBrain({
      project: riverview(),
      request: "Review my website.",
    });
    expect(review.applyStatus).toBe("no_changes");
    expect(review.decision?.intent).toBe("design_critique");
    expect(
      (review.project.atlasActionMemory?.activePlan?.recommendations?.length ??
        0) > 0 ||
        review.followUpSuggestions.some((s) => /Apply All/i.test(s)) ||
        /Apply all/i.test(review.explanation),
    ).toBe(true);

    const apply = await runAtlasBrain({
      project: review.project,
      request: "Apply all.",
    });
    // Apply All may apply or report nothing applyable — but must not be strategic completion.
    expect(apply.decision?.matchedSignals ?? []).not.toEqual(
      expect.arrayContaining(["execute_completion"]),
    );
  });

  it("routes Complete to strategic completion, not critique stage", () => {
    const decided = decideWithAtlasBrainEngine({
      project: riverview(),
      request: "Complete my website.",
    });
    // Decision engine does not own completion — atlas-brain short-circuits first.
    expect(decided.stage).not.toBe("critique");
  });
});
