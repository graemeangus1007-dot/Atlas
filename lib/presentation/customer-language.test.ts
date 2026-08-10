/**
 * v1.6.4 — Customer-language boundary regressions.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  customerFacingTextExposesArchitecture,
  dedupeReviewStrengths,
  humanizeRecommendationTitle,
  presentBenchmarkGuidance,
  presentStrategicOpportunity,
  sanitizeCustomerFacingText,
  stripListMarkers,
} from "@/lib/presentation/customer-language";
import {
  assessStrategicPriorities,
  formatStrategicDirectorReport,
} from "@/lib/strategy";
import type { StrategicOpportunity } from "@/lib/strategy/types";
import type { BusinessProject } from "@/types/business-project";

const FORBIDDEN =
  /Creative Director|Conversion Director|Strategic Director|Taste Engine|Visual Composition Engine|Transformation Engine|owns the first pass|restraint quality gap|benchmarkId|patternId/i;

function riverviewAfterCta(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Riverview Bakery",
    businessType: "Coffee Shop",
    primaryCta: "View Our Menu",
    heroOverlay: 0.25,
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

function restraintOpportunity(): StrategicOpportunity {
  return {
    id: "benchmark_gap",
    title: "Close the restraint quality gap",
    leader: "creative_director",
    owner: "benchmark",
    domain: "benchmark_comparison",
    sourceScore: 55,
    businessImpact: 68,
    expectedImprovement: 14,
    implementationConfidence: 70,
    verificationConfidence: 72,
    blocked: false,
    dependsOn: [],
    explanation:
      "Aim for the “Premium Modern Service Business” quality bar — not its look. Hero composition owns the first pass. Creative Director should lead the fix.",
  };
}

describe("v1.6.4 customer-language helpers", () => {
  it("humanizes restraint and CTA titles", () => {
    expect(humanizeRecommendationTitle("Close the restraint quality gap")).toBe(
      "Make the design feel more focused",
    );
    expect(humanizeRecommendationTitle("Clarify the primary CTA")).toBe(
      "Make the main call to action clearer",
    );
    expect(humanizeRecommendationTitle("Put proof before the ask")).toMatch(
      /proof before asking/i,
    );
  });

  it("strips bullet markers from presentation items", () => {
    expect(stripListMarkers("• Service clarity")).toBe("Service clarity");
    expect(stripListMarkers("- Concrete services")).toBe("Concrete services");
    expect(stripListMarkers("• Visitors can understand the offer.")).toBe(
      "Visitors can understand the offer.",
    );
  });

  it("dedupes overlapping service-clarity strengths", () => {
    const deduped = dedupeReviewStrengths(
      ["Service clarity", "• Concrete services", "Strong photography"],
      { businessName: "Riverview Bakery" },
    );
    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toMatch(/understand what Riverview Bakery offers/i);
    expect(deduped.join(" ")).not.toMatch(/Service clarity/i);
    expect(deduped.every((s) => !/^[-•]/.test(s))).toBe(true);
  });

  it("presents restraint opportunity without architecture terms", () => {
    const finding = presentStrategicOpportunity(restraintOpportunity());
    const blob = `${finding.title} ${finding.explanation} ${finding.recommendedAction}`;
    expect(blob).toMatch(/restrain|competing|focused|polished/i);
    expect(blob).not.toMatch(FORBIDDEN);
    expect(customerFacingTextExposesArchitecture(blob)).toBe(false);
  });

  it("translates benchmark guidance without profile names", () => {
    const line = presentBenchmarkGuidance({
      dimension: "restraint",
      characteristic: "Fewer competing accents",
      recommendedFocus: "Aim for the Premium Modern Service Business quality bar",
    });
    expect(line).toMatch(/restrained|premium|competing/i);
    expect(line).not.toMatch(/Premium Modern Service Business/i);
    expect(line).not.toMatch(/benchmarkId/i);
  });

  it("sanitizes leaked architecture phrases", () => {
    const cleaned = sanitizeCustomerFacingText(
      "Creative Director should lead the fix. Hero composition owns the first pass.",
    );
    expect(cleaned).not.toMatch(FORBIDDEN);
  });
});

describe("v1.6.4 production transcript — customer language", () => {
  it("Review → Apply All → weakness → Complete stay customer-facing", async () => {
    let project = riverviewAfterCta();

    // Ensure internal truth can still be restraint/benchmark after CTA is strong.
    const internal = assessStrategicPriorities({ project });
    // Canonical ownership unchanged on the assessment object.
    if (internal.highestPriorityOpportunity) {
      expect(internal.highestPriorityOpportunity.leader).toBeTruthy();
      expect(internal.highestPriorityOpportunity.id).toBeTruthy();
    }

    const review = await runAtlasBrain({
      project,
      request: "Review my website.",
    });
    expect(review.explanation).not.toMatch(FORBIDDEN);
    expect(review.explanation).not.toMatch(/•\s*•/);
    // Strengths in presentation data should be plain (no leading bullets duplicated in UI source)
    const strengths =
      review.project.atlasActionMemory?.activePlan?.recommendations ?? [];
    void strengths;
    expect(review.explanation).not.toMatch(/^- • /m);

    project = review.project;
    const apply = await runAtlasBrain({
      project,
      request: "Apply All",
    });
    expect(apply.explanation).not.toMatch(FORBIDDEN);

    project = apply.project;
    const weakness = await runAtlasBrain({
      project,
      request: "What's the biggest weakness?",
    });
    expect(weakness.explanation).not.toMatch(FORBIDDEN);
    // Preferred customer framing when restraint/benchmark leads.
    const assessment = assessStrategicPriorities({ project: weakness.project });
    if (
      assessment.highestPriorityOpportunity?.id === "benchmark_gap" ||
      /restraint|quality gap/i.test(
        assessment.highestPriorityOpportunity?.title ?? "",
      )
    ) {
      expect(weakness.explanation).toMatch(/visual restraint|focused|competing/i);
      expect(weakness.explanation).not.toMatch(/close the restraint quality gap/i);
    }

    const complete = await runAtlasBrain({
      project: weakness.project,
      request: "Complete my website.",
    });
    expect(complete.explanation).not.toMatch(FORBIDDEN);
    expect(complete.explanation).not.toMatch(
      /executing the coordinated plan with .+ leading/i,
    );

    // Advisory formatter unit lock for the production restraint phrasing.
    const fakeAssessment = {
      ...assessment,
      highestPriorityOpportunity: restraintOpportunity(),
    };
    const advisory = formatStrategicDirectorReport(fakeAssessment, {
      mode: "advisory",
      advisoryQuestion: "biggest_weakness",
    });
    expect(advisory).toMatch(/visual restraint/i);
    expect(advisory).not.toMatch(FORBIDDEN);
    expect(advisory).not.toMatch(/Premium Modern Service Business/i);
  }, 120_000);
});
