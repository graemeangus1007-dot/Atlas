/**
 * v1.6.6 — Production execution truth: Brain → persist → render contract.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  parseCritiqueMessage,
  splitFocusSection,
  toExecutiveSummary,
} from "@/lib/ai/critique-message-presentation";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import { resolveAdaptiveBrandPresentation } from "@/lib/brand-presentation";
import {
  assertCompletionReceiptInvariants,
  buildCompletionExecutionReceipt,
  resolvePresentationRenderContract,
  roundTripProject,
} from "@/lib/strategy/completion-receipt";
import { assessStrategicPriorities } from "@/lib/strategy";
import {
  buildTransformationPlanForProject,
  executeTransformationPlan,
} from "@/lib/transformation";
import type { BusinessProject } from "@/types/business-project";

function riverviewProductionFixture(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "View Our Menu",
    secondaryCta: "Order Online",
    buttonStyle: "square",
    heroOverlay: 75,
    // Persisted composition WITHOUT patternId — previous live-sync hole.
    heroComposition: {
      patternId: null,
      version: "1.0.0",
      layout: "overlay",
      legacyLayoutKey: "overlay",
      minHeight: "tall",
      contentAlignment: "left",
      verticalAlignment: "center",
      contentWidth: "medium",
      image: {
        fit: "cover",
        position: "center",
        zoom: 1,
        focalPoint: { x: 0.5, y: 0.5 },
      },
      treatment: {
        overlay: 75,
        gradient: { direction: "left", strength: 0.42, coverage: 0.55 },
        textScrim: { enabled: true, opacity: 0.35, blur: 8 },
      },
      typography: {
        headingScale: "lg",
        headingWeight: 600,
        showSecondaryCta: true,
      },
      accents: { showAccentWash: false, showGrid: false },
      cta: { alignment: "left", style: "default" },
      mobile: { layout: "stack", contentAlignment: "left" },
    },
    heroTreatment: {
      gradient: { direction: "left", strength: 0.42, coverage: 0.55 },
      textScrim: { enabled: true, opacity: 0.35, blur: 8 },
      textPosition: "left",
    },
    creativePolish: {
      motion: true,
      hoverEffects: true,
      sectionReveal: true,
      visualHierarchy: false,
      spacing: "default",
    },
    atlasActionMemory: undefined,
    designSections: {
      enabled: ["testimonials", "gallery", "faq"],
      testimonials: [
        {
          id: "t1",
          quote: "Best bakery in town.",
          author: "Alex",
          role: "Regular",
        },
        {
          id: "t2",
          quote: "Incredible pastries.",
          author: "Sam",
          role: "Neighbor",
        },
      ],
      faq: [{ id: "f1", question: "Hours?", answer: "7am–3pm." }],
    },
  };
}

describe("v1.6.6 focus list presentation truth", () => {
  it("never produces What I'll focus on 1. via executive summary", () => {
    const body = [
      "The highest priority is simplifying the visual treatment so the page feels more polished and focused.",
      "I’ll start with the hero, then refine any remaining competing effects while preserving the current brand and photography.",
      "",
      "What I’ll focus on",
      "1. Make the design feel more focused",
      "2. Preserve clear text and photography",
    ].join("\n");

    const { prose, focusItems } = splitFocusSection(body);
    expect(focusItems).toEqual([
      "Make the design feel more focused",
      "Preserve clear text and photography",
    ]);
    const summary = toExecutiveSummary(prose);
    expect(summary).not.toMatch(/focus on\s*1\./i);
    expect(summary).not.toMatch(/What I.ll focus on 1\./i);

    const parsed = parseCritiqueMessage(body);
    expect(parsed.focusItems?.length).toBeGreaterThan(0);
    expect(parsed.executiveSummary).not.toMatch(/focus on\s*1\./i);
  });

  it("drops incomplete bare numbered focus items", () => {
    const { focusItems } = splitFocusSection(
      "Preface.\n\nWhat I’ll focus on\n1.\n",
    );
    expect(focusItems).toHaveLength(0);
  });
});

describe("v1.6.6 authoritative render path", () => {
  it("live overlay/treatment sync without patternId", () => {
    const project = riverviewProductionFixture();
    project.heroOverlay = 25;
    project.heroTreatment = {
      ...project.heroTreatment,
      textScrim: { enabled: true, opacity: 0.2, blur: 0 },
    };
    const composition = resolveHeroCompositionFromProject(project);
    expect(composition.treatment.overlay).toBe(25);
    expect(composition.treatment.textScrim?.blur).toBe(0);
  });

  it("adaptive presentation does not reintroduce blur after restraint", () => {
    const project = riverviewProductionFixture();
    project.heroOverlay = 25;
    project.heroTreatment = {
      gradient: null,
      textScrim: { enabled: true, opacity: 0.26, blur: 0 },
      textPosition: "left",
    };
    // Keep composition in sync with live fields.
    project.heroComposition = {
      ...project.heroComposition!,
      treatment: {
        overlay: 25,
        gradient: null,
        textScrim: { enabled: true, opacity: 0.26, blur: 0 },
      },
    };
    const presentation = resolveAdaptiveBrandPresentation(project).presentation;
    expect(presentation.heroScrim.blur).toBe(0);
    const style = buildSiteDesignStyle(project) as Record<string, string>;
    expect(style["--site-hero-scrim-blur"]).toBe("0px");
  });
});

describe("v1.6.6 Riverview Complete → render truth", () => {
  it("proves claimed visual change survives Brain → reload → render", async () => {
    const before = riverviewProductionFixture();
    const beforeContract = resolvePresentationRenderContract(before);

    expect(before.heroOverlay).toBe(75);
    expect(before.heroTreatment?.textScrim?.blur).toBe(8);
    expect(before.creativePolish?.motion).toBe(true);

    const { plan } = buildTransformationPlanForProject(
      before,
      "Complete my website for launch",
    );
    expect(plan.goals.some((g) => g.id === "clarify_visual_restraint")).toBe(
      true,
    );

    const complete = await runAtlasBrain({
      project: before,
      request: "Complete my website",
    });

    expect(complete.explanation).not.toMatch(/What I.ll focus on\s*1\.\s*$/m);
    expect(complete.explanation).not.toMatch(/What I.ll focus on • 1\./);

    const parsed = parseCritiqueMessage(complete.explanation);
    if ((parsed.focusItems?.length ?? 0) > 0) {
      expect(parsed.focusItems!.every((t) => t.trim().length > 0)).toBe(true);
    }
    expect(parsed.executiveSummary).not.toMatch(/focus on\s*1\.\s*$/i);

    const tx = executeTransformationPlan({
      project: before,
      plan,
      allowTastePolish: true,
    });
    const receipt = buildCompletionExecutionReceipt({
      requestId: "riverview-e2e",
      before,
      after: complete.project,
      tx: {
        ...tx,
        project: complete.project,
        operations: complete.operations,
        status:
          complete.applyStatus === "applied" ? "applied" : tx.status,
      },
      strategicPriorityBefore:
        assessStrategicPriorities({ project: before }).highestPriorityOpportunity
          ?.title ?? "none",
      strategicPriorityAfter:
        assessStrategicPriorities({ project: complete.project })
          .highestPriorityOpportunity?.title ?? null,
    });

    // Developer report fields
    console.info("[atlas:v1.6.6:riverview-receipt]", {
      outcome: receipt.outcome,
      planned: receipt.plannedOperations.map((o) => ({
        op: o.operation,
        target: o.target,
        before: o.before,
        intended: o.intendedAfter,
      })),
      executed: receipt.executedOperations,
      rendered: receipt.renderedState,
      beforeContract,
      afterContract: resolvePresentationRenderContract(complete.project),
    });

    if (complete.applyStatus === "applied") {
      expect(receipt.outcome).toMatch(/verified_change|verified_partial/);
      expect(receipt.executedOperations.some((o) => o.changed)).toBe(true);
      expect(receipt.persisted).toBe(true);
      expect(receipt.renderedState.editorMatchesProject).toBe(true);

      const reloaded = roundTripProject(complete.project);
      const reloadContract = resolvePresentationRenderContract(reloaded);
      const afterContract = resolvePresentationRenderContract(complete.project);

      expect(reloaded.heroOverlay).toBe(complete.project.heroOverlay);
      expect(reloaded.heroTreatment?.textScrim?.blur).toBe(
        complete.project.heroTreatment?.textScrim?.blur,
      );
      expect(reloadContract.overlay).toBe(afterContract.overlay);
      expect(reloadContract.blur).toBe(afterContract.blur);
      expect(reloadContract.motion).toBe(afterContract.motion);

      // Visible difference vs baseline paint contract.
      expect(
        afterContract.overlay !== beforeContract.overlay ||
          afterContract.blur !== beforeContract.blur ||
          afterContract.motion !== beforeContract.motion ||
          afterContract.buttonStyle !== beforeContract.buttonStyle,
      ).toBe(true);

      // No render override of zeroed blur.
      if ((complete.project.heroTreatment?.textScrim?.blur ?? 0) === 0) {
        expect(afterContract.blur).toBe(0);
      }

      expect(
        assertCompletionReceiptInvariants(receipt, true),
      ).toEqual([]);

      const weakness = await runAtlasBrain({
        project: complete.project,
        request: "What's the biggest weakness?",
      });
      expect(weakness.explanation.length).toBeGreaterThan(20);
    } else {
      // Truthful non-success — must not imply the site was improved.
      expect(complete.explanation).toMatch(
        /kept|restored|didn.?t|already|couldn.?t verify|intended values/i,
      );
      expect(complete.explanation).not.toMatch(
        /updated version is now applied/i,
      );
      expect(
        assertCompletionReceiptInvariants(receipt, false),
      ).toEqual([]);
      // Project truth unchanged for failed visual claim.
      expect(complete.project.heroOverlay).toBe(before.heroOverlay);
    }
  });
});
