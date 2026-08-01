/**
 * Deterministic selection & ranking of design principles for a site context.
 * Never inject the entire registry into prompts — select a curated subset.
 */

import {
  getDesignPrincipleById,
  listAllDesignPrinciples,
} from "@/lib/ai/design-knowledge/registry";
import type {
  DesignKnowledgeAppliesTo,
  DesignKnowledgeEvidence,
  DesignKnowledgeSelectionContext,
  DesignPrinciple,
  RankedDesignPrinciple,
} from "@/lib/ai/design-knowledge/types";

/** Max principles injected into critique prompts (token control). */
export const MAX_PROMPT_DESIGN_PRINCIPLES = 8;

/** Max principles retained on strategy for ranking/evidence. */
export const MAX_STRATEGY_DESIGN_PRINCIPLES = 12;

const IMPACT_WEIGHT = { high: 30, medium: 18, low: 8 } as const;

function normalizeBlob(parts: Array<string | undefined | null>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function inferPageTypes(
  context: DesignKnowledgeSelectionContext,
): DesignKnowledgeAppliesTo[] {
  const blob = normalizeBlob([
    context.industry,
    context.businessType,
    context.pageType,
    context.request,
  ]);
  const types: DesignKnowledgeAppliesTo[] = ["all", "homepage"];

  if (/portfolio|photographer|studio|gallery|architect/.test(blob)) {
    types.push("portfolio");
  }
  if (
    /landscap|plumb|hvac|roof|lawn|local|contractor|bakery|salon|cafe|restaurant|home\s*service/.test(
      blob,
    )
  ) {
    types.push("local-business");
    types.push("service-business");
  } else if (
    /legal|law|clinic|medical|dental|financ|consult|advisor|agency|service/.test(
      blob,
    )
  ) {
    types.push("service-business");
  }
  if (/landing|campaign|promo/.test(blob)) {
    types.push("landing-page");
  }
  if (context.mobile) types.push("mobile");
  return types;
}

function weaknessTokens(context: DesignKnowledgeSelectionContext): string[] {
  const tokens: string[] = [...(context.detectedWeaknesses ?? [])];
  if (!context.hasHeroImage) {
    tokens.push("no hero image", "missing imagery", "placeholder hero");
  }
  if (!context.hasTestimonials) {
    tokens.push("no testimonials", "trust gap", "proof missing");
  }
  if ((context.galleryFilledSlots ?? 0) === 0) {
    tokens.push("gallery empty", "project gallery");
  }
  if (context.libraryCount === 0 && !context.hasHeroImage) {
    tokens.push("generic stock", "authentic photos");
  }
  if (!context.visualHierarchy) {
    tokens.push("visual hierarchy", "flat hierarchy", "weak heading scale");
  }
  if (!context.spacing || context.spacing === "default") {
    tokens.push("default spacing", "cramped", "spacing");
  }
  if (context.lowContrast) {
    tokens.push("low contrast", "low button contrast", "unreadable");
  }
  if (context.longParagraphs) {
    tokens.push("long paragraphs", "dense copy", "wide measure");
  }
  if (context.weakHeadingScale) {
    tokens.push("weak heading scale", "flat typography");
  }
  if (context.weakCtaHierarchy || context.secondaryCtaCompeting) {
    tokens.push("weak cta hierarchy", "competing buttons", "cta");
  }
  if ((context.heroCopyLength ?? 0) > 220) {
    tokens.push("long hero", "message overload");
  }
  if ((context.overallCompleteness ?? 100) < 55) {
    tokens.push("incomplete", "draft");
  }
  if (context.mobile) {
    tokens.push("mobile", "tap targets");
  }
  if (/quote|estimate|book|contact|lead|convert/.test(context.primaryGoal ?? "")) {
    tokens.push("request a quote", "conversion", "primary goal");
  }
  if (context.request) {
    tokens.push(context.request.toLowerCase());
  }
  return tokens.map((t) => t.toLowerCase());
}

function appliesToContext(
  principle: DesignPrinciple,
  pageTypes: DesignKnowledgeAppliesTo[],
): boolean {
  return principle.appliesTo.some(
    (a) => a === "all" || pageTypes.includes(a),
  );
}

function scorePrinciple(
  principle: DesignPrinciple,
  context: DesignKnowledgeSelectionContext,
  pageTypes: DesignKnowledgeAppliesTo[],
  weakness: string[],
): RankedDesignPrinciple {
  if (!appliesToContext(principle, pageTypes)) {
    return { principle, score: -1, matchedSignals: [] };
  }

  let score = IMPACT_WEIGHT[principle.impact];
  const matchedSignals: string[] = [];
  const weaknessBlob = weakness.join(" ");
  const industryBlob = normalizeBlob([
    context.industry,
    context.businessType,
    context.audience,
    context.designLanguage,
    context.businessTone,
    context.primaryGoal,
  ]);

  for (const signal of principle.signals) {
    const s = signal.toLowerCase();
    if (weaknessBlob.includes(s) || industryBlob.includes(s)) {
      score += 14;
      matchedSignals.push(signal);
    } else if (weakness.some((w) => w.includes(s) || s.includes(w))) {
      score += 10;
      matchedSignals.push(signal);
    }
  }

  // Industry / goal nudges (deterministic, bounded).
  if (
    pageTypes.includes("local-business") &&
    (principle.category === "imagery" ||
      principle.category === "trust" ||
      principle.id.includes("hero") ||
      principle.id.includes("local"))
  ) {
    score += 8;
  }
  if (
    pageTypes.includes("service-business") &&
    (principle.category === "typography" ||
      principle.category === "conversion" ||
      principle.category === "accessibility")
  ) {
    score += 4;
  }
  if (
    pageTypes.includes("portfolio") &&
    (principle.category === "imagery" || principle.category === "layout")
  ) {
    score += 6;
  }
  if (
    /lead|quote|estimat|book|contact|convert/.test(
      (context.primaryGoal ?? "").toLowerCase(),
    ) &&
    (principle.category === "conversion" || principle.category === "trust")
  ) {
    score += 6;
  }
  if (context.mobile && principle.appliesTo.includes("mobile")) {
    score += 10;
  }
  if (context.lowContrast && principle.category === "accessibility") {
    score += 12;
  }
  if (context.lowContrast && principle.category === "color") {
    score += 10;
  }
  if (
    (!context.hasHeroImage || (context.galleryFilledSlots ?? 0) === 0) &&
    principle.category === "imagery"
  ) {
    score += 10;
  }
  if (!context.hasTestimonials && principle.category === "trust") {
    score += 10;
  }
  if (context.weakCtaHierarchy || context.secondaryCtaCompeting) {
    if (
      principle.id === "homepage.one_dominant_cta" ||
      principle.id === "hierarchy.cta_prominence" ||
      principle.id === "homepage.restrained_secondary_actions"
    ) {
      score += 18;
    } else if (
      principle.category === "homepage" ||
      principle.category === "hierarchy" ||
      principle.category === "conversion"
    ) {
      score += 8;
    }
  }
  if (context.longParagraphs || context.weakHeadingScale) {
    if (
      principle.id === "typography.scannable_emphasis" ||
      principle.id === "typography.clear_heading_hierarchy" ||
      principle.id === "typography.controlled_paragraph_width"
    ) {
      score += 16;
    } else if (principle.category === "typography") {
      score += 10;
    }
  }
  if (!context.hasHeroImage) {
    if (
      principle.id === "homepage.purposeful_hero_imagery" ||
      principle.id === "imagery.authentic_over_stock" ||
      principle.id === "trust.real_project_photography"
    ) {
      score += 14;
    }
  }
  if (!context.hasTestimonials) {
    if (
      principle.id === "trust.proof_before_high_commitment" ||
      principle.id === "homepage.trust_near_first_ask" ||
      principle.id === "conversion.sequence_before_ask"
    ) {
      score += 14;
    }
  }

  // Mild caution penalty when context contradicts cautions (portfolio text-first).
  if (
    pageTypes.includes("portfolio") &&
    principle.id === "homepage.purposeful_hero_imagery"
  ) {
    score -= 6;
  }

  return { principle, score, matchedSignals };
}

/**
 * Rank all applicable principles for a context (deterministic).
 */
export function rankDesignPrinciples(
  principles: DesignPrinciple[],
  context: DesignKnowledgeSelectionContext,
): RankedDesignPrinciple[] {
  const pageTypes = inferPageTypes(context);
  const weakness = weaknessTokens(context);
  return principles
    .map((p) => scorePrinciple(p, context, pageTypes, weakness))
    .filter((r) => r.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.principle.id.localeCompare(b.principle.id);
    });
}

