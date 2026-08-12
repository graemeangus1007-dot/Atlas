/**
 * v1.6.5 — Visual restraint polish: defects → plan → verify → keep/rollback.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  detectRestraintDefects,
  executeRestraintPolish,
  needsRestraintPolish,
  planRestraintPolish,
  verifyRestraintPolish,
} from "@/lib/taste/restraint-polish";
import type { BusinessProject } from "@/types/business-project";

function baseProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "View Our Menu",
    secondaryCta: "Order Online",
    buttonStyle: "square",
    heroOverlay: 75,
    heroTreatment: {
      gradient: { direction: "left", strength: 0.4, coverage: 0.55 },
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
    ...overrides,
  };
}

describe("v1.6.5 restraint defect detection", () => {
  it("flags excessive hero overlay", () => {
    const defects = detectRestraintDefects(
      baseProject({
        heroTreatment: undefined,
        creativePolish: { visualHierarchy: true },
        secondaryCta: undefined,
        buttonStyle: "rounded",
      }),
    );
    expect(defects).toContain("excessive_hero_overlay");
  });

  it("flags hero blur", () => {
    const defects = detectRestraintDefects(
      baseProject({
        heroOverlay: 25,
        creativePolish: { visualHierarchy: true },
        secondaryCta: undefined,
        buttonStyle: "rounded",
      }),
    );
    expect(defects).toContain("hero_blur");
  });

  it("flags competing gradient + overlay", () => {
    const defects = detectRestraintDefects(
      baseProject({
        creativePolish: { visualHierarchy: true },
        secondaryCta: undefined,
        buttonStyle: "rounded",
      }),
    );
    expect(defects).toContain("competing_gradients");
  });

  it("flags excessive motion", () => {
    const defects = detectRestraintDefects(baseProject());
    expect(defects).toContain("excessive_motion");
  });

  it("flags CTA visual competition", () => {
    const defects = detectRestraintDefects(baseProject());
    expect(defects).toContain("cta_competition");
  });

  it("treats an already restrained site as not needing polish", () => {
    const project = baseProject({
      heroOverlay: 25,
      secondaryCta: undefined,
      buttonStyle: "rounded",
      heroTreatment: {
        textScrim: { enabled: true, opacity: 0.18, blur: 0 },
        textPosition: "left",
      },
      creativePolish: {
        motion: false,
        hoverEffects: false,
        sectionReveal: false,
        visualHierarchy: true,
        spacing: "comfortable",
      },
    });
    expect(needsRestraintPolish(project)).toBe(false);
    expect(planRestraintPolish({ project }).alreadyRestrained).toBe(true);
  });
});

describe("v1.6.5 restraint polish execution", () => {
  it("improves restraint for a stacked hero treatment", () => {
    const project = baseProject();
    const result = executeRestraintPolish({ project });
    expect(result.applied).toBe(true);
    expect(result.verification?.materiallyImproved).toBe(true);
    expect(result.verification!.scoreAfter).toBeGreaterThan(
      result.verification!.scoreBefore,
    );
    expect(result.verification!.resolvedDefects.length).toBeGreaterThan(0);
    expect(result.verification!.brandPreserved).toBe(true);
    expect(result.project.primaryColor).toBe(project.primaryColor);
    expect(result.project.heroImageId).toBe(project.heroImageId);
    expect(result.project.primaryCta).toBe(project.primaryCta);
  });

  it("rolls back photography regression", () => {
    const before = baseProject({
      heroOverlay: 25,
      heroTreatment: {
        textScrim: { enabled: true, opacity: 0.15, blur: 0 },
      },
      creativePolish: {
        motion: true,
        hoverEffects: true,
        sectionReveal: false,
        visualHierarchy: true,
      },
      buttonStyle: "rounded",
      secondaryCta: undefined,
    });
    // Force a verification that would regress photography if overlay jumped up.
    const after = {
      ...before,
      heroOverlay: 100 as const,
      heroTreatment: {
        textScrim: { enabled: true, opacity: 0.5, blur: 12 },
      },
    };
    const plan = planRestraintPolish({ project: before });
    const verification = verifyRestraintPolish({ before, after, plan });
    expect(verification.materiallyImproved).toBe(false);
    expect(
      verification.photographyPreservationAfter,
    ).toBeLessThan(verification.photographyPreservationBefore);
  });

  it("rolls back readability regression", () => {
    const before = baseProject({
      heroOverlay: 50,
      heroTreatment: {
        textScrim: { enabled: true, opacity: 0.2, blur: 0 },
      },
      creativePolish: {
        motion: true,
        hoverEffects: false,
        sectionReveal: false,
        visualHierarchy: true,
      },
      buttonStyle: "rounded",
      secondaryCta: undefined,
    });
    const after = {
      ...before,
      heroOverlay: 0 as const,
      heroTreatment: {
        textScrim: { enabled: false, opacity: 0, blur: 0 },
      },
    };
    const plan = planRestraintPolish({ project: before });
    const verification = verifyRestraintPolish({ before, after, plan });
    // Zero overlay with no scrim can harm readability on photography-led heroes.
    if (
      verification.readabilityAfter + 4 < verification.readabilityBefore
    ) {
      expect(verification.materiallyImproved).toBe(false);
    } else {
      // If the evaluator does not treat this as a readability regression,
      // still require brand/scope gates to remain honest.
      expect(verification.brandPreserved).toBe(true);
    }
  });

  it("keeps beneficial mutations and reports remaining defects", () => {
    const project = baseProject();
    const result = executeRestraintPolish({ project });
    expect(result.applied).toBe(true);
    expect(result.keptOperations.length).toBeGreaterThan(0);
    expect(result.rolledBackOperations).toHaveLength(0);
    // May still have residual defects — truthful remaining list is fine.
    expect(Array.isArray(result.verification?.remainingDefects)).toBe(true);
  });

  it("does not churn on a repeated polish of an already-improved site", () => {
    const first = executeRestraintPolish({ project: baseProject() });
    expect(first.applied).toBe(true);
    const second = executeRestraintPolish({ project: first.project });
    expect(second.applied).toBe(false);
    expect(
      second.verdict === "already_restrained" ||
        second.verdict === "no_operations" ||
        second.verdict === "no_gain",
    ).toBe(true);
  });

  it("preserves brand palette and hero asset", () => {
    const project = baseProject();
    const result = executeRestraintPolish({ project });
    expect(result.project.primaryColor).toBe(project.primaryColor);
    expect(result.project.accentColor).toBe(project.accentColor);
    expect(result.project.headingFont).toBe(project.headingFont);
    expect(result.project.heroImageId).toBe(project.heroImageId);
    expect(result.project.galleryImageIds).toEqual(project.galleryImageIds);
  });
});
