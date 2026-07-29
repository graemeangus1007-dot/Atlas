/**
 * Atlas Business Advisor (Sprint 23.0A).
 * Proactively reviews a BusinessProject and returns ranked, one-click improvements.
 */

import { DEFAULT_ADVISOR_MODULES } from "@/lib/ai/advisor-modules";
import type {
  AdvisorFinding,
  AdvisorImpact,
  AdvisorModule,
  BusinessAdvisorReport,
  BusinessRecommendation,
} from "@/lib/ai/business-advisor-types";
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

function narrativeFor(finding: AdvisorFinding): string {
  switch (finding.category) {
    case "conversion":
      return `I noticed a conversion opportunity: ${finding.title.toLowerCase()}.`;
    case "trust":
      return `You could improve trust here — ${finding.title.toLowerCase()}.`;
    case "seo":
      return `I recommend a quick SEO win: ${finding.title.toLowerCase()}.`;
    case "accessibility":
      return `I noticed an accessibility gap: ${finding.title.toLowerCase()}.`;
    case "cta_effectiveness":
      return `Your calls to action could work harder — ${finding.title.toLowerCase()}.`;
    case "missing_sections":
      return `I recommend filling a content gap: ${finding.title.toLowerCase()}.`;
    case "readability":
      return `For easier reading, ${finding.title.toLowerCase()}.`;
    case "mobile_usability":
      return `On mobile, ${finding.title.toLowerCase()}.`;
    case "visual_hierarchy":
      return `I noticed the visual hierarchy could be clearer — ${finding.title.toLowerCase()}.`;
    case "branding_consistency":
      return `For stronger branding, ${finding.title.toLowerCase()}.`;
    default:
      return `I recommend: ${finding.title}.`;
  }
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
  return {
    id: finding.id,
    category: finding.category,
    title: finding.title,
    why: finding.why,
    impact: finding.impact,
    impactScore: finding.impactScore,
    confidence: finding.confidence,
    operations: finding.operations,
    destructive: Boolean(finding.destructive),
    narrative: narrativeFor(finding),
  };
}

function buildSummary(recs: BusinessRecommendation[]): string {
  if (recs.length === 0) {
    return "Looking good for now — I don’t see any urgent improvements.";
  }
  const top = recs[0]!;
  if (recs.length === 1) {
    return `${top.narrative} ${top.why}`;
  }
  return `I noticed ${recs.length} ways to strengthen this site. Top of the list: ${top.title.toLowerCase()}.`;
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

    return {
      recommendations: top,
      summary: buildSummary(top),
      reviewedAt: new Date().toISOString(),
      fingerprint: advisorProjectFingerprint(input.project),
    };
  };
}

const defaultPipeline = createAdvisorPipeline(DEFAULT_ADVISOR_MODULES);

/**
 * Review the current website and return the top prioritized recommendations.
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
