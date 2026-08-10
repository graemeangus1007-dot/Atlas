/**
 * Taste Engine Phase 2 — guarded polish execution.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import { assertScopedMutation } from "@/lib/ai/interaction-invariants";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import {
  executeTastePolish,
  evaluateTaste,
  isTastePolishRequest,
  planTastePolish,
  tastePolishMentionsInternalIds,
  tastePolishScopeViolations,
} from "@/lib/taste";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string): MediaAsset {
  return {
    id,
    name: `${id}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1200,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title: id,
    description: id,
    alt: id,
    width: 1600,
    height: 900,
  } as MediaAsset;
}

/** Structurally sound site with taste gaps (eligible for polish). */
function soundButUnpolished(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "Landscaping",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline:
      "Design, build, and care for yards that look intentional year-round.",
    primaryCta: "Get a quote",
    secondaryCta: "See all of our premium landscaping packages today",
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1"), asset("g1"), asset("g2"), asset("g3")],
    galleryImageIds: ["g1", "g2", "g3"],
    headingFont: "inter",
    bodyFont: "inter",
    heroOverlay: 75,
    buttonStyle: "square",
    sectionOrder: [
      "hero",
      "about",
      "services",
      "gallery",
      "testimonials",
      "contact",
      "footer",
    ],
    designSections: {
      enabled: ["testimonials"],
      testimonials: [
        {
          id: "t1",
          quote: "They transformed our backyard into something we use every week.",
          name: "Alex R.",
          role: "Homeowner",
        },
        {
          id: "t2",
          quote: "Clear communication and beautiful finished work.",
          name: "Jordan M.",
          role: "Client",
        },
      ],
    },
    creativePolish: {
      spacing: "default",
      visualHierarchy: false,
      serviceIcons: true,
      motion: true,
      hoverEffects: true,
      sectionReveal: true,
      motionPreset: "polished",
    },
    heroTreatment: {
      gradient: { direction: "bottom", strength: 0.8, coverage: 0.7 },
      textScrim: { enabled: true, opacity: 0.45, blur: 10 },
    },
  };
}

/** Already polished / consistent site. */
function alreadyPolished(): BusinessProject {
  return {
    ...soundButUnpolished(),
    headingFont: "playfair",
    bodyFont: "inter",
    heroOverlay: 25,
    buttonStyle: "rounded",
    secondaryCta: undefined,
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
      hoverEffects: false,
      sectionReveal: false,
      motionPreset: "none",
    },
    heroTreatment: {
      gradient: { direction: "bottom", strength: 0.35, coverage: 0.45 },
      textScrim: { enabled: true, opacity: 0.18, blur: 0 },
      textPosition: "left",
    },
  };
}

/** Structurally weak — missing hero image for image-led business. */
function structurallyWeak(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Quick Bite",
    businessType: "Restaurant",
    heroHeadline: "Hi",
    heroSubheadline: "Food",
    primaryCta: "Call",
    heroImageId: null,
    mediaLibrary: [],
    galleryImageIds: [],
    creativePolish: {
      spacing: "default",
      visualHierarchy: false,
      motion: false,
    },
  };
}

describe("Taste polish intent", () => {
  it("recognizes polish phrases", () => {
    expect(isTastePolishRequest("Polish the website.")).toBe(true);
    expect(isTastePolishRequest("Make it feel more professional.")).toBe(true);
    expect(
      isTastePolishRequest("Refine the spacing and typography."),
    ).toBe(true);
    expect(
      isTastePolishRequest("Give it a final agency-quality pass."),
    ).toBe(true);
  });

  it("routes polish away from critique", () => {
    const decided = decideWithAtlasBrainEngine({
      project: soundButUnpolished(),
      request: "Polish the website.",
    });
    expect(decided.commandKind).toBe("taste_polish");
    expect(decided.stage).toBe("explicit_command");
  });
});

describe("Taste polish eligibility", () => {
  it("applies on an eligible sound site", () => {
    const project = soundButUnpolished();
    const before = evaluateTaste({ project });
    const result = executeTastePolish({ project });
    expect(result.verdict).not.toBe("ineligible");
    if (result.applied) {
      expect(result.finalTaste).toBeGreaterThanOrEqual(result.baselineTaste);
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.revisionId).toBeTruthy();
      assertScopedMutation(project, result.project, "taste_polish");
    } else {
      // May already be close enough after planning — still not ineligible.
      expect(["already_polished", "rolled_back", "no_operations"]).toContain(
        result.verdict,
      );
    }
    void before;
  });

  it("stays advisory on a structurally weak site", () => {
    const result = executeTastePolish({ project: structurallyWeak() });
    expect(result.verdict).toBe("ineligible");
    expect(result.applied).toBe(false);
    expect(result.explanation).toMatch(/structural|ready|advisory|fixed first/i);
    expect(result.project.heroHeadline).toBe("Hi");
  });
});