/**
 * Select the most relevant principles — never the full registry.
 */
export function selectRelevantDesignPrinciples(
  context: DesignKnowledgeSelectionContext,
  options: { limit?: number } = {},
): DesignPrinciple[] {
  const limit = options.limit ?? MAX_STRATEGY_DESIGN_PRINCIPLES;
  const ranked = rankDesignPrinciples(listAllDesignPrinciples(), context);
  return ranked.slice(0, limit).map((r) => r.principle);
}

/** Build selection context from common strategy/critique fields. */
export function designKnowledgeContextFromParts(input: {
  industry?: string;
  businessType?: string;
  audience?: string;
  primaryGoal?: string;
  designLanguage?: string;
  businessTone?: string;
  enabledSections?: string[];
  sectionOrder?: string[];
  hasHeroImage?: boolean;
  hasTestimonials?: boolean;
  hasFaq?: boolean;
  galleryFilledSlots?: number;
  libraryCount?: number;
  spacing?: string;
  visualHierarchy?: boolean;
  maturityLevel?: string;
  overallCompleteness?: number;
  request?: string;
  viewportHint?: string;
  secondaryCta?: string;
  heroTitle?: string;
  heroDescription?: string;
  detectedWeaknesses?: string[];
  lowContrast?: boolean;
  longParagraphs?: boolean;
  weakHeadingScale?: boolean;
}): DesignKnowledgeSelectionContext {
  const heroCopyLength =
    (input.heroTitle?.length ?? 0) + (input.heroDescription?.length ?? 0);
  const mobile = /mobile|phone|small/i.test(input.viewportHint ?? "");
  const aboutLong = (input.heroDescription?.length ?? 0) > 180;
  return {
    industry: input.industry,
    businessType: input.businessType,
    audience: input.audience,
    primaryGoal: input.primaryGoal,
    designLanguage: input.designLanguage,
    businessTone: input.businessTone,
    enabledSections: input.enabledSections,
    sectionOrder: input.sectionOrder,
    hasHeroImage: input.hasHeroImage,
    hasTestimonials: input.hasTestimonials,
    hasFaq: input.hasFaq,
    galleryFilledSlots: input.galleryFilledSlots,
    libraryCount: input.libraryCount,
    spacing: input.spacing,
    visualHierarchy: input.visualHierarchy,
    maturityLevel: input.maturityLevel,
    overallCompleteness: input.overallCompleteness,
    request: input.request,
    mobile,
    secondaryCtaCompeting: Boolean(input.secondaryCta?.trim()),
    heroCopyLength,
    longParagraphs: input.longParagraphs ?? aboutLong,
    weakHeadingScale: input.weakHeadingScale ?? input.visualHierarchy === false,
    weakCtaHierarchy: input.visualHierarchy === false,
    lowContrast: input.lowContrast,
    detectedWeaknesses: input.detectedWeaknesses,
  };
}

