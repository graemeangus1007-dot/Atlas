/**
 * Conversion Director Phase 1 — advisory evaluation + routing regressions.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import { decideWithAtlasBrainEngine } from "@/lib/ai/atlas-brain-decision-engine";
import {
  evaluateConversion,
  formatConversionDirectorReport,
  isConversionDirectorRequest,
} from "@/lib/conversion";
import {
  filterFollowUpsForOwner,
  filterRecommendationsByScope,
  ownerAllowsDomain,
} from "@/lib/scope";
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

function weakConversionProject(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Harbor Services",
    businessType: "Landscaping",
    heroHeadline: "Welcome",
    heroSubheadline: "We do things.",
    primaryCta: "Click here",
    secondaryCta: undefined,
    heroImageId: "hero-1",
    mediaLibrary: [asset("hero-1")],
    galleryImageIds: [],
    designSections: { enabled: [] },
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "",
      email: "",
      formEnabled: false,
    },
    sectionOrder: ["hero", "about", "services", "contact", "footer"],
  };
}

describe("Conversion Director request detection", () => {
  it("recognizes conversion phrases", () => {
    for (const phrase of [
      "How do we improve conversion?",
      "How do we get more leads?",
      "How can this site convert better?",
      "Improve lead generation.",
      "Increase inquiries.",
      "Improve conversion.",
    ]) {
      expect(isConversionDirectorRequest(phrase)).toBe(true);
    }
  });

  it("does not steal taste or review phrasing", () => {
    expect(isConversionDirectorRequest("Polish the website.")).toBe(false);
    expect(isConversionDirectorRequest("Review my website.")).toBe(false);
    expect(isConversionDirectorRequest("Make the hero prettier.")).toBe(false);
  });
});

describe("Conversion Director evaluation", () => {
  it("scores conversion dimensions and scoped recommendations", () => {
    const evaluation = evaluateConversion({
      project: weakConversionProject(),
    });
    expect(evaluation.overallConversion).toBeGreaterThanOrEqual(0);
    expect(evaluation.overallConversion).toBeLessThanOrEqual(100);
    expect(evaluation.recommendations.length).toBeGreaterThan(0);
    for (const rec of evaluation.recommendations) {
      expect(rec.owner).toBe("conversion_director");
      expect(ownerAllowsDomain("conversion_director", rec.domain)).toBe(true);
    }
    expect(
      evaluation.recommendations.some((r) => r.domain === "spacing"),
    ).toBe(false);
  });

  it("formats analysis-only report", () => {
    const evaluation = evaluateConversion({
      project: weakConversionProject(),
    });
    const report = formatConversionDirectorReport(evaluation);
    expect(report).toMatch(/conversion-focused review/i);
    expect(report).toMatch(/Top conversion strengths/i);
    expect(report).toMatch(/Highest-ROI improvements/i);
    expect(report).not.toMatch(/Apply All|Review Plan/);
  });
});

describe("Scope enforcement", () => {
  it("blocks Taste recommending motion / FAQ / palette", () => {
    const result = filterRecommendationsByScope([
      {
        owner: "taste",
        domain: "motion",
        title: "Add subtle animations",
        explanation: "Motion would polish the site.",
      },
      {
        owner: "taste",
        domain: "faq",
        title: "Add an FAQ",
        explanation: "FAQ would help.",
      },
      {
        owner: "taste",
        domain: "brand_colors",
        title: "Update brand colors",
        explanation: "New palette.",
      },
      {
        owner: "taste",
        domain: "spacing",
        title: "Open the spacing",
        explanation: "More breathing room.",
      },
    ]);
    expect(result.allowed.map((r) => r.domain)).toEqual(["spacing"]);
    expect(result.blocked).toHaveLength(3);
    expect(result.violations).toHaveLength(3);
  });

  it("blocks Conversion recommending spacing / hero composition", () => {
    const result = filterRecommendationsByScope([
      {
        owner: "conversion_director",
        domain: "spacing",
        title: "Open spacing",
        explanation: "Airy layout.",
      },
      {
        owner: "conversion_director",
        domain: "cta",
        title: "Clarify CTA",
        explanation: "Clear next step.",
      },
    ]);
    expect(result.allowed.map((r) => r.domain)).toEqual(["cta"]);
    expect(result.blocked).toHaveLength(1);
  });

  it("filters Taste follow-ups outside ownership", () => {
    const filtered = filterFollowUpsForOwner("taste", [
      "Review my website",
      "Add subtle animations",
      "Add an FAQ section",
      "Update brand colors",
      "Open the spacing",
    ]);
    expect(filtered.allowed).toEqual([
      "Review my website",
      "Open the spacing",
    ]);
    expect(filtered.blocked).toEqual(
      expect.arrayContaining([
        "Add subtle animations",
        "Add an FAQ section",
        "Update brand colors",
      ]),
    );
  });
});

describe("v1.5 ownership routing matrix", () => {
  it("routes Make the hero prettier → Visual Composition", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakConversionProject(),
      request: "Make the hero prettier.",
    });
    expect(decided.commandKind).toBe("visual_composition");
    expect(decided.stage).toBe("visual_composition");
  });

  it("routes Improve conversion → Conversion Director", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakConversionProject(),
      request: "Improve conversion.",
    });
    expect(decided.commandKind).toBe("conversion_director");
    expect(decided.stage).toBe("conversion_director");
    expect(decided.decision.shouldExecuteEdits).toBe(false);
    expect(decided.decision.needsClarification).toBe(false);
  });

  it("routes Complete my website → Transformation path (not conversion)", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakConversionProject(),
      request: "Complete my website.",
    });
    expect(decided.commandKind).not.toBe("conversion_director");
    expect(decided.stage).not.toBe("conversion_director");
  });

  it("routes Review my website → Creative Director critique", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakConversionProject(),
      request: "Review my website.",
    });
    expect(decided.stage).toBe("critique");
    expect(decided.decision.intent).toBe("design_critique");
  });

  it("routes Polish the website → Taste", () => {
    const decided = decideWithAtlasBrainEngine({
      project: weakConversionProject(),
      request: "Polish the website.",
    });
    expect(decided.commandKind).toBe("taste_polish");
  });
});

describe("Production regressions", () => {
  it("Polish the website never recommends motion / FAQ / palette / new sections", async () => {
    const result = await runAtlasBrain({
      project: {
        ...weakConversionProject(),
        primaryCta: "Get a quote",
        heroHeadline: "Outdoor spaces that feel finished",
        heroSubheadline: "Design and care for yards that look intentional.",
        contact: {
          ...MOCK_BUSINESS_PROJECT.contact,
          phone: "555-0100",
          email: "hello@example.com",
          formEnabled: true,
        },
        designSections: {
          enabled: ["testimonials"],
          testimonials: [
            {
              id: "t1",
              quote: "Great work.",
              name: "Alex",
              role: "Homeowner",
            },
          ],
        },
        galleryImageIds: ["g1", "g2"],
        mediaLibrary: [asset("hero-1"), asset("g1"), asset("g2")],
        creativePolish: {
          spacing: "default",
          visualHierarchy: false,
          serviceIcons: false,
          motion: true,
          hoverEffects: true,
        },
      },
      request: "Polish the website.",
    });
    expect(result.decision?.commandKind).toBe("taste_polish");
    const chips = (result.followUpSuggestions ?? []).join(" | ").toLowerCase();
    expect(chips).not.toMatch(/animation|motion|faq|palette|brand color|new section/);
    expect(result.explanation).not.toMatch(/\bFAQ\b|\bpalette\b|brand colors/i);
  });

  it("How do we improve conversion? is analysis-only Conversion Director", async () => {
    const result = await runAtlasBrain({
      project: weakConversionProject(),
      request: "How do we improve conversion?",
    });
    expect(result.decision?.commandKind).toBe("conversion_director");
    expect(result.applyStatus).toBe("no_changes");
    expect(result.operations).toEqual([]);
    expect(result.decision?.shouldExecuteEdits).toBe(false);
    expect(result.decision?.needsClarification).toBe(false);
    const chips = (result.followUpSuggestions ?? []).join(" | ");
    expect(chips).not.toMatch(/Apply All|Homepage Review|Review Plan/i);
    expect(result.explanation).toMatch(/conversion-focused review|analysis only/i);
    expect(result.explanation).not.toMatch(/Apply All|Homepage Review|Review Plan/i);
  });
});
