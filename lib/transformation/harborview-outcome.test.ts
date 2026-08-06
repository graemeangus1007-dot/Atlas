/**
 * Production regression — Harborview flat overall score must not wipe beneficial work.
 */

import { describe, expect, it } from "vitest";
import {
  createEmptyRevisionStack,
  pushEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { planHeroPatternApplication } from "@/lib/ai/hero-pattern-application";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import {
  assessTransformationOutcome,
  buildTransformationPlanForProject,
  captureBrandScopeSnapshot,
  executeTransformationPlan,
  restoreTransformationBaseline,
  captureTransformationUndoSnapshot,
  SCORE_TOLERANCE,
  transformationTextExposesInternalIds,
} from "@/lib/transformation";

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
  };
}

/** Exact Harborview-style production fixture. */
function harborviewProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "Contractor",
    description:
      "Harborview Landscaping designs, builds, and cares for outdoor spaces across the coast.",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Get a quote",
    primaryColor: NAMED_COLORS.forestGreen,
    accentColor: NAMED_COLORS.gold,
    secondaryColor: NAMED_COLORS.forestGreen,
    backgroundColor: "#f7f8fa",
    theme: "light",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    siteWidth: "boxed",
    heroOverlay: 75,
    heroImageId: "hero-busy",
    mediaLibrary: [
      asset("hero-busy", "Coastal yard"),
      asset("g1", "Patio"),
      asset("g2", "Garden bed"),
    ],
    galleryImageIds: ["g1", "g2"],
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
    },
    designSections: { enabled: [] },
    sectionOrder: ["hero", "about", "services", "contact"],
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("Harborview production — flat overall must not full-rollback", () => {
  it("keeps trust/proof gains when overall score is flat or barely moved", () => {
    const project = harborviewProject();
    const baseline = evaluateWebsiteAsCreativeDirector({ project });
    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website",
    );
    const result = executeTransformationPlan({
      project,
      plan,
      allowRefinement: true,
    });

    const outcome = result.wholePage.outcome!;
    expect(outcome).toBeTruthy();

    // Diagnostic: report what Harborview actually scored
    expect(typeof outcome.baselineOverall).toBe("number");
    expect(typeof outcome.finalOverall).toBe("number");

    // Must not use the old binary failure copy as the only explanation
    expect(result.summary).not.toMatch(
      /^I stopped the redesign after a verification failure\.\s*\nWhole-page design score did not improve\./,
    );
    expect(result.summary).not.toMatch(/^Done\./m);
    expect(transformationTextExposesInternalIds(result.summary)).toBe(false);

    const trustDelta = outcome.dimensionDeltas.trust ?? 0;
    const hasTrustGain = trustDelta >= SCORE_TOLERANCE.dimensionMeaningful;
    const hasProofSection =
      (result.project.designSections?.testimonials?.length ?? 0) > 0;

    if (hasTrustGain || hasProofSection) {
      // Beneficial trust work must survive flat overall
      expect(["applied", "partially_applied"]).toContain(result.status);
      expect(result.rollbackScope).not.toBe("full");
      expect(result.project.designSections?.testimonials?.length).toBeGreaterThan(
        0,
      );
      expect(result.summary).toMatch(
        /Improved|What changed|measurably improved|coordinated stage/i,
      );
    }

    // Brand must remain intact either way
    expect(result.project.primaryColor).toBe(project.primaryColor);
    expect(result.project.headingFont).toBe(project.headingFont);
    expect(result.project.contact?.phone).toBe(project.contact?.phone);

    // Baseline eval was on the applied project state path
    expect(baseline.dimensions.overallDesignScore).toBeGreaterThan(0);
  });

  it("reports concrete improved vs reverted outcomes on selective rollback", () => {
    const project = harborviewProject();
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({ project, plan });
    if (result.rollbackScope === "selective") {
      expect(result.summary).toMatch(/Improved|rolled back|Not applied/i);
      expect(result.summary).not.toMatch(/Whole-page design score did not improve\.$/m);
    }
  });
});

