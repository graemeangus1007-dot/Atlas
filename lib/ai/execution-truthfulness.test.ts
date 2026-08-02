/**
 * v1.2 — Execution verification & truthfulness regression suite.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  getLastExecution,
  storeLastExecution,
  withActionMemory,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import {
  isExecutionDisputeRequest,
  type AtlasLastExecution,
} from "@/lib/ai/edit-execution-result";
import { isDesignSectionVisibleInProject } from "@/lib/ai/design-sections-canonical";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import {
  applyStatusFromExecution,
  isSectionPresentOnPage,
  verifyEditExecution,
  verifyMoveSection,
} from "@/lib/ai/verify-edit-execution";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { getEffectiveSectionOrder } from "@/lib/ai/section-order";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function baseProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    atlasActionMemory: undefined,
    sectionOrder: [
      "hero",
      "about",
      "services",
      "features",
      "gallery",
      "contact",
    ],
    designSections: undefined,
    ...overrides,
  };
}

describe("execution verification — section moves", () => {
  it("verifies success when Contact moves to the bottom", async () => {
    const result = await runAtlasBrain({
      project: baseProject({
        sectionOrder: [
          "hero",
          "contact",
          "about",
          "services",
          "features",
          "gallery",
        ],
      }),
      request: "Move the contact section to the bottom of the site",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation).toMatch(/moved|bottom/i);
    expect(result.explanation).not.toMatch(/I('ll| will) reorder/i);
    expect(getEffectiveSectionOrder(result.project).at(-1)).toBe("contact");
    expect(getLastExecution(result.project.atlasActionMemory)?.verified).toBe(
      true,
    );
  });

  it("inserts missing Testimonials then places them above Services", async () => {
    const project = baseProject();
    expect(isSectionPresentOnPage(project, "testimonials")).toBe(false);

    const result = await runAtlasBrain({
      project,
      request: "Put testimonials above services",
    });

    expect(result.applyStatus).toBe("applied");
    expect(result.operations.some((op) => op.operation === "insertSection")).toBe(
      true,
    );
    expect(result.operations.some((op) => op.operation === "moveSection")).toBe(
      true,
    );
    expect(result.explanation).toMatch(
      /didn['\u2019]?t have a Testimonials section/i,
    );
    expect(result.explanation).not.toMatch(/^Moved testimonials/i);
    expect(result.explanation).not.toMatch(/design language/i);
    expect(isDesignSectionVisibleInProject(result.project, "testimonials")).toBe(
      true,
    );
    const order = getEffectiveSectionOrder(result.project);
    expect(order.indexOf("testimonials")).toBeLessThan(
      order.indexOf("services"),
    );
  });

  it("never claims success for a missing non-insertable section", async () => {
    // Force an unknown path: move a required section that somehow isn't present
    // is impossible for contact — use verify API for the failure contract.
    const project = baseProject();
    const verified = verifyMoveSection(project, project, {
      section: "testimonials",
      position: "before",
      relativeTo: "services",
    });
    expect(verified.success).toBe(false);
    expect(verified.verified).toBe(true);
    expect(verified.explanation).toMatch(
      /doesn['\u2019]?t contain that section/i,
    );
    expect(applyStatusFromExecution(verified)).not.toBe("applied");
  });

  it("explains no-op when already in the requested position", async () => {
    const project = baseProject({
      sectionOrder: [
        "hero",
        "about",
        "services",
        "features",
        "gallery",
        "contact",
      ],
    });
    const result = await runAtlasBrain({
      project,
      request: "Move the contact section to the bottom of the site",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/already in that position/i);
    expect(result.explanation).not.toMatch(/\bDone\b/);
  });

  it("recognizes duplicate requests as no-op after a successful move", async () => {
    const first = await runAtlasBrain({
      project: baseProject({
        sectionOrder: [
          "hero",
          "contact",
          "about",
          "services",
          "features",
          "gallery",
        ],
      }),
      request: "Move Contact to the bottom",
    });
    expect(first.applyStatus).toBe("applied");

    const second = await runAtlasBrain({
      project: first.project,
      request: "Move Contact to the bottom",
    });
    expect(second.applyStatus).toBe("no_changes");
    expect(second.explanation).toMatch(/already in that position/i);
  });
});

describe("partial success verification", () => {
  it("reports both success and failure when only some ops land", () => {
    const before = baseProject();
    const after = {
      ...before,
      primaryColor: "#112233",
      accentColor: "#112233",
    };
    const result = verifyEditExecution(before, after, [
      { operation: "changeTheme", primary: "#112233", accent: "#112233" },
      {
        operation: "moveSection",
        section: "testimonials",
        position: "before",
        relativeTo: "services",
      },
    ]);
    expect(result.success).toBe(false);
    expect(result.explanation).toMatch(/color|palette/i);
    expect(result.explanation).toMatch(/Testimonials|doesn'?t contain/i);
  });
});

describe("conversation repair — disputed edits", () => {
  it.each([
    "I don't see it.",
    "Nothing changed.",
    "That didn't happen.",
    "Where is it?",
    "It's still the same.",
  ])("detects dispute phrase: %s", (phrase) => {
    expect(isExecutionDisputeRequest(phrase)).toBe(true);
  });

  it("repairs a false move claim by inserting Testimonials", async () => {
    const project = baseProject();
    const fake: AtlasLastExecution = {
      request: "Put testimonials above services",
      at: new Date().toISOString(),
      success: true,
      verified: false,
      operationTypes: ["moveSection"],
      operations: [
        {
          operation: "moveSection",
          section: "testimonials",
          position: "before",
          relativeTo: "services",
        },
      ],
      verificationFailures: ["The page doesn’t contain a visible Testimonials section."],
      createdEntities: [],
      modifiedEntities: ["sectionOrder"],
      explanation: "Moved testimonials before services.",
    };
    const withLie = withActionMemory(
      project,
      storeLastExecution(undefined, fake),
    );

    const result = await runAtlasBrain({
      project: withLie,
      request: "I don't see it.",
    });

    expect(result.explanation).not.toMatch(/What should lead the next pass/i);
    expect(result.explanation).not.toMatch(/Better visuals/i);
    expect(result.explanation).toMatch(/right|wasn'?t on the page/i);
    expect(result.applyStatus).toBe("applied");
    expect(
      isDesignSectionVisibleInProject(result.project, "testimonials"),
    ).toBe(true);
    const order = getEffectiveSectionOrder(result.project);
    expect(order.indexOf("testimonials")).toBeLessThan(
      order.indexOf("services"),
    );
  });

  it("does not invent success when verification fails", () => {
    const project = baseProject();
    const ops = validateEditOperations([
      {
        operation: "moveSection",
        section: "testimonials",
        position: "before",
        relativeTo: "services",
      },
    ]);
    const applied = applyEditOperations(project, ops);
    // Order may change, but visibility does not — verification must fail.
    const verified = verifyEditExecution(project, applied.project, ops);
    expect(
      isDesignSectionVisibleInProject(applied.project, "testimonials"),
    ).toBe(false);
    expect(verified.success).toBe(false);
    expect(applyStatusFromExecution(verified)).not.toBe("applied");
  });
});

describe("success messages require verification", () => {
  it("brain response for missing testimonials never says Moved without adding", async () => {
    const result = await runAtlasBrain({
      project: baseProject(),
      request: "Put testimonials above services.",
    });
    // Option A: insert then move — may say added, never bare false "Moved…" alone
    if (result.applyStatus === "applied") {
      expect(
        isDesignSectionVisibleInProject(result.project, "testimonials"),
      ).toBe(true);
    } else {
      expect(result.explanation).toMatch(/doesn'?t contain|can'?t move/i);
      expect(result.explanation).not.toMatch(/^Moved testimonials/i);
    }
  });
});
