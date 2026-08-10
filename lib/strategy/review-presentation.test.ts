/**
 * v1.6.3 — Review presentation + empty-section invariant.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  assessStrategicPriorities,
  buildReviewPresentation,
  formatContainsEmptySectionHeadings,
  formatReviewPresentation,
  toCustomerFacingImprovementTitle,
} from "@/lib/strategy";
import type { EnrichedReviewRecommendation } from "@/lib/strategy/review-plan";

function rec(
  partial: Partial<EnrichedReviewRecommendation> & { title: string },
): EnrichedReviewRecommendation {
  return {
    id: partial.id ?? partial.title,
    kind: partial.kind ?? "visual",
    title: partial.title,
    explanation: partial.explanation ?? partial.title,
    impact: "high",
    impactScore: 80,
    confidence: 0.9,
    operations: partial.operations ?? [],
    capabilityIds: [],
    applyable: partial.applyable ?? true,
    estimatedTime: "<10 seconds",
    owner: partial.owner ?? "creative_director",
    domain: partial.domain ?? "visual_direction",
    objective: partial.objective ?? partial.title,
    strategicRank: partial.strategicRank ?? 0,
    deferred: partial.deferred ?? false,
    blockedReason: partial.blockedReason,
    supportStatus: partial.supportStatus,
  };
}

describe("v1.6.3 Review presentation", () => {
  it("translates internal restraint language to natural copy", () => {
    expect(
      toCustomerFacingImprovementTitle("Close the remaining restraint quality gap"),
    ).toMatch(/simplify|visual treatments/i);
    expect(
      toCustomerFacingImprovementTitle("Clarify the primary CTA"),
    ).toBe("Clarify the primary CTA");
  });

  it("omits empty Strengths / Needs your input / Next improvements headings", () => {
    const assessment = assessStrategicPriorities({
      project: MOCK_BUSINESS_PROJECT,
    });
    const presentation = buildReviewPresentation({
      assessment,
      recommendations: [],
      critiqueExplanation: "A short summary without a strengths block.",
      businessName: "Riverview Bakery",
      critiqueStrengthTitles: [],
    });
    expect(presentation.strengths).toEqual([]);
    const text = formatReviewPresentation(presentation);
    expect(text).not.toMatch(/^Strengths\s*$/m);
    expect(text).not.toMatch(/^What's working\s*$/m);
    expect(text).not.toMatch(/^Needs your input\s*$/m);
    expect(formatContainsEmptySectionHeadings(text)).toBe(false);
  });

  it("renders What's working only when strengths exist", () => {
    const assessment = assessStrategicPriorities({
      project: MOCK_BUSINESS_PROJECT,
    });
    const presentation = buildReviewPresentation({
      assessment,
      recommendations: [
        rec({ title: "Clarify the primary CTA", domain: "cta" }),
      ],
      critiqueExplanation: "",
      businessName: "Riverview Bakery",
      critiqueStrengthTitles: [
        "Strong photography gives the bakery personality.",
        "The page hierarchy is easy to scan.",
      ],
    });
    expect(presentation.strengths.length).toBe(2);
    const text = formatReviewPresentation(presentation);
    expect(text).toMatch(/What's working/);
    expect(text).toMatch(/Strong photography/);
    expect(text).toMatch(/Highest priority/);
    expect(text).toMatch(/Next improvements/);
    expect(formatContainsEmptySectionHeadings(text)).toBe(false);
  });

  it("shows Needs your input only for blocked items that need real input", () => {
    const assessment = assessStrategicPriorities({
      project: MOCK_BUSINESS_PROJECT,
    });
    const presentation = buildReviewPresentation({
      assessment,
      recommendations: [
        rec({
          title: "Add customer testimonials",
          applyable: false,
          supportStatus: "needs_images",
          blockedReason: "Requires customer testimonials from the business.",
          domain: "trust",
        }),
        rec({ title: "Clarify the primary CTA", domain: "cta" }),
      ],
      critiqueExplanation: "",
      businessName: "Riverview Bakery",
      critiqueStrengthTitles: ["Clear bakery personality."],
    });
    expect(presentation.blockedByUserInput.length).toBeGreaterThan(0);
    const text = formatReviewPresentation(presentation);
    expect(text).toMatch(/Needs your input/);
    expect(text).toMatch(/testimonial/i);
  });
});
