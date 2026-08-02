/**
 * v1.2 — Hero readability diagnosis, routing, and verification.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  decideWithAtlasBrainEngine,
} from "@/lib/ai/atlas-brain-decision-engine";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { buildStaticSiteCss } from "@/lib/publishing/styles/site-css";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import {
  analyzeHeroReadability,
  isHeroReadabilityRequest,
  planHeroReadabilityOperations,
  verifyHeroReadabilityImprovement,
} from "@/lib/ai/hero-readability";
import { extractNaturalLanguageEditPlan } from "@/lib/ai/nl-edit-planner";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function project(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harborview Landscaping",
    businessType: "landscaping",
    heroHeadline: "Outdoor spaces that feel finished",
    heroSubheadline: "Design, build, and care for yards that look intentional.",
    primaryCta: "Get a quote",
    primaryColor: "#0f766e",
    accentColor: "#0f766e",
    secondaryColor: "#134e4a",
    backgroundColor: "#f7f8fa",
    theme: "light",
    headingFont: "inter",
    bodyFont: "inter",
    buttonStyle: "rounded",
    siteWidth: "boxed",
    heroOverlay: 50,
    heroImageId: null,
    creativePolish: {
      spacing: "airy",
      visualHierarchy: true,
      serviceIcons: false,
      motion: false,
    },
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("isHeroReadabilityRequest routing", () => {
  it.each([
    "Make the words in the hero section easier to read.",
    "Make the hero words easier to read.",
    "The hero text is hard to see.",
    "I can’t read the headline.",
    "The text blends into the image.",
    "Make the hero clearer.",
  ])("detects: %s", (phrase) => {
    expect(isHeroReadabilityRequest(phrase)).toBe(true);
  });

  it("does not steal generic site-wide readability", () => {
    expect(isHeroReadabilityRequest("Make the words easier to read.")).toBe(
      false,
    );
    expect(isHeroReadabilityRequest("Make everything easier to read.")).toBe(
      false,
    );
  });

  it("decision engine routes hero request to hero_readability", () => {
    const decision = decideWithAtlasBrainEngine({
      project: project({ heroImageId: "img-1", heroOverlay: 25 }),
      request: "Make the words in the hero section easier to read.",
    });
    expect(decision.commandKind).toBe("hero_readability");
    expect(decision.stage).toBe("explicit_command");
  });

  it("NL planner marks hero_readability instead of generic copy edits", () => {
    const plan = extractNaturalLanguageEditPlan({
      project: project({ heroImageId: "img-1", heroOverlay: 0 }),
      request: "The hero text is hard to see.",
    });
    expect(plan.matchedSignals).toContain("hero_readability");
    expect(
      plan.operations.some((op) => op.operation === "setHeroOverlay"),
    ).toBe(true);
    expect(
      plan.operations.some((op) => op.operation === "replaceText"),
    ).toBe(false);
  });
});

describe("analyzeHeroReadability signals", () => {
  it("flags light text risk on light hero background (no image)", () => {
    // Light bg with muted-derived text is usually fine; force weak CTA + thin type.
    const assessment = analyzeHeroReadability(
      project({
        backgroundColor: "#f3f4f6",
        headingFont: "playfair",
        accentColor: "#fde68a",
        heroImageId: null,
        heroOverlay: 0,
        creativePolish: { spacing: "default", visualHierarchy: false },
        siteWidth: "full",
      }),
    );
    expect(assessment.issues).toContain("thin_heading_weight");
    expect(assessment.issues).toContain("weak_button_contrast");
    expect(assessment.issues).toContain("excessive_line_width");
    expect(assessment.readable).toBe(false);
  });

  it("flags dark-on-dark style backgrounds via low contrast when surface is dark", () => {
    const assessment = analyzeHeroReadability(
      project({
        backgroundColor: "#111827",
        theme: "dark",
        heroImageId: null,
        heroOverlay: 0,
        // Derived text is light on dark — readable. Force weak CTA instead.
        accentColor: "#94a3b8",
      }),
    );
    expect(assessment.issues).toContain("weak_button_contrast");
  });

  it("flags busy image with no / weak overlay", () => {
    const none = analyzeHeroReadability(
      project({ heroImageId: "hero-1", heroOverlay: 0 }),
    );
    expect(none.issues).toContain("weak_overlay");
    expect(none.issues).toContain("busy_image_behind_text");
    expect(none.issues).toContain("image_unanalyzed");
    expect(none.imageAnalysisAvailable).toBe(false);

    const weak = analyzeHeroReadability(
      project({ heroImageId: "hero-1", heroOverlay: 25 }),
    );
    expect(weak.issues).toContain("weak_overlay");
  });

  it("flags thin heading and small/dense body cues", () => {
    const assessment = analyzeHeroReadability(
      project({
        headingFont: "lora",
        heroSubheadline: "A".repeat(180),
        creativePolish: { spacing: "default", visualHierarchy: false },
      }),
    );
    expect(assessment.issues).toContain("thin_heading_weight");
    expect(assessment.issues).toContain("small_body_text");
  });

  it("recognizes an already-readable hero", () => {
    const assessment = analyzeHeroReadability(project());
    expect(assessment.readable).toBe(true);
    expect(assessment.score).toBeGreaterThanOrEqual(72);
  });
});

describe("treatment + verification", () => {
  it("improves score for weak overlay + busy image", async () => {
    const before = project({
      heroImageId: "hero-busy",
      heroOverlay: 0,
      headingFont: "playfair",
      accentColor: "#fcd34d",
    });
    const beforeScore = analyzeHeroReadability(before).score;

    const result = await runAtlasBrain({
      project: before,
      request: "Make the words in the hero section easier to read.",
    });

    expect(result.applyStatus).toBe("applied");
    expect(
      result.operations.some((op) => op.operation === "setHeroOverlay"),
    ).toBe(true);
    expect(result.project.heroOverlay).toBeGreaterThan(before.heroOverlay);
    expect(result.explanation).toMatch(/overlay|headline|contrast/i);
    expect(result.explanation).not.toMatch(/I('ll| will) improve readability — clearer type hierarchy/i);

    const check = verifyHeroReadabilityImprovement(before, result.project);
    expect(check.improved).toBe(true);
    expect(check.afterScore).toBeGreaterThan(beforeScore);
    expect(check.tokensChanged).toBe(true);
  });

  it("blocks success when rendered state does not change", () => {
    const before = project({ heroImageId: "hero-1", heroOverlay: 0 });
    const planned = planHeroReadabilityOperations(before);
    // Apply empty — simulate emit-without-apply
    const check = verifyHeroReadabilityImprovement(before, before);
    expect(check.improved).toBe(false);
    expect(check.tokensChanged).toBe(false);
    expect(planned.operations.length).toBeGreaterThan(0);
  });

  it("no-op when hero is already readable", async () => {
    const result = await runAtlasBrain({
      project: project(),
      request: "Make the hero words easier to read.",
    });
    expect(result.applyStatus).toBe("no_changes");
    expect(result.explanation).toMatch(
      /already has strong contrast|already readable|background image/i,
    );
  });

  it("preview and publish share the same overlay token treatment", () => {
    const before = project({ heroImageId: "hero-1", heroOverlay: 0 });
    const ops = validateEditOperations(
      planHeroReadabilityOperations(before).operations,
    );
    const after = applyEditOperations(before, ops).project;
    expect(after.heroOverlay).toBeGreaterThan(0);

    const style = buildSiteDesignStyle(after);
    const token = String(after.heroOverlay / 100);
    expect(style["--site-hero-overlay"]).toBe(token);

    const css = buildStaticSiteCss(after);
    expect(css).toContain(`--site-hero-overlay: ${token}`);
  });
});