/** Internal evidence rows from selected principles + observed signals. */
export function buildDesignKnowledgeEvidence(
  principles: DesignPrinciple[],
  context: DesignKnowledgeSelectionContext,
  limit = 8,
): DesignKnowledgeEvidence[] {
  const ranked = rankDesignPrinciples(principles, context).slice(0, limit);
  return ranked.map((r) => ({
    principleId: r.principle.id,
    observedSignal: r.matchedSignals[0] ?? r.principle.signals[0] ?? "context",
    affectedArea: r.principle.category,
    confidence: Math.min(0.95, 0.55 + r.score / 200),
  }));
}

/**
 * Score how well an improvement/action string matches selected principles.
 * Used for recommendation prioritization (foundational > decorative).
 */
export function scoreActionAgainstPrinciples(
  actionText: string,
  principles: DesignPrinciple[],
): number {
  const hay = actionText.toLowerCase();
  let score = 0;
  for (const p of principles) {
    const impact = IMPACT_WEIGHT[p.impact];
    for (const action of p.recommendedActions) {
      const tokens = action.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      const hits = tokens.filter((t) => hay.includes(t)).length;
      if (hits >= 2 || hay.includes(action.toLowerCase())) {
        score += impact;
      } else if (hits === 1) {
        score += Math.floor(impact / 3);
      }
    }
    for (const signal of p.signals) {
      if (hay.includes(signal.toLowerCase())) score += 4;
    }
    // Foundational categories beat decorative motion/polish.
    if (
      (p.category === "homepage" ||
        p.category === "trust" ||
        p.category === "accessibility" ||
        p.category === "conversion") &&
      /hero|proof|testimonial|contrast|cta|trust/.test(hay)
    ) {
      score += 6;
    }
    if (p.id === "hierarchy.foundational_before_decorative" && /motion|hover|animat/.test(hay)) {
      score -= 20;
    }
  }
  return score;
}

