/**
 * Deterministic pattern selection from strategy / website context.
 */

import { getDesignPatternsByCategory } from "@/lib/ai/design-patterns/registry";
import type {
  DesignPattern,
  DesignPatternCategory,
  DesignPatternSelectionContext,
  IndustryAffinityTag,
} from "@/lib/ai/design-patterns/types";
import type { DesignAgencyTone } from "@/lib/ai/design-strategy-types";

function contextBlob(ctx: DesignPatternSelectionContext): string {
  return [
    ctx.industry,
    ctx.businessType,
    ctx.businessDescription,
    ctx.audience,
    ctx.primaryGoal,
    ctx.designLanguage,
    ctx.businessTone,
    ctx.request,
    ...(ctx.agencyTones ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function inferIndustryAffinityTags(
  ctx: DesignPatternSelectionContext,
): IndustryAffinityTag[] {
  const blob = contextBlob(ctx);
  const tags: IndustryAffinityTag[] = ["general"];
  const push = (t: IndustryAffinityTag) => {
    if (!tags.includes(t)) tags.push(t);
  };

  if (/landscape|lawn|garden|outdoor|yard|hardscape/.test(blob)) {
    push("landscaping");
    push("local_service");
  }
  if (/contractor|plumb|electr|hvac|roof|build|renovat|trade/.test(blob)) {
    push("contractor");
    push("local_service");
  }
  if (/restaurant|dining|cafe|bistro|bar\b|food/.test(blob)) {
    push("restaurant");
  }
  if (/luxur|estate|boutique|fine\s+dining|jewel/.test(blob)) {
    push("luxury");
  }
  if (/coastal|beach|harbor|seaside|waterfront/.test(blob)) {
    push("coastal");
  }
  if (/legal|clinic|medical|financ|consult|advisor|account/.test(blob)) {
    push("professional_services");
  }
  if (/retail|shop|store|boutique/.test(blob)) push("retail");
  if (/salon|spa|beauty|barber/.test(blob)) push("salon");
  if (/real\s+estate|realtor|property/.test(blob)) push("real_estate");
  if (/portfolio|photographer|studio|gallery|design\s+studio/.test(blob)) {
    push("portfolio");
  }
  if (/local|neighborhood|hometown/.test(blob)) push("local_service");

  return tags;
}

function assetReady(pattern: DesignPattern, ctx: DesignPatternSelectionContext): boolean {
  const needs = pattern.requiredAssets.filter((a) => a !== "none");
  if (needs.length === 0) return true;
  const hasHero = Boolean(ctx.hasHeroImage);
  const gallery = ctx.galleryFilledSlots ?? 0;
  const library = ctx.libraryCount ?? 0;

  for (const need of needs) {
    if (need === "hero_photo" || need === "aerial_photo") {
      if (!hasHero && library === 0) return false;
    }
    if (
      need === "project_photos" ||
      need === "before_after" ||
      need === "team_photo"
    ) {
      if (gallery === 0 && library < 2) return false;
    }
  }
  return true;
}

function avoidTriggered(pattern: DesignPattern, ctx: DesignPatternSelectionContext): boolean {
  const blob = contextBlob(ctx);
  for (const rule of pattern.avoidWhen) {
    if (rule === "no_hero_image" && !ctx.hasHeroImage && (ctx.libraryCount ?? 0) === 0) {
      return true;
    }
    if (rule === "no_reviews" && !ctx.hasTestimonials) return true;
    if (rule === "few_photos" && (ctx.galleryFilledSlots ?? 0) < 2) return true;
    if (rule === "no_before_after_assets" && /before|after/.test(pattern.id)) {
      // soft: only hard-avoid when library is empty
      if ((ctx.libraryCount ?? 0) < 2) return true;
    }
    if (rule === "playful_brand" && (ctx.agencyTones ?? []).includes("playful")) {
      if (pattern.brandAffinity.includes("luxury")) return true;
    }
    if (rule === "luxury_only_brand" && /luxur/.test(blob) && !/contractor|landscape/.test(blob)) {
      if (pattern.id.includes("contractor")) return true;
    }
    if (rule === "non_restaurant" && pattern.id.includes("reserve")) {
      if (!/restaurant|dining|cafe/.test(blob)) return true;
    }
  }
  return false;
}

export function scorePatternForContext(
  pattern: DesignPattern,
  ctx: DesignPatternSelectionContext,
): number {
  if (avoidTriggered(pattern, ctx)) return 0;
  if (!assetReady(pattern, ctx)) return 0.05;

  const tags = inferIndustryAffinityTags(ctx);
  const tones: DesignAgencyTone[] = ctx.agencyTones?.length
    ? ctx.agencyTones
    : [];

  let score = 0.2;
  const industryHits = pattern.industryAffinity.filter(
    (t) => t === "general" || tags.includes(t),
  ).length;
  score += Math.min(0.35, industryHits * 0.12);

  if (tones.length) {
    const toneHits = pattern.brandAffinity.filter((t) => tones.includes(t)).length;
    score += Math.min(0.3, toneHits * 0.1);
  }

  if (pattern.purpose.includes("drive_conversion") && /lead|quote|customer|book/.test(contextBlob(ctx))) {
    score += 0.08;
  }
  if (pattern.purpose.includes("show_work") && (ctx.galleryFilledSlots ?? 0) > 0) {
    score += 0.08;
  }
  if (pattern.purpose.includes("premium_positioning") && tones.includes("luxury")) {
    score += 0.1;
  }

  score += pattern.conversionStrength * 0.1;
  return Math.max(0, Math.min(1, score));
}

export function selectCandidatePatterns(
  category: DesignPatternCategory,
  ctx: DesignPatternSelectionContext,
  limit = 5,
): DesignPattern[] {
  return getDesignPatternsByCategory(category)
    .map((p) => ({ p, s: scorePatternForContext(p, ctx) }))
    .filter((x) => x.s > 0.08)
    .sort((a, b) => b.s - a.s || a.p.id.localeCompare(b.p.id))
    .slice(0, limit)
    .map((x) => x.p);
}

export function selectTopPattern(
  category: DesignPatternCategory,
  ctx: DesignPatternSelectionContext,
): DesignPattern | null {
  return selectCandidatePatterns(category, ctx, 1)[0] ?? null;
}