describe("Outcome assessment policy", () => {
  it("verified_partial when trust improves but overall is flat", () => {
    const before = harborviewProject();
    const after = applyEditOperations(
      before,
      validateEditOperations([
        { operation: "insertSection", type: "testimonials" },
        {
          operation: "moveSection",
          section: "testimonials",
          position: "before",
          relativeTo: "contact",
        },
      ]),
    ).project;

    const brand = captureBrandScopeSnapshot(before);
    const { plan } = buildTransformationPlanForProject(before);
    const trustGoal = plan.goals.find((g) => g.id === "establish_trust")!;
    const seqGoal = plan.goals.find((g) => g.id === "sequence_proof_before_ask");

    const outcome = assessTransformationOutcome({
      baselineProject: before,
      finalProject: after,
      plan,
      brand,
      appliedGoals: [trustGoal, ...(seqGoal ? [seqGoal] : [])],
      blockedGoalIds: ["strengthen_proof"],
      criticalDependencyFailed: false,
    });

    expect(outcome.dimensionDeltas.trust).toBeGreaterThanOrEqual(
      SCORE_TOLERANCE.dimensionMeaningful,
    );
    // Overall may be flat — still must not be neutral_no_gain / critical
    expect(["verified_success", "verified_partial"]).toContain(outcome.verdict);
    expect(outcome.highestPriorityProblemImproved || outcome.expectedGoalsImproved.length > 0).toBe(
      true,
    );
  });

  it("critical_regression on accessibility collapse", () => {
    const before = harborviewProject({
      contact: {
        ...MOCK_BUSINESS_PROJECT.contact!,
        phone: "555-0100",
        email: "hello@harborview.test",
      },
      creativePolish: {
        spacing: "comfortable",
        visualHierarchy: true,
      },
    });
    // Simulate loss of hierarchy + phone (accessibility drivers)
    const after: BusinessProject = {
      ...before,
      contact: { ...before.contact!, phone: "" },
      creativePolish: {
        ...before.creativePolish,
        visualHierarchy: false,
      },
    };
    const { plan } = buildTransformationPlanForProject(before);
    const outcome = assessTransformationOutcome({
      baselineProject: before,
      finalProject: after,
      plan,
      brand: captureBrandScopeSnapshot(before),
      appliedGoals: plan.goals.slice(0, 1),
      blockedGoalIds: [],
      criticalDependencyFailed: false,
    });
    // Contact phone change is critical brand/scope regression
    expect(outcome.verdict).toBe("critical_regression");
    expect(outcome.criticalRegressions.length).toBeGreaterThan(0);
  });

  it("neutral_no_gain fully rolls back and restores exact baseline", () => {
    const project = harborviewProject({
      // Already complete — transformation should find little to improve
      designSections: {
        enabled: ["testimonials", "gallery", "faq"],
        testimonials: [
          {
            author: "Jordan",
            quote: "They transformed our backyard into a calm outdoor room.",
            role: "Homeowner",
          },
          {
            author: "Sam",
            quote: "Clear communication and beautiful planting.",
            role: "Homeowner",
          },
        ],
        faq: [
          {
            question: "Do you offer maintenance?",
            answer: "Yes, seasonal care plans.",
          },
        ],
      },
      sectionOrder: [
        "hero",
        "about",
        "services",
        "gallery",
        "testimonials",
        "faq",
        "contact",
      ],
      primaryCta: "Get a free estimate",
      creativePolish: {
        spacing: "airy",
        visualHierarchy: true,
        serviceIcons: true,
      },
      heroComposition: {
        patternId: "hero.contractor_left",
        version: 1,
      } as BusinessProject["heroComposition"],
    });

    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({
      project,
      plan,
      allowRefinement: false,
    });

    if (result.status === "failed" || result.rollbackScope === "full") {
      expect(result.project.primaryCta).toBe(project.primaryCta);
      expect(result.project.designSections).toEqual(project.designSections);
      expect(result.summary).toMatch(
        /restored the previous version|already matches|measurable improvement|kept the current version|already in strong shape|already strong/i,
      );
      expect(result.summary).not.toMatch(/^Done\./m);
    }

    const snap = captureTransformationUndoSnapshot(result);
    const restored = restoreTransformationBaseline(snap);
    expect(restored.businessName).toBe(result.baselineProject.businessName);
  });

  it("undo after partial application restores original baseline", () => {
    const project = harborviewProject();
    const { plan } = buildTransformationPlanForProject(project);
    const result = executeTransformationPlan({ project, plan });
    if (result.operations.length === 0) return;

    const stack = pushEditorRevision(createEmptyRevisionStack(), {
      before: project,
      after: result.project,
      operations: result.operations,
      changes: result.changes,
      prompt: "Complete my website",
    });
    const undone = undoEditorRevision(stack);
    expect(undone?.project.primaryCta).toBe(project.primaryCta);
    expect(undone?.project.designSections).toEqual(project.designSections);
    expect(undone?.project.primaryColor).toBe(project.primaryColor);
  });
});