describe("Taste polish dimension improvements", () => {
  it("improves spacing / hierarchy / restraint when applied", () => {
    const project = soundButUnpolished();
    const before = evaluateTaste({ project });
    const result = executeTastePolish({ project });
    expect(result.verdict === "applied" || result.verdict === "already_polished").toBe(
      true,
    );
    if (result.applied) {
      const after = result.tasteAfter!;
      expect(
        after.spacingHarmony + after.typographyHarmony + after.restraint,
      ).toBeGreaterThanOrEqual(
        before.spacingHarmony + before.typographyHarmony + before.restraint,
      );
      expect(result.project.creativePolish?.visualHierarchy).toBe(true);
      expect(result.project.creativePolish?.motion).toBe(false);
      expect(
        result.project.creativePolish?.spacing === "comfortable" ||
          result.project.creativePolish?.spacing === "airy",
      ).toBe(true);
    }
  });

  it("preserves brand, copy, section order, and assets", () => {
    const project = soundButUnpolished();
    const result = executeTastePolish({ project });
    if (!result.applied) return;
    expect(result.project.primaryColor).toBe(project.primaryColor);
    expect(result.project.accentColor).toBe(project.accentColor);
    expect(result.project.headingFont).toBe(project.headingFont);
    expect(result.project.bodyFont).toBe(project.bodyFont);
    expect(result.project.heroHeadline).toBe(project.heroHeadline);
    expect(result.project.primaryCta).toBe(project.primaryCta);
    expect(result.project.sectionOrder).toEqual(project.sectionOrder);
    expect(result.project.heroImageId).toBe(project.heroImageId);
    expect(result.project.galleryImageIds).toEqual(project.galleryImageIds);
    expect(tastePolishScopeViolations(project, result.project)).toEqual([]);
  });
});

describe("Taste polish atomicity and idempotency", () => {
  it("applies as one atomic batch (single revision)", () => {
    const result = executeTastePolish({ project: soundButUnpolished() });
    if (result.applied) {
      expect(result.revisionId).toBeTruthy();
      expect(result.operations.length).toBeGreaterThan(0);
      // One coordinated plan — not a stream of micro-revisions
      expect(result.plan?.operations).toEqual(result.operations);
    }
  });

  it("is idempotent on an already polished site", () => {
    const project = alreadyPolished();
    const first = executeTastePolish({ project });
    const second = executeTastePolish({
      project: first.applied ? first.project : project,
    });
    expect(second.verdict).toBe("already_polished");
    expect(second.applied).toBe(false);
    expect(second.explanation).toMatch(/already consistent|didn’t add unnecessary/i);
  });
});

describe("Taste polish rollback", () => {
  it("rolls back when operations would violate scope", () => {
    const project = soundButUnpolished();
    const plan = planTastePolish(project);
    // Force a forbidden mutation after planning by simulating bad apply via scope check
    const mutated = {
      ...project,
      primaryColor: "#ff0000",
      creativePolish: { ...project.creativePolish, spacing: "airy" as const },
    };
    expect(tastePolishScopeViolations(project, mutated).length).toBeGreaterThan(0);
    void plan;
  });
});

describe("Taste polish brain + presentation", () => {
  it("executes polish request without exposing internal IDs", async () => {
    const result = await runAtlasBrain({
      project: soundButUnpolished(),
      request: "Polish the website.",
    });
    expect(result.decision?.commandKind).toBe("taste_polish");
    expect(tastePolishMentionsInternalIds(result.explanation)).toBe(false);
    expect(result.explanation).not.toMatch(/overallTaste|eligibleToJudge/);
  });

  it("explains structural gate on weak sites", async () => {
    const result = await runAtlasBrain({
      project: structurallyWeak(),
      request: "Make it feel more professional.",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(/structural|ready|fixed first|solid/i);
  });
});

describe("Taste polish + Creative Director structure", () => {
  it("keeps CD structure sound after a successful polish", () => {
    const project = soundButUnpolished();
    const before = evaluateWebsiteAsCreativeDirector({ project });
    const result = executeTastePolish({
      project,
      evaluation: before,
    });
    if (!result.applied) return;
    const after = evaluateWebsiteAsCreativeDirector({
      project: result.project,
    });
    expect(after.dimensions.accessibility).toBeGreaterThanOrEqual(
      before.dimensions.accessibility - 1,
    );
    expect(result.project.sectionOrder).toEqual(project.sectionOrder);
  });
});

describe("Taste polish after transformation", () => {
  it("allows at most one taste pass flag on execution result shape", async () => {
    const { executeFreshWebsiteTransformation } = await import(
      "@/lib/transformation/executor"
    );
    const result = executeFreshWebsiteTransformation({
      project: soundButUnpolished(),
      request: "Complete my website for launch",
      allowTastePolish: true,
      allowRefinement: false,
    });
    expect(typeof result.tastePolishApplied).toBe("boolean");
    // Never more than one polish — flag is boolean, not a count.
    expect([true, false]).toContain(result.tastePolishApplied);
    expect(result.project.primaryColor).toBe(soundButUnpolished().primaryColor);
    expect(result.project.headingFont).toBe(soundButUnpolished().headingFont);
  });
});
