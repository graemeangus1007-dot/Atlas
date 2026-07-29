/**
 * Atlas Business Advisor + Critique Engine (Sprint 23.0A / 23.1).
 * Proactively reviews a BusinessProject and returns scored, ranked improvements.
 */

import { DEFAULT_ADVISOR_MODULES } from "@/lib/ai/advisor-modules";
import type {
  AdvisorFinding,
  AdvisorImpact,
  AdvisorModule,
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
import { explainAdvisorFinding, critiqueCategoryForFinding } from "@/lib/ai/critique-explanations";
import { scoreBusinessProject } from "@/lib/ai/critique-scoring";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";

export const ADVISOR_TOP_N = 5;

const IMPACT_RANK: Record<AdvisorImpact, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export type ReviewBusinessProjectInput = {
  project: BusinessProject;
  history?: Array<Pick<EditorConversationMessage, "role" | "content">>;
  /** Override / extend the default module pipeline (future advisors). */
  modules?: AdvisorModule[];
  limit?: number;
};

/**
 * Compact fingerprint of review-relevant project fields.
 * Used to refresh recommendations only when the site meaningfully changes.
 */
export function advisorProjectFingerprint(project: BusinessProject): string {
  const slice = {
    businessName: project.businessName,
    heroHeadline: project.heroHeadline,
    heroSubheadline: project.heroSubheadline,
    primaryCta: project.primaryCta,
    description: project.description,
    aboutTitle: project.aboutTitle ?? "",
    contact: {
      title: project.contact.title,
      description: project.contact.description,
      phone: project.contact.phone,
      buttonText: project.contact.buttonText ?? "",
    },
    seo: project.seo
      ? {
          siteTitle: project.seo.siteTitle,
          metaDescription: project.seo.metaDescription,
        }
      : null,
    primaryColor: project.primaryColor,
    accentColor: project.accentColor,
    backgroundColor: project.backgroundColor,
    headingFont: project.headingFont,
    bodyFont: project.bodyFont,
    buttonStyle: project.buttonStyle,
    siteWidth: project.siteWidth,
    theme: project.theme,
    templateId: project.templateId,
    pages: project.pages.map((p) => p.title),
    designSections: project.designSections
      ? {
          enabled: project.designSections.enabled,
          hasTestimonials: Boolean(project.designSections.testimonials?.length),
          hasFaq: Boolean(project.designSections.faq?.length),
        }
      : null,
  };
  return JSON.stringify(slice);
}

/**
 * Suppress duplicate findings (same id) — keeps the higher-scoring copy.
 */
export function suppressDuplicateFindings(
  findings: AdvisorFinding[],
): AdvisorFinding[] {
  const byId = new Map<string, AdvisorFinding>();
  for (const finding of findings) {
    const existing = byId.get(finding.id);
    if (!existing || finding.impactScore > existing.impactScore) {
      byId.set(finding.id, finding);
    }
  }
  return [...byId.values()];
}

/**
 * Rank by expected impact, then confidence, then stable id.
 */
export function rankAdvisorFindings(
  findings: AdvisorFinding[],
): AdvisorFinding[] {
  return [...findings].sort((a, b) => {
    const impactDelta = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
    if (impactDelta !== 0) return impactDelta;
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.id.localeCompare(b.id);
  });
}

export function limitTopRecommendations<T>(items: T[], limit = ADVISOR_TOP_N): T[] {
  return items.slice(0, Math.max(0, limit));
}

function toRecommendation(finding: AdvisorFinding): BusinessRecommendation {
  const explanation = explainAdvisorFinding(finding);
  return {
    id: finding.id,
    category: finding.category,
    title: finding.title,
    why: explanation.whyItMatters,
    noticed: explanation.noticed,
    whyItMatters: explanation.whyItMatters,
    expectedOutcome: explanation.expectedOutcome,
    estimatedTime: explanation.estimatedTime,
    impact: finding.impact,
    impactScore: finding.impactScore,
    confidence: finding.confidence,
    operations: finding.operations,
    destructive: Boolean(finding.destructive),
    narrative: explanation.noticed,
    scoreCategory: critiqueCategoryForFinding(finding.category),
  };
}

function buildSummary(
  recs: BusinessRecommendation[],
  overallScore: number,
): string {
  if (recs.length === 0) {
    return `Your site scores ${overallScore}/100 — I don’t see any urgent improvements right now.`;
  }
  const top = recs[0]!;
  if (recs.length === 1) {
    return `Your site scores ${overallScore}/100. ${top.noticed} ${top.whyItMatters}`;
  }
  return `Your site scores ${overallScore}/100. I found ${recs.length} high-leverage opportunities — starting with: ${top.title.toLowerCase()}.`;
}

/**
 * Create a review pipeline from advisor modules (future-ready plug-in point).
 */
export function createAdvisorPipeline(modules: AdvisorModule[]) {
  return function runPipeline(input: ReviewBusinessProjectInput): BusinessAdvisorReport {
    const active = modules.length > 0 ? modules : DEFAULT_ADVISOR_MODULES;
    const ctx = {
      project: input.project,
      history: input.history,
    };

    const collected: AdvisorFinding[] = [];
    for (const mod of active) {
      try {
        collected.push(...mod.review(ctx));
      } catch {
        // A single module failure must not break the whole review.
      }
    }

    const deduped = suppressDuplicateFindings(collected);
    const ranked = rankAdvisorFindings(deduped);
    const top = limitTopRecommendations(
      ranked,
      input.limit ?? ADVISOR_TOP_N,
    ).map(toRecommendation);

    const scores = scoreBusinessProject(input.project);

    return {
      overallScore: scores.overall,
      categoryScores: scores.categories,
      recommendations: top,
      summary: buildSummary(top, scores.overall),
      reviewedAt: new Date().toISOString(),
      fingerprint: advisorProjectFingerprint(input.project),
    };
  };
}

const defaultPipeline = createAdvisorPipeline(DEFAULT_ADVISOR_MODULES);

/**
 * Review the current website and return a scored Atlas Critique report.
 */
export function reviewBusinessProject(
  input: ReviewBusinessProjectInput,
): BusinessAdvisorReport {
  if (input.modules && input.modules.length > 0) {
    return createAdvisorPipeline(input.modules)(input);
  }
  return defaultPipeline(input);
}

/**
 * True when a new review should replace the previous recommendation set.
 */
export function shouldRefreshAdvisorReport(
  previous: BusinessAdvisorReport | null | undefined,
  project: BusinessProject,
): boolean {
  if (!previous) return true;
  return previous.fingerprint !== advisorProjectFingerprint(project);
}
