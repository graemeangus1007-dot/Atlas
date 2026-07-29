/**
 * Sprint 23.0A / 23.1 — Atlas Business Advisor + Critique Engine regression tests.
 */

import { describe, expect, it } from "vitest";
import { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
import {
  ADVISOR_TOP_N,
  advisorProjectFingerprint,
  createAdvisorPipeline,
  limitTopRecommendations,
  rankAdvisorFindings,
  reviewBusinessProject,
  shouldRefreshAdvisorReport,
  suppressDuplicateFindings,
} from "@/lib/ai/business-advisor";
import type {
  AdvisorFinding,
  AdvisorModule,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import { explainAdvisorFinding } from "@/lib/ai/critique-explanations";
import {
  CRITIQUE_SCORE_CATEGORIES,
  scoreBusinessProject,
} from "@/lib/ai/critique-scoring";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

function sampleProject() {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Cedar Cafe",
    primaryColor: "#2563eb",
    accentColor: "#2563eb",
    backgroundColor: "#f7f8fa",
    heroHeadline: "Welcome",
    heroSubheadline: "Coffee nearby",
    primaryCta: "Learn more",
    description: "Short.",
    contact: {
      ...MOCK_BUSINESS_PROJECT.contact,
      phone: "555-0100",
      buttonText: "Submit",
    },
    seo: {
      ...MOCK_BUSINESS_PROJECT.seo!,
      siteTitle: "Cedar Cafe",
      metaDescription: "Cafe",
    },
    headingFont: "inter" as const,
    bodyFont: "inter" as const,
    buttonStyle: "square" as const,
    siteWidth: "full" as const,
    designSections: {
      enabled: [] as Array<"testimonials" | "faq" | "gallery" | "pricing">,
      testimonials: [],
      faq: [],
    },
    publish: null,
  };
}

function finding(
  partial: Partial<AdvisorFinding> & Pick<AdvisorFinding, "id">,
): AdvisorFinding {
  return {
    category: "conversion",
    title: partial.id,
    why: "why",
    impact: "medium",
    impactScore: 50,
    confidence: 0.5,
    operations: [
      {
        operation: "replaceText",
        target: "hero.title",
        value: "Updated",
      },
    ],
    ...partial,
  };
}

function recommendationStub(
  partial: Partial<BusinessRecommendation> & Pick<BusinessRecommendation, "id">,
): BusinessRecommendation {
  return {
    category: "conversion",
    title: partial.id,
    why: "why",
    noticed: "noticed",
    whyItMatters: "why it matters",
    expectedOutcome: "outcome",
    estimatedTime: "<10 seconds",
    impact: "low",
    impactScore: 10,
    confidence: 0.5,
    destructive: false,
    narrative: "noticed",
    scoreCategory: "conversion",
    operations: [],
    ...partial,
  };
}

describe("recommendation ranking", () => {
  it("orders by impact, then impactScore, then confidence", () => {
    const ranked = rankAdvisorFindings([
      finding({
        id: "low",
        impact: "low",
        impactScore: 99,
        confidence: 0.99,
      }),
      finding({
        id: "high-b",
        impact: "high",
        impactScore: 80,
        confidence: 0.7,
      }),
      finding({
        id: "high-a",
        impact: "high",
        impactScore: 90,
        confidence: 0.6,
      }),
      finding({
        id: "high-c",
        impact: "high",
        impactScore: 90,
        confidence: 0.9,
      }),
      finding({
        id: "med",
        impact: "medium",
        impactScore: 95,
        confidence: 0.95,
      }),
    ]);

    expect(ranked.map((f) => f.id)).toEqual([
      "high-c",
      "high-a",
      "high-b",
      "med",
      "low",
    ]);
  });
});

describe("top-5 limit", () => {
  it("caps recommendations at ADVISOR_TOP_N", () => {
    expect(ADVISOR_TOP_N).toBe(5);
    expect(limitTopRecommendations([1, 2, 3, 4, 5, 6, 7])).toHaveLength(5);

    const report = reviewBusinessProject({ project: sampleProject() });
    expect(report.recommendations.length).toBeLessThanOrEqual(5);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("respects an explicit limit override", () => {
    const report = reviewBusinessProject({
      project: sampleProject(),
      limit: 2,
    });
    expect(report.recommendations).toHaveLength(2);
  });
});

describe("impact ordering", () => {
  it("surfaces high-impact recommendations first", () => {
    const report = reviewBusinessProject({ project: sampleProject() });
    const ranks = { high: 3, medium: 2, low: 1 } as const;
    for (let i = 1; i < report.recommendations.length; i++) {
      const prev = report.recommendations[i - 1]!;
      const curr = report.recommendations[i]!;
      expect(ranks[prev.impact]).toBeGreaterThanOrEqual(ranks[curr.impact]);
    }
  });
});

describe("confidence scoring", () => {
  it("keeps confidence in 0–1 and prefers higher confidence on ties", () => {
    const report = reviewBusinessProject({ project: sampleProject() });
    for (const rec of report.recommendations) {
      expect(rec.confidence).toBeGreaterThan(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
    }

    const ranked = rankAdvisorFindings([
      finding({ id: "a", impact: "high", impactScore: 80, confidence: 0.5 }),
      finding({ id: "b", impact: "high", impactScore: 80, confidence: 0.9 }),
    ]);
    expect(ranked[0]?.id).toBe("b");
  });
});

describe("duplicate recommendation suppression", () => {
  it("keeps the higher impactScore when ids collide", () => {
    const deduped = suppressDuplicateFindings([
      finding({ id: "dup", impactScore: 40, confidence: 0.9 }),
      finding({ id: "dup", impactScore: 70, confidence: 0.4 }),
      finding({ id: "other", impactScore: 10 }),
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((f) => f.id === "dup")?.impactScore).toBe(70);
  });

  it("suppresses duplicates across modules in the pipeline", () => {
    const a: AdvisorModule = {
      id: "conversion",
      label: "A",
      review: () => [finding({ id: "shared", impactScore: 50 })],
    };
    const b: AdvisorModule = {
      id: "trust",
      label: "B",
      review: () => [finding({ id: "shared", impactScore: 88 })],
    };
    const report = createAdvisorPipeline([a, b])({
      project: sampleProject(),
    });
    expect(report.recommendations.filter((r) => r.id === "shared")).toHaveLength(
      1,
    );
    expect(report.recommendations[0]?.impactScore).toBe(88);
  });
});

describe("recommendation refresh", () => {
  it("refreshes when the project fingerprint changes", () => {
    const before = sampleProject();
    const report = reviewBusinessProject({ project: before });
    expect(shouldRefreshAdvisorReport(null, before)).toBe(true);
    expect(shouldRefreshAdvisorReport(report, before)).toBe(false);

    const after = {
      ...before,
      primaryCta: "Book a table",
      heroSubheadline: `Call ${before.contact.phone} today`,
    };
    expect(advisorProjectFingerprint(before)).not.toBe(
      advisorProjectFingerprint(after),
    );
    expect(shouldRefreshAdvisorReport(report, after)).toBe(true);

    const refreshed = reviewBusinessProject({ project: after });
    expect(refreshed.fingerprint).not.toBe(report.fingerprint);
  });
});

describe("one-click apply", () => {
  it("applies recommendation operations through the edit pipeline", () => {
    const project = sampleProject();
    const report = reviewBusinessProject({ project });
    const rec =
      report.recommendations.find((r) => r.operations.length > 0) ??
      report.recommendations[0]!;

    const result = applyAdvisorRecommendation({
      project,
      recommendation: rec,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("applied");
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.explanation).toContain(rec.title);
    expect(result.requestId).toBeTruthy();
  });

  it("rejects destructive recommendations without confirmation", () => {
    const recommendation = recommendationStub({
      id: "destructive.demo",
      title: "Remove FAQ",
      destructive: true,
      operations: [{ operation: "removeSection", type: "faq" }],
    });

    const blocked = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.status).toBe("failed");
    expect(blocked.message).toMatch(/confirmation/i);
    expect(blocked.requestId).toBeTruthy();

    const allowed = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation,
      confirmDestructive: true,
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.status).toBe("applied");
  });

  it("rejects recommendations with no operations", () => {
    const result = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation: recommendationStub({
        id: "empty",
        category: "seo",
        title: "Think about SEO",
        scoreCategory: "seo",
        operations: [],
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("failed");
    expect(result.requestId).toBeTruthy();
  });
});

describe("advisor pipeline", () => {
  it("uses natural narrative copy and plugs in custom modules", () => {
    const report = reviewBusinessProject({ project: sampleProject() });
    expect(report.summary.length).toBeGreaterThan(10);
    for (const rec of report.recommendations) {
      expect(rec.narrative.length).toBeGreaterThan(0);
      expect(rec.why.length).toBeGreaterThan(0);
    }

    const custom: AdvisorModule = {
      id: "performance",
      label: "Performance Advisor",
      review: () => [
        finding({
          id: "perf.demo",
          category: "readability",
          title: "Trim heavy hero copy",
          impact: "high",
          impactScore: 99,
          confidence: 0.95,
        }),
      ],
    };
    const plugged = createAdvisorPipeline([custom])({
      project: sampleProject(),
    });
    expect(plugged.recommendations[0]?.id).toBe("perf.demo");
  });
});

describe("score calculation", () => {
  it("returns 0–100 overall and category scores", () => {
    const scores = scoreBusinessProject(sampleProject());
    expect(scores.overall).toBeGreaterThanOrEqual(0);
    expect(scores.overall).toBeLessThanOrEqual(100);
    for (const key of CRITIQUE_SCORE_CATEGORIES) {
      expect(scores.categories[key]).toBeGreaterThanOrEqual(0);
      expect(scores.categories[key]).toBeLessThanOrEqual(100);
    }

    const report = reviewBusinessProject({ project: sampleProject() });
    expect(report.overallScore).toBe(scores.overall);
    expect(report.categoryScores).toEqual(scores.categories);
  });

  it("improves conversion score when CTAs and contact cues strengthen", () => {
    const weak = sampleProject();
    const strong = {
      ...weak,
      primaryCta: "Call now",
      heroSubheadline: `Call ${weak.contact.phone} today for catering`,
      contact: { ...weak.contact, buttonText: "Request a quote" },
    };
    expect(scoreBusinessProject(strong).categories.conversion).toBeGreaterThan(
      scoreBusinessProject(weak).categories.conversion,
    );
  });
});

describe("stable scores", () => {
  it("returns identical scores for the same project across refreshes", () => {
    const project = sampleProject();
    const a = scoreBusinessProject(project);
    const b = scoreBusinessProject(project);
    const reportA = reviewBusinessProject({ project });
    const reportB = reviewBusinessProject({ project });

    expect(a).toEqual(b);
    expect(reportA.overallScore).toBe(reportB.overallScore);
    expect(reportA.categoryScores).toEqual(reportB.categoryScores);
    expect(reportA.recommendations.map((r) => r.id)).toEqual(
      reportB.recommendations.map((r) => r.id),
    );
  });
});

describe("explanation generation", () => {
  it("produces designer-style critique fields without jargon-heavy diagnostics", () => {
    const report = reviewBusinessProject({ project: sampleProject() });
    expect(report.recommendations.length).toBeGreaterThan(0);

    for (const rec of report.recommendations) {
      expect(rec.noticed.length).toBeGreaterThan(12);
      expect(rec.whyItMatters.length).toBeGreaterThan(12);
      expect(rec.expectedOutcome.length).toBeGreaterThan(12);
      expect(rec.estimatedTime.length).toBeGreaterThan(0);
      expect(rec.noticed.toLowerCase()).not.toMatch(/\bwcag\b|\brgb\b|\bhex\b/);
      expect(rec.whyItMatters.toLowerCase()).not.toMatch(/\bwcag\b|\bnull\b/);
    }

    const cta = explainAdvisorFinding(
      finding({
        id: "cta.weak-primary",
        category: "cta_effectiveness",
        title: "Strengthen your primary call to action",
        impact: "high",
      }),
    );
    expect(cta.noticed).toMatch(/button|wording|overlook/i);
    expect(cta.expectedOutcome).toMatch(/contact|visibility/i);
    expect(cta.estimatedTime).toBe("<10 seconds");
  });
});

describe("score refresh after apply", () => {
  it("recalculates scores after a recommendation is applied", () => {
    const before = sampleProject();
    const report = reviewBusinessProject({ project: before });
    const brandingRec = report.recommendations.find(
      (r) => r.id === "branding.same-accent" || r.scoreCategory === "branding",
    );
    const ctaRec = report.recommendations.find((r) => r.id === "cta.weak-primary");
    const target = brandingRec ?? ctaRec ?? report.recommendations[0]!;

    const applied = applyAdvisorRecommendation({
      project: before,
      recommendation: target,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const afterReport = reviewBusinessProject({ project: applied.project });
    expect(shouldRefreshAdvisorReport(report, applied.project)).toBe(true);
    expect(afterReport.fingerprint).not.toBe(report.fingerprint);

    // At least one scored surface should move, or overall should not stay stuck
    // on the pre-apply fingerprint (scores are deterministic from project).
    const beforeScores = scoreBusinessProject(before);
    const afterScores = scoreBusinessProject(applied.project);
    expect(afterScores).not.toEqual(beforeScores);
  });
});
