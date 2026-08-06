/**
 * Production regression — Harborview high score vs “needs different approach”.
 * Score must calibrate downward or explain remaining exceptional status.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { NAMED_COLORS } from "@/lib/ai/named-colors";
import { getActionMemory } from "@/lib/ai/atlas-action-memory";
import { setInteractionState } from "@/lib/ai/interaction-state";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import { buildPageSectionInventory } from "@/lib/creative-director/inventory";
import {
  buildTransformationFingerprint,
  shouldSkipRepeatedNoGainAttempt,
  storeTransformationAttempt,
} from "@/lib/transformation/attempt-memory";
import { detectTransformationCapabilityGaps } from "@/lib/transformation/capability-gaps";
import { classifyTransformationGoals } from "@/lib/transformation/classify";
import {
  buildTransformationPlanForProject,
  executeTransformationPlan,
  transformationTextExposesInternalIds,
} from "@/lib/transformation";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

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

/** Exact Harborview-style production fixture (pre-fix reported ~91). */
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

describe("Harborview production — score calibration + capability gaps", () => {
  it("baseline is not exceptional while hero/trust weaknesses remain", () => {
    const project = harborviewProject();
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    const inventory = buildPageSectionInventory({ project });

    // Render-aware signals must be inspected (not mere field presence)
    expect(inventory.hasHeroImage).toBe(true);
    expect(
      inventory.heroCompositionScore != null || inventory.heroMajorDefect,
    ).toBe(true);

    const overall = evaluation.dimensions.overallDesignScore;
    // Pre-fix reports ~91; calibrated score must leave Exceptional if major weakness
    expect(overall).toBeLessThan(90);
    expect(evaluation.health.qualityBand).not.toBe("Exceptional");
    expect(evaluation.health.qualityBand).toMatch(/Strong|Solid|Developing/);

    // Trust must not get full credit from thin / missing proof
    expect(evaluation.trust.score).toBeLessThan(80);
    expect(evaluation.dimensions.trust).toBeLessThanOrEqual(78);

    // Section breakdown available for production trace
    expect(evaluation.sections.length).toBeGreaterThan(0);
    const weakest = [...evaluation.sections].sort((a, b) => a.score - b.score)[0];
    expect(weakest).toBeTruthy();
  });

  it("Complete path surfaces capability gaps and no false exceptional success", () => {
    const project = harborviewProject();
    const baseline = evaluateWebsiteAsCreativeDirector({ project });
    expect(baseline.dimensions.overallDesignScore).toBeLessThan(90);

    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website",
    );
    const classified = classifyTransformationGoals({ plan, project });
    const preGaps = detectTransformationCapabilityGaps({
      project,
      plan,
      evaluation: baseline,
      classified,
    });
    expect(preGaps.length).toBeGreaterThan(0);

    const result = executeTransformationPlan({
      project,
      plan,
      allowRefinement: true,
    });

    expect(result.summary).not.toMatch(/^Done\./m);
    expect(transformationTextExposesInternalIds(result.summary)).toBe(false);
    expect(result.finalScore).toBeLessThan(90);
    expect(result.capabilityGaps?.length ?? 0).toBeGreaterThan(0);
    // Must not claim an exceptional redesign when proof/hero gaps remain
    expect(result.summary).not.toMatch(/exceptional/i);
    expect(result.summary).toMatch(
      /proof|review|trust|improved|kept the current|restored|need your input/i,
    );
  });

  it("identical zero-delta plan is not rerun within the skip window", () => {
    const project = harborviewProject({
      designSections: {
        enabled: ["testimonials", "gallery", "faq"],
        testimonials: [
          {
            author: "Jordan",
            quote: "They transformed our backyard into a calm outdoor room.",
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
      galleryInteraction: { mode: "lightbox", navigation: true, captions: true },
    });
    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website",
    );
    const goalIds = plan.goals.map((g) => g.id);
    const fingerprint = buildTransformationFingerprint({ project, goalIds });

    const first = executeTransformationPlan({
      project,
      plan,
      allowRefinement: false,
    });

    // Record as a no-gain attempt (even if small noise) for repeat prevention
    const recordedDelta =
      Math.abs(first.verifiedScoreDelta) <= 2 ? first.verifiedScoreDelta : 0;
    const withMemory = setInteractionState(
      project,
      storeTransformationAttempt(getActionMemory(project), {
        fingerprint,
        goalIds,
        overallDelta: recordedDelta,
        baselineScore: first.baselineScore,
        at: new Date().toISOString(),
        capabilityGaps: first.capabilityGaps ?? [],
      }),
    );

    const skip = shouldSkipRepeatedNoGainAttempt({
      memory: getActionMemory(withMemory),
      fingerprint: buildTransformationFingerprint({
        project: withMemory,
        goalIds,
      }),
    });
    expect(skip).toBeTruthy();
    expect(skip!.fingerprint).toBe(fingerprint);
  });

  it("testimonials present but late do not receive full trust credit", () => {
    const project = harborviewProject({
      designSections: {
        enabled: ["testimonials"],
        testimonials: [
          {
            quote: "Nice work on our patio.",
            author: "Sam",
            role: "Homeowner",
          },
        ],
      },
      sectionOrder: ["hero", "about", "services", "contact", "testimonials"],
    });
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    const inventory = buildPageSectionInventory({ project });
    expect(inventory.testimonialCount).toBeGreaterThan(0);
    expect(inventory.proofBeforeAsk).toBe(false);
    expect(evaluation.trust.score).toBeLessThan(85);
    expect(evaluation.trust.missing).toEqual(
      expect.arrayContaining([expect.stringMatching(/proof|position/i)]),
    );
  });

  it("unsupported required layout / weak proof produces capability-gap output", () => {
    const project = harborviewProject();
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    const { plan } = buildTransformationPlanForProject(
      project,
      "Complete my website",
    );
    const classified = classifyTransformationGoals({ plan, project });
    const gaps = detectTransformationCapabilityGaps({
      project,
      plan,
      evaluation,
      classified,
    });
    expect(gaps.some((g) => g.currentCapabilityMissing)).toBe(true);
    expect(
      gaps.some(
        (g) =>
          g.userInputRequired ||
          /testimonial|proof|hero|photograph|review/i.test(g.problem),
      ),
    ).toBe(true);
  });
});
