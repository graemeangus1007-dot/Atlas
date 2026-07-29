/**
 * Atlas Critique Engine — deterministic website scoring (Sprint 23.1).
 * Scores are pure functions of project state so refreshes stay stable.
 */

import { contrastRatio, meetsWcagAa } from "@/lib/ai/contrast";
import { SEO_DESCRIPTION_MAX } from "@/lib/seo/types";
import type { BusinessProject } from "@/types/business-project";

export const CRITIQUE_SCORE_CATEGORIES = [
  "conversion",
  "trust",
  "seo",
  "accessibility",
  "mobile",
  "branding",
] as const;

export type CritiqueScoreCategory = (typeof CRITIQUE_SCORE_CATEGORIES)[number];

export type CritiqueCategoryScores = Record<CritiqueScoreCategory, number>;

export type CritiqueScoreBreakdown = {
  overall: number;
  categories: CritiqueCategoryScores;
};

/** Category weights for the overall site score (sum = 1). */
export const CRITIQUE_CATEGORY_WEIGHTS: Record<CritiqueScoreCategory, number> = {
  conversion: 0.24,
  trust: 0.18,
  seo: 0.16,
  accessibility: 0.16,
  mobile: 0.12,
  branding: 0.14,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function phoneLooksWeak(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 7;
}

function ctaLooksWeak(cta: string): boolean {
  const t = cta.trim().toLowerCase();
  if (!t) return true;
  return (
    t === "learn more" ||
    t === "click here" ||
    t === "submit" ||
    t === "ok" ||
    t.length < 3
  );
}

function scoreConversion(project: BusinessProject): number {
  let score = 100;
  const phone = project.contact.phone?.trim() || "";

  if (phoneLooksWeak(phone)) score -= 22;
  if (
    phone &&
    !/call|phone|tel/i.test(project.heroSubheadline + project.primaryCta)
  ) {
    score -= 18;
  }
  if (ctaLooksWeak(project.primaryCta)) score -= 16;
  const button = project.contact.buttonText?.trim() || "";
  if (!button || /submit|send|ok/i.test(button)) score -= 8;
  return clampScore(score);
}

function scoreTrust(project: BusinessProject): number {
  let score = 100;
  const enabled = project.designSections?.enabled ?? [];
  const hasTestimonials =
    enabled.includes("testimonials") &&
    (project.designSections?.testimonials?.length ?? 0) > 0;
  if (!hasTestimonials) score -= 24;
  if ((project.description?.trim().length || 0) < 80) score -= 14;
  const hasFaq =
    enabled.includes("faq") &&
    (project.designSections?.faq?.length ?? 0) > 0;
  if (!hasFaq) score -= 10;
  return clampScore(score);
}

function scoreSeo(project: BusinessProject): number {
  let score = 100;
  const title = project.seo?.siteTitle?.trim() || "";
  const description = project.seo?.metaDescription?.trim() || "";

  if (!title || title === project.businessName || title.length < 12) {
    score -= 22;
  }
  if (!description || description.length < 70) score -= 18;
  if (description.length > SEO_DESCRIPTION_MAX) score -= 6;
  return clampScore(score);
}

function scoreAccessibility(project: BusinessProject): number {
  let score = 100;
  const fg = "#ffffff";
  const accent = project.accentColor || project.primaryColor;
  if (!meetsWcagAa(fg, accent)) {
    const ratio = contrastRatio(fg, accent) ?? 0;
    // Lower contrast → larger, deterministic deduction.
    score -= clampScore(28 + Math.max(0, 4.5 - ratio) * 6);
  }
  return clampScore(score);
}

function scoreMobile(project: BusinessProject): number {
  let score = 100;
  if (project.buttonStyle === "square" && project.siteWidth === "full") {
    score -= 16;
  }
  if (project.siteWidth === "full" && project.heroSubheadline.length > 180) {
    score -= 12;
  }
  if (project.pages.some((p) => p.title.length > 14)) score -= 8;
  return clampScore(score);
}

function scoreBranding(project: BusinessProject): number {
  let score = 100;
  const primary = project.primaryColor?.toLowerCase() || "";
  const accent = project.accentColor?.toLowerCase() || "";
  if (primary && accent && primary === accent) score -= 20;
  if (
    project.headingFont === project.bodyFont &&
    project.headingFont === "inter"
  ) {
    score -= 14;
  }
  return clampScore(score);
}

const CATEGORY_SCORERS: Record<
  CritiqueScoreCategory,
  (project: BusinessProject) => number
> = {
  conversion: scoreConversion,
  trust: scoreTrust,
  seo: scoreSeo,
  accessibility: scoreAccessibility,
  mobile: scoreMobile,
  branding: scoreBranding,
};

/**
 * Deterministic category + overall scores from the current project.
 * Same project → same scores across refreshes.
 */
export function scoreBusinessProject(
  project: BusinessProject,
): CritiqueScoreBreakdown {
  const categories = {} as CritiqueCategoryScores;
  let weighted = 0;

  for (const key of CRITIQUE_SCORE_CATEGORIES) {
    const value = CATEGORY_SCORERS[key](project);
    categories[key] = value;
    weighted += value * CRITIQUE_CATEGORY_WEIGHTS[key];
  }

  return {
    overall: clampScore(weighted),
    categories,
  };
}

/** Human labels for the Atlas Review UI. */
export const CRITIQUE_CATEGORY_LABELS: Record<CritiqueScoreCategory, string> = {
  conversion: "Conversion",
  trust: "Trust",
  seo: "SEO",
  accessibility: "Accessibility",
  mobile: "Mobile",
  branding: "Branding",
};
