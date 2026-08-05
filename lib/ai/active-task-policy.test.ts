/**
 * Sprint 29.5 — Canonical active-task policy unit tests.
 */

import { describe, expect, it } from "vitest";
import {
  activeTaskBlocksPlanContinuation,
  canContinueActiveTask,
  detectFreshTaskIntent,
  isExplicitTopicSwitch,
  shouldClearActiveTask,
  shouldReplaceActiveTask,
} from "@/lib/ai/active-task-policy";
import type { AtlasActiveTask } from "@/lib/ai/atlas-interaction-types";

function task(
  kind: AtlasActiveTask["kind"],
  target: AtlasActiveTask["target"] = { type: "hero" },
): AtlasActiveTask {
  return {
    kind,
    target,
    userGoal: "prior",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("active-task-policy — continuation", () => {
  it("continues gallery interaction soft follow-ups", () => {
    const t = task("gallery_interaction", { type: "gallery" });
    expect(canContinueActiveTask(t, "Hide the captions.")).toBe(true);
    expect(canContinueActiveTask(t, "Let them swipe too.")).toBe(true);
    expect(canContinueActiveTask(t, "Turn that off.")).toBe(true);
  });

  it("continues surface style soft follow-ups", () => {
    const t = task("surface_style", { type: "surface", surface: "form_fields" });
    expect(canContinueActiveTask(t, "A little lighter.")).toBe(true);
    expect(canContinueActiveTask(t, "Darker borders.")).toBe(true);
    expect(canContinueActiveTask(t, "Make the text black.")).toBe(true);
  });

  it("does not treat informational questions as continuation", () => {
    const t = task("surface_style", { type: "surface", surface: "form_fields" });
    expect(canContinueActiveTask(t, "Why did you remove gold?")).toBe(false);
    expect(shouldClearActiveTask("informational", t)).toBe(false);
  });

  it("blocks plan hijack for scoped active tasks", () => {
    const memory = {
      activeTask: task("surface_style", {
        type: "surface",
        surface: "form_fields",
      }),
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      activeTaskBlocksPlanContinuation(memory, "A little lighter."),
    ).toBe(true);
    expect(
      activeTaskBlocksPlanContinuation(memory, "Make form fields green."),
    ).toBe(true);
  });
});

describe("active-task-policy — topic switch", () => {
  it("replaces hero task on contact-form topic switch", () => {
    const t = task("hero_image_fit");
    expect(isExplicitTopicSwitch(t, "Now make the contact form shorter")).toBe(
      true,
    );
    expect(
      shouldReplaceActiveTask(t, detectFreshTaskIntent("Now make the contact form shorter")),
    ).toBe(true);
  });

  it("clears on critique override language", () => {
    const t = task("gallery_interaction", { type: "gallery" });
    expect(isExplicitTopicSwitch(t, "Review the whole website")).toBe(true);
    expect(shouldClearActiveTask("critique_override", t)).toBe(true);
  });

  it("plan_execution only from explicit plan language", () => {
    expect(detectFreshTaskIntent("Apply all.")).toBe("plan_execution");
    expect(detectFreshTaskIntent("Do those improvements.")).toBe(
      "plan_execution",
    );
    expect(detectFreshTaskIntent("A little lighter.")).not.toBe(
      "plan_execution",
    );
  });
});
