/**
 * Sprint 23.0A bugfix — Advisor Apply lifecycle + FAQ persistence.
 */

import { describe, expect, it } from "vitest";
import { applyAdvisorRecommendation } from "@/lib/ai/apply-advisor-recommendation";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import {
  reviewBusinessProject,
  shouldRefreshAdvisorReport,
} from "@/lib/ai/business-advisor";
import type { BusinessRecommendation } from "@/lib/ai/business-advisor-types";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { generateWebsiteContent } from "@/lib/website-generator";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";

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
    designSections: undefined,
    publish: null,
  };
}

describe("second recommendation applies successfully", () => {
  it("applies the ranked #2 opportunity with a visible project change", () => {
    const project = sampleProject();
    const report = reviewBusinessProject({ project });
    expect(report.recommendations.length).toBeGreaterThanOrEqual(2);

    const second = report.recommendations[1]!;
    const result = applyAdvisorRecommendation({
      project,
      recommendation: second,
      requestId: "test-second-rec",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("applied");
    expect(result.requestId).toBe("test-second-rec");
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.project).not.toEqual(project);
  });
});

describe("FAQ insertion renders and persists", () => {
  it("populates FAQ content even when an empty faq array already exists", () => {
    const project = {
      ...sampleProject(),
      designSections: {
        enabled: [] as Array<"testimonials" | "faq" | "gallery" | "pricing">,
        faq: [],
        testimonials: [],
      },
    };

    const recommendation: BusinessRecommendation = {
      id: "sections.faq",
      category: "missing_sections",
      title: "Add an FAQ section",
      why: "Answering common questions early reduces hesitation and support friction.",
      noticed: "There’s no FAQ section yet.",
      whyItMatters: "Unanswered questions create hesitation.",
      expectedOutcome: "Fewer objections and smoother paths to contact.",
      estimatedTime: "~30 seconds",
      impact: "medium",
      impactScore: 72,
      confidence: 0.84,
      destructive: false,
      narrative: "There’s no FAQ section yet.",
      scoreCategory: "trust",
      operations: validateEditOperations([
        { operation: "insertSection", type: "faq" },
      ]),
    };

    const result = applyAdvisorRecommendation({
      project,
      recommendation,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("applied");
    expect(result.project.designSections?.enabled).toContain("faq");
    expect(result.project.designSections?.faq?.length).toBeGreaterThan(0);

    const content = generateWebsiteContent(result.project);
    expect(content.designSections?.enabled).toContain("faq");
    expect(content.designSections?.faq?.length).toBeGreaterThan(0);

    const artifact = buildStaticSite(result.project);
    const html = artifact.files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toMatch(/Frequently asked questions|faq/i);
    expect(html).toMatch(/How do I get started/i);
  });
});

describe("failed apply shows an error", () => {
  it("returns failed status with a safe message and request id", () => {
    const result = applyAdvisorRecommendation({
      project: sampleProject(),
      recommendation: {
        id: "broken",
        category: "seo",
        title: "Broken",
        why: "x",
        noticed: "x",
        whyItMatters: "x",
        expectedOutcome: "x",
        estimatedTime: "<10 seconds",
        impact: "low",
        impactScore: 1,
        confidence: 0.5,
        destructive: false,
        narrative: "x",
        scoreCategory: "seo",
        operations: [{ operation: "replaceText", target: "secret.key", value: "no" }],
      } as unknown as BusinessRecommendation,
      requestId: "test-fail-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe("failed");
    expect(result.requestId).toBe("test-fail-1");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message).not.toMatch(/api[_-]?key|secret token/i);
  });
});

describe("no-op apply reports No visible change", () => {
  it("detects empty-array insertSection that used to claim success without content", () => {
    // After the empty-array fix, a second identical apply is a true no-op.
    const seeded = applyEditOperations(sampleProject(), [
      { operation: "insertSection", type: "faq" },
    ]).project;

    const faqRec = reviewBusinessProject({
      project: {
        ...seeded,
        // Force the FAQ finding back by clearing content while leaving enabled —
        // then re-apply with operations that no longer change the fingerprint.
        designSections: {
          enabled: ["faq"],
          faq: seeded.designSections?.faq,
        },
      },
    }).recommendations.find((r) => r.id === "sections.faq");

    // Prefer a deterministic no-op: apply FAQ ops to a project that already has FAQ.
    const recommendation: BusinessRecommendation = {
      id: "sections.faq",
      category: "missing_sections",
      title: "Add an FAQ section",
      why: "why",
      noticed: "noticed",
      whyItMatters: "why",
      expectedOutcome: "outcome",
      estimatedTime: "~30 seconds",
      impact: "medium",
      impactScore: 72,
      confidence: 0.84,
      destructive: false,
      narrative: "noticed",
      scoreCategory: "trust",
      operations: validateEditOperations([
        { operation: "insertSection", type: "faq" },
      ]),
    };

    const result = applyAdvisorRecommendation({
      project: seeded,
      recommendation,
      requestId: "test-noop-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("no_visible_change");
    expect(result.explanation).toMatch(/No visible change/i);
    expect(result.requestId).toBe("test-noop-1");
    expect(result.changes).toHaveLength(0);
    expect(faqRec).toBeUndefined();
  });
});

describe("satisfied recommendation disappears after refresh", () => {
  it("removes the applied recommendation from the next review", () => {
    const before = sampleProject();
    const report = reviewBusinessProject({ project: before });
    const target =
      report.recommendations.find((r) => r.id === "trust.testimonials") ??
      report.recommendations.find((r) => r.id === "sections.faq") ??
      report.recommendations[0]!;

    const applied = applyAdvisorRecommendation({
      project: before,
      recommendation: target,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.status).toBe("applied");

    expect(shouldRefreshAdvisorReport(report, applied.project)).toBe(true);
    const refreshed = reviewBusinessProject({ project: applied.project });
    expect(refreshed.recommendations.some((r) => r.id === target.id)).toBe(
      false,
    );
  });
});
