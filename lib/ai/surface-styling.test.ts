import { describe, expect, it } from "vitest";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import {
  clearPendingClarification,
  getActionMemory,
  matchClarificationAnswer,
  storePendingClarification,
} from "@/lib/ai/atlas-action-memory";
import { setInteractionState } from "@/lib/ai/interaction-state";
import { tryRunAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideAtlasBrain } from "@/lib/ai/atlas-brain-routing";
import { meetsWcagAa } from "@/lib/ai/contrast";
import { captureBrandPalette } from "@/lib/ai/hero-readability";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import {
  isSurfaceStyleRequest,
  LIGHT_GREEN_SURFACE,
  LIGHT_GREEN_TEXT,
  planSurfaceStyleOperations,
} from "@/lib/ai/surface-styling";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

function goldProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    primaryColor: NAMED_COLORS.green,
    accentColor: NAMED_COLORS.gold,
    secondaryColor: NAMED_COLORS.forestGreen,
    backgroundColor: "#07090d",
    theme: "dark",
    componentSurfaces: undefined,
  };
}

describe("surface styling — text boxes", () => {
  it("detects text-box requests as surface styling", () => {
    expect(
      isSurfaceStyleRequest("Make all of the text boxes a light green."),
    ).toBe(true);
  });

  it("plans setComponentSurface and never changeTheme", () => {
    const planned = planSurfaceStyleOperations({
      request: "Make all of the text boxes a light green.",
      project: goldProject(),
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.preserveBrandPalette).toBe(true);
    expect(planned.operations).toEqual([
      expect.objectContaining({
        operation: "setComponentSurface",
        target: "form_fields",
        backgroundColor: LIGHT_GREEN_SURFACE,
      }),
    ]);
    expect(
      planned.operations.some((op) => op.operation === "changeTheme"),
    ).toBe(false);
  });

  it("keeps gold accent when applying light-green form fields", async () => {
    const before = goldProject();
    const result = await tryRunAtlasBrain({
      project: before,
      request: "Make all of the text boxes a light green.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applyStatus).toBe("applied");
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(result.project.primaryColor).toBe(before.primaryColor);
    expect(
      result.project.componentSurfaces?.formFields?.backgroundColor,
    ).toBe(LIGHT_GREEN_SURFACE);
    expect(
      result.operations.some((op) => op.operation === "changeTheme"),
    ).toBe(false);
    expect(result.explanation).not.toMatch(/theme colors/i);
    expect(result.explanation).toMatch(/form fields|light green/i);
  });

  it("routes surface_style instead of branding", () => {
    const decision = decideAtlasBrain({
      project: goldProject(),
      request: "Make all of the text boxes a light green.",
    });
    expect(decision.commandKind).toBe("surface_style");
    expect(decision.explanation).not.toMatch(/theme colors now/i);
  });

  it("asks a precise question when text boxes and panels are both plausible", () => {
    const planned = planSurfaceStyleOperations({
      request: "Make the text boxes and text panels light green.",
      project: goldProject(),
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.needsClarification).toBe(true);
    expect(planned.explanation).toMatch(/contact-form fields|text panels/i);
    expect(planned.explanation).not.toMatch(/Better visuals|conversions/i);
  });

  it("styles text panels when asked", () => {
    const planned = planSurfaceStyleOperations({
      request: "Make the text panels light green.",
      project: goldProject(),
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.operations[0]).toEqual(
      expect.objectContaining({
        operation: "setComponentSurface",
        target: "text_panels",
      }),
    );
  });

  it("keeps readable contrast on light green fields", () => {
    expect(meetsWcagAa(LIGHT_GREEN_TEXT, LIGHT_GREEN_SURFACE)).toBe(true);
    const applied = applyEditOperations(goldProject(), [
      {
        operation: "setComponentSurface",
        target: "form_fields",
        backgroundColor: LIGHT_GREEN_SURFACE,
        textColor: LIGHT_GREEN_TEXT,
      },
    ]);
    const style = buildSiteDesignStyle(applied.project);
    expect(style["--site-form-field-bg"]).toBe(LIGHT_GREEN_SURFACE);
    expect(style["--site-accent"]).toBe(NAMED_COLORS.gold);
    const css = buildStaticSiteCss(applied.project);
    expect(css).toContain(LIGHT_GREEN_SURFACE);
    expect(css).toContain("--site-form-field-bg");
  });
});

describe("brand regression + color clarification", () => {
  it("restores paletteBefore when gold is wiped", async () => {
    const before = goldProject();
    const paletteBefore = captureBrandPalette(before);
    const wiped = {
      ...before,
      accentColor: "#0d9488",
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        lastExecution: {
          request: "Make all of the text boxes a light green.",
          at: new Date().toISOString(),
          success: true,
          verified: true,
          operationTypes: ["changeTheme"],
          operations: [
            {
              operation: "changeTheme" as const,
              primary: "#0f766e",
              accent: "#0d9488",
            },
          ],
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: ["accentColor"],
          explanation: "Updated theme colors",
          paletteBefore,
          scope: "global" as const,
        },
        // Keep prior local surface styling so repair can preserve it.
      },
      componentSurfaces: {
        formFields: {
          backgroundColor: LIGHT_GREEN_SURFACE,
          textColor: LIGHT_GREEN_TEXT,
        },
      },
    };

    const result = await tryRunAtlasBrain({
      project: wiped,
      request: "Why did you get rid of the gold?",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(
      result.project.componentSurfaces?.formFields?.backgroundColor,
    ).toBe(LIGHT_GREEN_SURFACE);
    expect(result.explanation).toMatch(/restored/i);
    expect(result.explanation).not.toMatch(/Better visuals/i);
  });

  it("stores typed color clarification when paletteBefore is missing", async () => {
    const wiped = {
      ...goldProject(),
      accentColor: "#0d9488",
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        lastExecution: {
          request: "Make all of the text boxes a light green.",
          at: new Date().toISOString(),
          success: true,
          verified: true,
          operationTypes: ["changeTheme"],
          operations: [{ operation: "changeTheme" as const, accent: "#0d9488" }],
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: ["accentColor"],
          explanation: "Updated theme",
          paletteBefore: null,
        },
      },
    };

    const asked = await tryRunAtlasBrain({
      project: wiped,
      request: "Why did you get rid of the gold?",
    });
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.applyStatus).toBe("needs_clarification");
    const pending = getActionMemory(asked.project).pendingClarification;
    expect(pending?.kind).toBe("color");
    expect(pending?.destination).toBe("restore_accent");

    const matched = matchClarificationAnswer("gold", pending!);
    expect(matched?.resolvedColor).toBe(NAMED_COLORS.gold);

    const resolved = await tryRunAtlasBrain({
      project: asked.project,
      request: "gold",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.applyStatus).toBe("applied");
    expect(resolved.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(getActionMemory(resolved.project).pendingClarification).toBeFalsy();
    expect(resolved.explanation).not.toMatch(/Better visuals|What should lead/i);
  });

  it("does not restart generic clarification for a color answer", () => {
    const memory = storePendingClarification(null, {
      question: "Tell me the accent you’d like restored",
      kind: "color",
      destination: "restore_accent",
      allowedAnswers: ["gold", "green"],
    });
    const matched = matchClarificationAnswer("gold", memory.pendingClarification!);
    expect(matched?.answer).toBe("gold");
    expect(matched?.destination).toBe("restore_accent");
    const cleared = clearPendingClarification(memory);
    expect(cleared.pendingClarification).toBeNull();
    const project = setInteractionState(goldProject(), memory);
    expect(getActionMemory(project).pendingClarification?.kind).toBe("color");
  });
});

describe("surface styling with active critique plan", () => {
  it("still applies local surface style while recommendations are pending", async () => {
    const project: BusinessProject = {
      ...goldProject(),
      atlasActionMemory: {
        updatedAt: new Date().toISOString(),
        applyAllPending: true,
        recommendations: [
          {
            id: "rec.1",
            source: "design_critique",
            title: "Improve hierarchy",
            kind: "visual",
            applyable: true,
            operations: [],
          },
        ],
        recommendationIds: ["rec.1"],
      },
    };
    const result = await tryRunAtlasBrain({
      project,
      request: "Make all of the text boxes a light green.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.applyStatus).toBe("applied");
    expect(result.project.accentColor).toBe(NAMED_COLORS.gold);
    expect(
      result.project.componentSurfaces?.formFields?.backgroundColor,
    ).toBe(LIGHT_GREEN_SURFACE);
  });
});