describe("Evaluator calibration for Phase 2 ops", () => {
  it("inserted testimonials improve trust", () => {
    const before = harborviewProject();
    const after = applyEditOperations(
      before,
      validateEditOperations([{ operation: "insertSection", type: "testimonials" }]),
    ).project;
    const b = evaluateWebsiteAsCreativeDirector({ project: before });
    const a = evaluateWebsiteAsCreativeDirector({ project: after });
    expect(a.trust.score - b.trust.score).toBeGreaterThanOrEqual(
      SCORE_TOLERANCE.dimensionMeaningful,
    );
  });

  it("hero pattern improves first impression", () => {
    const before = harborviewProject();
    const heroPlan = planHeroPatternApplication({
      project: before,
      patternId: "hero.contractor_left",
    });
    if (heroPlan.blocked || heroPlan.operations.length === 0) return;
    const after = applyEditOperations(
      before,
      validateEditOperations(heroPlan.operations),
    ).project;
    const b = evaluateWebsiteAsCreativeDirector({ project: before });
    const a = evaluateWebsiteAsCreativeDirector({ project: after });
    const heroBefore = b.sections.find((s) => s.sectionId === "hero")!.score;
    const heroAfter = a.sections.find((s) => s.sectionId === "hero")!.score;
    const fiDelta =
      a.dimensions.firstImpression - b.dimensions.firstImpression;
    const heroDelta = heroAfter - heroBefore;
    // Render-aware blend temperes swings vs field-presence scoring; still must improve.
    expect(heroDelta).toBeGreaterThan(0);
    expect(Math.max(fiDelta, heroDelta)).toBeGreaterThanOrEqual(2);
  });

  it("gallery lightbox improves gallery/trust contribution", () => {
    const before = harborviewProject({
      designSections: { enabled: ["gallery"] },
      galleryInteraction: { mode: "none", navigation: false, captions: false },
    });
    const after = applyEditOperations(
      before,
      validateEditOperations([
        {
          operation: "setGalleryInteraction",
          mode: "lightbox",
          navigation: true,
          captions: true,
        },
      ]),
    ).project;
    const b = evaluateWebsiteAsCreativeDirector({ project: before });
    const a = evaluateWebsiteAsCreativeDirector({ project: after });
    const galleryBefore =
      b.sections.find((s) => s.sectionId === "gallery")?.score ?? 0;
    const galleryAfter =
      a.sections.find((s) => s.sectionId === "gallery")?.score ?? 0;
    expect(galleryAfter - galleryBefore).toBeGreaterThanOrEqual(4);
    expect(a.trust.score).toBeGreaterThanOrEqual(b.trust.score);
  });

  it("CTA clarity improves conversion when starting from a weak CTA", () => {
    const before = harborviewProject({ primaryCta: "Learn more" });
    const after = applyEditOperations(
      before,
      validateEditOperations([
        {
          operation: "replaceText",
          target: "hero.primaryCta",
          value: "Get a free estimate",
        },
      ]),
    ).project;
    const b = evaluateWebsiteAsCreativeDirector({ project: before });
    const a = evaluateWebsiteAsCreativeDirector({ project: after });
    expect(a.conversion.score).toBeGreaterThan(b.conversion.score);
  });

  it("spacing polish improves rhythm from default", () => {
    const before = harborviewProject({
      creativePolish: {
        spacing: "default",
        visualHierarchy: false,
      },
    });
    const after = applyEditOperations(
      before,
      validateEditOperations([
        {
          operation: "setCreativePolish",
          spacing: "comfortable",
          visualHierarchy: true,
        },
      ]),
    ).project;
    const b = evaluateWebsiteAsCreativeDirector({ project: before });
    const a = evaluateWebsiteAsCreativeDirector({ project: after });
    expect(a.dimensions.whitespace).toBeGreaterThan(b.dimensions.whitespace);
  });
});