/** Match improvement text to principle IDs for evidence attachment. */
export function matchPrinciplesToText(
  text: string,
  principleIds: string[],
  limit = 3,
): DesignKnowledgeEvidence[] {
  const principles = principleIds
    .map((id) => getDesignPrincipleById(id))
    .filter((p): p is DesignPrinciple => Boolean(p));
  const hay = text.toLowerCase();
  const scored = principles
    .map((p) => {
      let score = 0;
      for (const s of p.signals) {
        if (hay.includes(s.toLowerCase())) score += 8;
      }
      for (const a of p.recommendedActions) {
        if (hay.includes(a.toLowerCase().slice(0, 12))) score += 6;
      }
      if (hay.includes(p.category)) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));

  return scored.slice(0, limit).map((x) => ({
    principleId: x.p.id,
    observedSignal:
      x.p.signals.find((s) => hay.includes(s.toLowerCase())) ?? x.p.signals[0]!,
    affectedArea: x.p.category,
    confidence: Math.min(0.92, 0.5 + x.score / 40),
  }));
}

/**
 * Concise prompt guidance — titles + principles only, no IDs, capped.
 */
export function formatDesignPrinciplesForPrompt(
  principles: DesignPrinciple[],
  options: { limit?: number } = {},
): string {
  const limit = options.limit ?? MAX_PROMPT_DESIGN_PRINCIPLES;
  const selected = principles.slice(0, limit);
  if (selected.length === 0) return "";
  const lines = selected.map(
    (p, i) =>
      `${i + 1}. ${p.title}: ${p.principle} (Why it matters: ${p.reasoning})`,
  );
  return [
    "Applicable design judgment (use to ground recommendations in this site’s state — do not paste these lines verbatim, do not invent principle IDs, and do not list principles unused by the actual page):",
    ...lines,
  ].join("\n");
}

/** True if text leaks internal principle identifiers. */
export function textExposesDesignPrincipleIds(text: string): boolean {
  if (!text) return false;
  if (/according to principle/i.test(text)) return true;
  if (/\bprinciple\s+[a-z]+[._][a-z0-9_]+\b/i.test(text)) return true;
  // category.id pattern from our registry
  return DESIGN_KNOWLEDGE_CATEGORIES_FOR_LEAK.some((cat) =>
    new RegExp(`\\b${cat}\\.[a-z0-9_]+\\b`, "i").test(text),
  );
}

const DESIGN_KNOWLEDGE_CATEGORIES_FOR_LEAK = [
  "homepage",
  "typography",
  "spacing",
  "layout",
  "hierarchy",
  "trust",
  "color",
  "imagery",
  "conversion",
  "accessibility",
  "branding",
] as const;
