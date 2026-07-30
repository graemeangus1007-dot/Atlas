/**
 * Sprint 28.2 — Natural Language Edit Planner regressions.
 */

import { describe, expect, it } from "vitest";
import {
  decideAtlasBrain,
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import {
  extractNaturalLanguageEditPlan,
  isNaturalLanguageEditRequest,
  shouldExecuteNlEditPlan,
} from "@/lib/ai/nl-edit-planner";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

registerEditorPlanner(planEditOperations);

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    primaryColor: "#3db8a8",
    accentColor: "#3db8a8",
    theme: "light",
    atlasActionMemory: undefined,
    ...overrides,
  };
}

function expectNoGenericClarification(text: string) {
  expect(text).not.toMatch(/Better visuals/i);
  expect(text).not.toMatch(/Better copy/i);
  expect(text).not.toMatch(/Better conversions/i);
  expect(text).not.toMatch(/Did you mean/i);
}

describe("NL edit planner extraction", () => {
  it("plans green and gold theme update", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Turn the colors green and gold.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.95);
    const theme = plan.operations.find((o) => o.operation === "changeTheme");
    expect(theme?.operation).toBe("changeTheme");
    if (theme?.operation === "changeTheme") {
      expect(theme.primary).toBe(NAMED_COLORS.green);
      expect(theme.accent).toBe(NAMED_COLORS.gold);
    }
  });

  it("plans button readability improvements", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Make the buttons easier to read.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(
      plan.operations.some(
        (o) =>
          o.operation === "setButtonStyle" ||
          o.operation === "setTypography" ||
          o.operation === "setCreativePolish",
      ),
    ).toBe(true);
  });

  it("plans coordinated green+gold and contrast", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Use green and gold and increase contrast.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(plan.operations.some((o) => o.operation === "changeTheme")).toBe(
      true,
    );
    expect(
      plan.categories.includes("readability") ||
        plan.categories.includes("contrast"),
    ).toBe(true);
  });

  it("plans rounded buttons and spacing together", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Round the buttons and increase spacing.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(
      plan.operations.some(
        (o) => o.operation === "setButtonStyle" && o.value === "rounded",
      ),
    ).toBe(true);
    expect(
      plan.operations.some((o) => o.operation === "setCreativePolish"),
    ).toBe(true);
  });

  it("plans contact form prominence", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Move the contact form higher.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(
      plan.operations.some(
        (o) =>
          o.operation === "setCreativePolish" && o.contactFormEnabled === true,
      ),
    ).toBe(true);
  });

  it("plans luxury typography", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Use a luxury font.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    const type = plan.operations.find((o) => o.operation === "setTypography");
    expect(type?.operation).toBe("setTypography");
    if (type?.operation === "setTypography") {
      expect(type.headingFont).toBe("playfair");
    }
  });

  it("plans full-site readability", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Make everything easier to read.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(true);
    expect(plan.categories).toContain("readability");
  });

  it("allows clarification for vague make it nicer", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: sampleProject(),
      request: "Make it nicer.",
    });
    expect(shouldExecuteNlEditPlan(plan)).toBe(false);
    expect(isNaturalLanguageEditRequest("Make it nicer.")).toBe(false);
  });
});

describe("Brain routing — no Better visuals for clear edits", () => {
  const cases = [
    "Turn the colors green and gold.",
    "Make the buttons easier to read.",
    "Use green and gold and increase contrast.",
    "Round the buttons and increase spacing.",
    "Move the contact form higher.",
    "Use a luxury font.",
    "Make everything easier to read.",
  ];

  for (const request of cases) {
    it(`executes without clarification: ${request}`, async () => {
      const engine = decideWithAtlasBrainEngine({
        project: sampleProject(),
        request,
      });
      expect(engine.decision.needsClarification).toBe(false);
      expect(engine.decision.intent).not.toBe("unknown");
      expect(engine.stage).not.toBe("clarification");

      const decision = decideAtlasBrain({
        project: sampleProject(),
        request,
      });
      expect(decision.needsClarification).toBe(false);

      const result = await runAtlasBrain({
        project: sampleProject(),
        request,
      });
      expect(result.applyStatus).not.toBe("needs_clarification");
      expectNoGenericClarification(result.explanation);
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.applyStatus).toBe("applied");
    });
  }

  it("handles production multi-sentence green/gold + readability", async () => {
    const request =
      "Turn the colors to green and gold. Make sure the words and buttons are easy to read.";
    const engine = decideWithAtlasBrainEngine({
      project: sampleProject(),
      request,
    });
    expect(engine.decision.needsClarification).toBe(false);

    const result = await runAtlasBrain({
      project: sampleProject(),
      request,
    });
    expect(result.applyStatus).toBe("applied");
    expectNoGenericClarification(result.explanation);
    expect(result.explanation).toMatch(/green|gold|read/i);
    const kinds = new Set(result.operations.map((o) => o.operation));
    expect(kinds.has("changeTheme")).toBe(true);
  });
});

describe("planEditOperations uses NL planner", () => {
  it("returns multi-ops for green and gold + readability", () => {
    const planned = planEditOperations({
      project: sampleProject(),
      request:
        "Turn the colors to green and gold. Make sure the words and buttons are easy to read.",
    });
    expect(planned.needsClarification).toBeFalsy();
    expect(planned.operations.length).toBeGreaterThan(1);
    expectNoGenericClarification(planned.explanation);
  });
});
