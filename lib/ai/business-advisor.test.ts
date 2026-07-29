/**
 * Sprint 23.0A — Atlas Business Advisor regression tests.
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
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.explanation).toContain(rec.title);
  });

  it("rejects destructive recommendations without confirmation", () => {
    const recommendation: BusinessRecommendation = {
      id: "destructive.demo",
      category: "conversion",
      title: "Remove FAQ",
      why: "test",
      impact: "low",
      impactScore: 10,
      confidence: 0.5,
      destructive: true,
      narrative: "I recommend removing FAQ.",
      operations: [{ operation: "removeSection", type: "faq" }],
    };

    const blocked = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.message).toMatch(/confirmation/i);

    const allowed = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation,
      confirmDestructive: true,
    });
    expect(allowed.ok).toBe(true);
  });

  it("rejects recommendations with no operations", () => {
    const result = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation: {
        id: "empty",
        category: "seo",
        title: "Think about SEO",
        why: "advice only",
        impact: "low",
        impactScore: 1,
        confidence: 0.4,
        destructive: false,
        narrative: "I noticed an SEO opportunity.",
        operations: [],
      },
    });
    expect(result.ok).toBe(false);
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
