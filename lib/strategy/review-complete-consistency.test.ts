/**
 * v1.6.2 — Review / Complete strategic consistency.
 * Exact Riverview production sequence + Apply All disposition invariants.
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { runAtlasBrain } from "@/lib/ai/atlas-brain";
import {
  arbitrateReviewRecommendations,
  assertSameHighestPriority,
  assessStrategicPriorities,
  formatApplyAllDispositionReport,
  hasRecentNoGainCompletion,
  inferRecommendationDomain,
  isVagueDirectionWithCosmeticOps,
  preApplyDisposition,
  shouldBlockAsPostCompletionChurn,
  type RecommendationExecutionTrace,
} from "@/lib/strategy";
import type { CreativeDirectorRecommendation } from "@/lib/ai/creative-director-types";
import type { BusinessProject } from "@/types/business-project";

function riverview(): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    atlasActionMemory: undefined,
  };
}

const landscapeDirection: CreativeDirectorRecommendation = {
  id: "visual.landscape-direction",
  kind: "visual",
  title: "Commit to a premium landscape-led direction",
  explanation: "Unify the page around a premium landscape-led visual direction.",
  impact: "high",
  impactScore: 88,
  confidence: 0.85,
  operations: [
    {
      operation: "setCreativePolish",
      motion: true,
      hoverEffects: true,
      visualHierarchy: true,
    },
  ],
  capabilityIds: [],
  applyable: true,
  estimatedTime: "<10 seconds",
};

const ctaClarity: CreativeDirectorRecommendation = {
  id: "conversion.cta-clarity",
  kind: "conversion",
  title: "Clarify the primary CTA",
  explanation: "Make the primary call to action clearer and more decisive.",
  impact: "high",
  impactScore: 92,
  confidence: 0.9,
  operations: [
    {
      operation: "replaceText",
      target: "hero.primaryCta",
      value: "Order fresh pastries",
    },
  ],
  capabilityIds: [],
  applyable: true,
  estimatedTime: "<10 seconds",
};

describe("v1.6.2 Review plan arbitration", () => {
  it("demotes vague landscape direction when CTA is strategic top", () => {
    const assessment = assessStrategicPriorities({ project: riverview() });
    expect(inferRecommendationDomain(landscapeDirection)).toBe("narrative");
    // If CTA is top, landscape-only cosmetic ops must not lead.
    const ranked = arbitrateReviewRecommendations({
      assessment,
      recommendations: [landscapeDirection, ctaClarity],
    });
    expect(ranked[0]?.title).toMatch(/CTA|call to action|primary/i);
    expect(
      ranked.find((r) => /landscape-led/i.test(r.title))?.deferred,
    ).toBe(true);
    expect(
      isVagueDirectionWithCosmeticOps(
        landscapeDirection,
        landscapeDirection.operations,
      ),
    ).toBe(true);
  });

  it("same project truth → same highest priority for Review and Complete assessments", () => {
    const project = riverview();
    const a = assessStrategicPriorities({ project });
    const b = assessStrategicPriorities({ project });
    expect(assertSameHighestPriority(a, b)).toBe(true);
  });

  it("blocks post-completion cosmetic churn", () => {
    expect(
      shouldBlockAsPostCompletionChurn({
        postCompletionEvidence: true,
        recommendation: {
          ...landscapeDirection,
          domain: "narrative",
          deferred: true,
        },
        highestPriorityDomain: "cta",
      }),
    ).toBe(true);
    expect(
      hasRecentNoGainCompletion({
        lastAttempt: {
          overallDelta: 0,
          at: new Date().toISOString(),
        },
      }),
    ).toBe(true);
  });

  it("pre-apply rejects domain-mismatched direction ops", () => {
    const blocked = preApplyDisposition({
      recommendation: {
        id: landscapeDirection.id,
        source: "design_critique",
        title: landscapeDirection.title,
        kind: landscapeDirection.kind,
        applyable: true,
        operations: landscapeDirection.operations,
        explanation: landscapeDirection.explanation,
        domain: inferRecommendationDomain(landscapeDirection),
      },
      postCompletionEvidence: false,
      highestPriorityDomain: "cta",
    });
    expect(blocked?.disposition).toBe("blocked_unsupported");
  });

  it("disposition report accounts for every recommendation", () => {
    const traces: RecommendationExecutionTrace[] = [
      {
        recommendationId: "1",
        title: "Clarify the primary CTA",
        owner: "conversion_director",
        domain: "cta",
        objective: "Clarify the primary CTA",
        disposition: "applied",
        mappedOperations: ["replaceText"],
        expectedDimensions: ["cta"],
        actualMutationDomains: ["cta"],
        verificationResult: "verified",
      },
      {
        recommendationId: "2",
        title: "Add testimonials",
        owner: "conversion_director",
        domain: "trust",
        objective: "Add testimonials",
        disposition: "blocked_missing_input",
        mappedOperations: [],
        expectedDimensions: ["trust"],
        actualMutationDomains: [],
        verificationResult: "not_applyable",
        reason: "Needs customer testimonials.",
      },
      {
        recommendationId: "3",
        title: "Open the spacing",
        owner: "taste",
        domain: "spacing",
        objective: "Open the spacing",
        disposition: "already_satisfied",
        mappedOperations: ["setCreativePolish"],
        expectedDimensions: ["spacing"],
        actualMutationDomains: [],
        verificationResult: "already_satisfied",
      },
      {
        recommendationId: "4",
        title: "Commit to a premium landscape-led direction",
        owner: "creative_director",
        domain: "narrative",
        objective: "Commit to a premium landscape-led direction",
        disposition: "failed_verification",
        mappedOperations: ["setCreativePolish"],
        expectedDimensions: ["narrative"],
        actualMutationDomains: ["motion", "typography_hierarchy"],
        verificationResult: "domain_mismatch",
        reason: "Did not improve the verified result.",
      },
    ];
    const report = formatApplyAllDispositionReport(traces);
    expect(report).toMatch(/all 4 approved/);
    expect(report).toMatch(/1 improved/);
    expect(report).toMatch(/already satisfied/);
    expect(report).toMatch(/not applied/i);
    expect(report).not.toMatch(/recommendation applied\n.*website change/i);
  });
});

describe("v1.6.2 Riverview production sequence", () => {
  it("advisory → Complete → Complete → Review → Apply All stay strategically consistent", async () => {
    let project = riverview();
    const advisoryPriorityIds: Array<string | null> = [];

    for (const ask of [
      "What's the biggest weakness?",
      "What should I fix first?",
      "Where should I spend another hour?",
      "What would improve this site the most?",
    ]) {
      const turn = await runAtlasBrain({ project, request: ask });
      expect(turn.applyStatus).toBe("no_changes");
      expect(turn.explanation).toMatch(/CTA|call to action|conversion|priority/i);
      const assessment = assessStrategicPriorities({ project: turn.project });
      advisoryPriorityIds.push(
        assessment.highestPriorityOpportunity?.id ?? null,
      );
      project = turn.project;
    }

    const sharedTop = advisoryPriorityIds[0];
    for (const id of advisoryPriorityIds) {
      expect(id).toBe(sharedTop);
    }

    const complete1 = await runAtlasBrain({
      project,
      request: "Complete my website.",
    });
    expect(complete1.decision?.matchedSignals ?? []).toEqual(
      expect.arrayContaining(["execute_completion"]),
    );
    project = complete1.project;

    const complete2 = await runAtlasBrain({
      project,
      request: "Complete my website.",
    });
    expect(complete2.applyStatus === "no_changes" || complete2.ok).toBe(true);
    if (complete2.applyStatus === "no_changes") {
      expect(complete2.explanation).toMatch(
        /already|strong|kept the current|didn’t make|nothing new|no safe|completed|idempotent|no beneficial/i,
      );
    }
    project = complete2.project;

    const strategicBeforeReview = assessStrategicPriorities({ project });
    const review = await runAtlasBrain({
      project,
      request: "Review my website.",
    });
    expect(review.applyStatus).toBe("no_changes");
    expect(review.decision?.intent).toBe("design_critique");

    const snapshot =
      review.project.atlasActionMemory?.activePlan?.reviewPlanSnapshot;
    expect(snapshot).toBeTruthy();
    expect(snapshot?.highestPriorityOpportunityId).toBe(
      strategicBeforeReview.highestPriorityOpportunity?.id ?? null,
    );
    expect(review.explanation).toMatch(/Highest priority/i);
    // Must not lead with landscape-led direction when CTA remains top.
    if (strategicBeforeReview.highestPriorityOpportunity?.id === "cta") {
      expect(review.explanation).not.toMatch(
        /^[\s\S]{0,120}Commit to a premium landscape-led direction/i,
      );
      expect(review.explanation).toMatch(/CTA|call to action|primary/i);
    }

    const paletteBefore = {
      primary: review.project.primaryColor,
      accent: review.project.accentColor,
      secondary: review.project.secondaryColor,
    };
    const motionBefore = review.project.creativePolish?.motion;
    const typographyBefore = [
      review.project.headingFont,
      review.project.bodyFont,
    ];

    const apply = await runAtlasBrain({
      project: review.project,
      request: "Apply All",
    });
    expect(apply.decision?.matchedSignals ?? []).not.toEqual(
      expect.arrayContaining(["execute_completion"]),
    );
    expect(apply.explanation).toMatch(/I evaluated all \d+ approved/i);
    expect(apply.explanation).not.toMatch(
      /^\d+ recommendation(?:s)? applied\n\d+ website change/i,
    );

    // No silent Motions/Typography substitute for landscape direction after no-gain Complete.
    const postCompleteNoGain =
      Math.abs(
        review.project.atlasActionMemory?.lastTransformationAttempt
          ?.overallDelta ?? 99,
      ) <= 2;
    if (postCompleteNoGain) {
      const onlyCosmetic =
        apply.applyStatus === "applied" &&
        apply.operations.length > 0 &&
        apply.operations.every((op) => {
          const kind = String(op.operation);
          return (
            kind === "setCreativePolish" ||
            kind === "setTypography" ||
            /Font|font/.test(kind)
          );
        });
      expect(onlyCosmetic).toBe(false);
    }

    expect(apply.project.primaryColor).toBe(paletteBefore.primary);
    expect(apply.project.accentColor).toBe(paletteBefore.accent);
    expect(apply.project.secondaryColor).toBe(paletteBefore.secondary);

    // If nothing verified as improving, motion/typography should not churn.
    if (apply.applyStatus === "no_changes") {
      expect(apply.project.creativePolish?.motion).toBe(motionBefore);
      expect([apply.project.headingFont, apply.project.bodyFont]).toEqual(
        typographyBefore,
      );
    }
  }, 120_000);
});
