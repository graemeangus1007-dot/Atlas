/**
 * Hero Composition Evaluator (P1.5) — scores the whole hero as one design.
 */

import type { HeroComposition, HeroMinHeight } from "@/lib/hero-composition/types";
import type { BusinessProject } from "@/types/business-project";

export const HERO_COMPOSITION_PASS_THRESHOLD = 68;

/** Pattern-specific image-impact floors (P1.6). Cinematic is stricter. */
export const IMAGE_IMPACT_FLOOR: Record<string, number> = {
  "hero.cinematic_full_width": 72,
  "hero.coastal_service": 64,
  "hero.contractor_left": 64,
  "hero.premium_minimal": 48,
};

export type HeroImageAspectClass =
  | "panoramic"
  | "landscape"
  | "square"
  | "portrait"
  | "unknown";

export type HeroCompositionProblem =
  | "hero_too_shallow"
  | "detached_cta"
  | "floating_copy"
  | "overlay_abuse"
  | "dead_whitespace"
  | "weak_focal_point"
  | "mobile_collapse"
  | "banner_strip_contain"
  | "bright_unsafe_text"
  | "centered_on_busy_image"
  | "heavy_coastal"
  | "contractor_not_left"
  | "minimal_empty"
  | "weak_hierarchy"
  | "shallow_image_strip"
  | "image_utilization_too_low"
  | "content_detached_from_image"
  | "cta_detached_from_copy"
  | "dead_overlay_region"
  | "headline_on_visual_boundary"
  | "cinematic_pattern_not_cinematic"
  | "contain_mode_breaks_composition"
  | "excessive_non_image_hero_area"
  | "weak_first_impression";

export type HeroCompositionAdjustment =
  | "increase_hero_height"
  | "lower_text_block"
  | "tighten_content_width"
  | "widen_content_width"
  | "localize_contrast"
  | "reduce_global_overlay"
  | "strengthen_scrim"
  | "strengthen_gradient"
  | "group_cta"
  | "align_cta_with_copy"
  | "rebalance_focal_point"
  | "scale_heading"
  | "improve_mobile_stack"
  | "prefer_cover_fit";

export type HeroCompositionEvaluation = {
  overallScore: number;
  imageImpact: number;
  readability: number;
  balance: number;
  hierarchy: number;
  whitespace: number;
  ctaVisibility: number;
  mobileScore: number;
  visualFocus: number;
  firstImpression: number;
  problems: HeroCompositionProblem[];
  suggestedAdjustments: HeroCompositionAdjustment[];
  aspectClass: HeroImageAspectClass;
  heroHeightDecision: string;
  safeZoneDecision: string;
};

export type EvaluateHeroCompositionInput = {
  composition: HeroComposition;
  project: Pick<
    BusinessProject,
    | "heroHeadline"
    | "heroSubheadline"
    | "primaryCta"
    | "secondaryCta"
    | "heroImageId"
    | "mediaLibrary"
    | "heroOverlay"
  >;
  /** Optional override for tests / analysis. */
  aspectRatio?: number | null;
  viewport?: "desktop" | "mobile";
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function heightRank(h: HeroMinHeight): number {
  switch (h) {
    case "short":
      return 1;
    case "medium":
      return 2;
    case "tall":
      return 3;
    case "viewport":
      return 4;
    default:
      return 2;
  }
}

export function classifyImageAspect(ratio: number | null | undefined): HeroImageAspectClass {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return "unknown";
  if (ratio >= 2.1) return "panoramic";
  if (ratio >= 1.25) return "landscape";
  if (ratio >= 0.85) return "square";
  return "portrait";
}

export function readHeroImageAspectRatio(
  project: Pick<BusinessProject, "heroImageId" | "mediaLibrary">,
): number | null {
  if (!project.heroImageId) return null;
  const asset = project.mediaLibrary.find((a) => a.id === project.heroImageId);
  if (!asset?.width || !asset?.height || asset.height <= 0) return null;
  return asset.width / asset.height;
}

function hasImage(
  project: EvaluateHeroCompositionInput["project"],
): boolean {
  if (!project.heroImageId) return false;
  return project.mediaLibrary.some(
    (a) => a.id === project.heroImageId && Boolean(a.url),
  );
}

/**
 * Score a coordinated hero composition for professional visual quality.
 */
export function evaluateHeroComposition(
  input: EvaluateHeroCompositionInput,
): HeroCompositionEvaluation {
  const { composition: c } = input;
  const viewport = input.viewport ?? "desktop";
  const ratio =
    input.aspectRatio ?? readHeroImageAspectRatio(input.project);
  const aspectClass = classifyImageAspect(ratio);
  const image = hasImage(input.project);
  const headlineLen = (input.project.heroHeadline || "").trim().length;
  const subLen = (input.project.heroSubheadline || "").trim().length;
  const ctaLen = (input.project.primaryCta || "").trim().length;
  const pattern = c.patternId ?? "";
  const problems: HeroCompositionProblem[] = [];
  const suggested: HeroCompositionAdjustment[] = [];

  let heroHeightDecision = `height=${c.minHeight}`;
  let safeZoneDecision = "default";

  // --- Image impact ---
  let imageImpact = image ? 72 : 48;
  const containFit = c.image.fit === "contain";

  // Contain inside a tall frame letterboxes → grey dead region (production failure).
  if (image && containFit && heightRank(c.minHeight) >= 3) {
    imageImpact -= 36;
    problems.push("contain_mode_breaks_composition");
    problems.push("excessive_non_image_hero_area");
    problems.push("shallow_image_strip");
    problems.push("image_utilization_too_low");
    suggested.push("prefer_cover_fit");
    suggested.push("increase_hero_height");
    heroHeightDecision = "reject_contain_letterbox_in_tall_frame";
  }
  if (image && containFit && heightRank(c.minHeight) <= 2) {
    imageImpact -= 32;
    problems.push("banner_strip_contain");
    problems.push("shallow_image_strip");
    problems.push("hero_too_shallow");
    problems.push("image_utilization_too_low");
    suggested.push("increase_hero_height");
    suggested.push("prefer_cover_fit");
    heroHeightDecision = "reject_shallow_contain_banner";
  }
  if (aspectClass === "panoramic" && heightRank(c.minHeight) < 3) {
    imageImpact -= 22;
    problems.push("hero_too_shallow");
    problems.push("shallow_image_strip");
    suggested.push("increase_hero_height");
    heroHeightDecision = "panoramic_needs_taller_frame";
  }
  if (aspectClass === "panoramic" && heightRank(c.minHeight) >= 3) {
    imageImpact += 10;
    heroHeightDecision = "panoramic_tall_ok";
  }
  if (aspectClass === "portrait" && c.image.fit === "cover") {
    imageImpact += 6;
  }
  if (c.image.fit === "cover" && c.minHeight === "viewport") {
    imageImpact += 8;
  }
  // Only cinematic must stay tall; coastal/contractor may use medium frames.
  if (pattern === "hero.cinematic_full_width" && heightRank(c.minHeight) <= 2) {
    imageImpact -= 24;
    problems.push("shallow_image_strip");
    problems.push("image_utilization_too_low");
    suggested.push("increase_hero_height");
  }

  // --- Readability / local contrast ---
  let readability = 70;
  const overlay = c.treatment.overlay;
  const hasScrim = Boolean(c.treatment.textScrim?.enabled);
  const hasGradient = Boolean(
    c.treatment.gradient && c.treatment.gradient.strength > 0.15,
  );
  if (image && overlay >= 75) {
    readability -= 16;
    problems.push("overlay_abuse");
    problems.push("dead_overlay_region");
    suggested.push("localize_contrast");
    suggested.push("reduce_global_overlay");
  } else if (image && overlay >= 50 && !hasScrim && !hasGradient) {
    readability -= 12;
    problems.push("overlay_abuse");
    problems.push("dead_overlay_region");
    suggested.push("localize_contrast");
    suggested.push("reduce_global_overlay");
  }
  const gradientCoverage = c.treatment.gradient?.coverage ?? 0;
  const gradientStrength = c.treatment.gradient?.strength ?? 0;
  // Broad wash: global overlay + wide gradient covering most of the photo.
  if (
    image &&
    overlay >= 40 &&
    gradientCoverage >= 0.6 &&
    gradientStrength >= 0.45
  ) {
    imageImpact -= 14;
    problems.push("dead_overlay_region");
    suggested.push("localize_contrast");
  }
  if (image && overlay <= 15 && !hasScrim && !hasGradient) {
    readability -= 18;
    problems.push("bright_unsafe_text");
    suggested.push("strengthen_scrim");
    suggested.push("strengthen_gradient");
  }
  if (hasScrim || hasGradient) {
    readability += 12;
    safeZoneDecision = hasScrim
      ? "local_scrim_preferred"
      : "directional_gradient_preferred";
  }
  if (c.verticalAlignment === "bottom" && (hasScrim || hasGradient)) {
    readability += 6;
    safeZoneDecision = "lower_third_safe_zone";
  }
  if (
    image &&
    c.contentAlignment === "center" &&
    c.verticalAlignment === "center" &&
    !hasScrim &&
    pattern === "hero.cinematic_full_width"
  ) {
    readability -= 10;
    problems.push("centered_on_busy_image");
    suggested.push("lower_text_block");
    suggested.push("localize_contrast");
  }

  // --- Balance / whitespace ---
  let balance = 72;
  let whitespace = 70;
  if (c.minHeight === "short" && (headlineLen > 48 || subLen > 120)) {
    balance -= 14;
    whitespace -= 10;
    problems.push("hero_too_shallow");
    suggested.push("increase_hero_height");
  }
  if (
    c.contentWidth === "wide" &&
    c.contentAlignment === "center" &&
    c.verticalAlignment === "top"
  ) {
    problems.push("floating_copy");
    balance -= 12;
    suggested.push("lower_text_block");
  }
  if (c.minHeight === "viewport" && c.contentWidth === "narrow" && !image) {
    whitespace -= 16;
    problems.push("dead_whitespace");
    suggested.push("widen_content_width");
  }
  if (pattern === "hero.premium_minimal") {
    whitespace += 10;
    if (c.minHeight === "viewport" || c.typography.headingScale === "xl") {
      whitespace -= 12;
      problems.push("dead_whitespace");
      suggested.push("scale_heading");
    }
    if (c.accents.showAccentWash || c.accents.showGrid) {
      balance -= 8;
    }
  }
  if (pattern === "hero.coastal_service" && overlay >= 50) {
    problems.push("heavy_coastal");
    balance -= 12;
    suggested.push("reduce_global_overlay");
  }

  // --- Hierarchy / focus ---
  let hierarchy = 70;
  let visualFocus = 68;
  if (c.typography.headingScale === "xl" || c.typography.headingScale === "lg") {
    hierarchy += 8;
    visualFocus += 6;
  }
  if (headlineLen > 80 && c.typography.headingScale === "xl") {
    hierarchy -= 10;
    problems.push("weak_hierarchy");
    suggested.push("scale_heading");
  }
  if (headlineLen < 12 && pattern !== "hero.premium_minimal") {
    visualFocus -= 8;
    problems.push("weak_focal_point");
  }
  if (c.verticalAlignment === "center" && c.minHeight === "short") {
    visualFocus -= 10;
    problems.push("weak_focal_point");
  }
  if (pattern === "hero.contractor_left" && c.contentAlignment !== "left") {
    problems.push("contractor_not_left");
    hierarchy -= 16;
    suggested.push("align_cta_with_copy");
  }

  // --- CTA ---
  let ctaVisibility = ctaLen > 0 ? 74 : 20;
  if (ctaLen === 0) {
    problems.push("detached_cta");
  }
  if (c.cta.alignment !== c.contentAlignment) {
    ctaVisibility -= 14;
    problems.push("detached_cta");
    problems.push("cta_detached_from_copy");
    suggested.push("align_cta_with_copy");
    suggested.push("group_cta");
  }
  if (c.cta.primaryEmphasis === "strong") ctaVisibility += 6;
  if (c.cta.primaryEmphasis === "quiet" && pattern === "hero.premium_minimal") {
    ctaVisibility += 4;
  }
  if (c.verticalAlignment === "top" && c.minHeight === "viewport") {
    ctaVisibility -= 10;
    problems.push("detached_cta");
    problems.push("content_detached_from_image");
    problems.push("headline_on_visual_boundary");
    suggested.push("lower_text_block");
  }
  // Content sits on the image/letterbox boundary (contain + bottom or center).
  if (image && containFit && c.verticalAlignment !== "bottom") {
    balance -= 16;
    problems.push("headline_on_visual_boundary");
    problems.push("content_detached_from_image");
    suggested.push("lower_text_block");
    suggested.push("prefer_cover_fit");
  }
  if (
    image &&
    containFit &&
    c.verticalAlignment === "bottom" &&
    heightRank(c.minHeight) >= 3
  ) {
    // Text sits in the grey band under the contained strip.
    balance -= 20;
    problems.push("content_detached_from_image");
    problems.push("headline_on_visual_boundary");
    problems.push("cta_detached_from_copy");
    problems.push("excessive_non_image_hero_area");
  }
  if (ctaLen > 28) {
    ctaVisibility -= 6;
    suggested.push("group_cta");
  }

  // --- Mobile ---
  let mobileScore = 76;
  if (viewport === "mobile" && c.minHeight === "viewport") {
    mobileScore -= 6;
  }
  if (
    c.mobile.layout === "keep_overlay" &&
    c.layout === "split"
  ) {
    mobileScore -= 12;
    problems.push("mobile_collapse");
    suggested.push("improve_mobile_stack");
  }
  if (
    pattern === "hero.contractor_left" &&
    c.mobile.layout !== "stack_copy_first"
  ) {
    mobileScore -= 10;
    problems.push("mobile_collapse");
    suggested.push("improve_mobile_stack");
  }
  if (c.mobile.minHeight === "short" && aspectClass === "panoramic") {
    mobileScore -= 12;
    problems.push("mobile_collapse");
    suggested.push("increase_hero_height");
  }

  // Pattern-specific first impression boosts/penalties
  let firstImpression = 70;
  if (
    image &&
    containFit &&
    c.verticalAlignment === "bottom" &&
    heightRank(c.minHeight) >= 3
  ) {
    firstImpression -= 22;
    problems.push("weak_first_impression");
  }
  if (pattern === "hero.cinematic_full_width") {
    if (
      heightRank(c.minHeight) >= 3 &&
      c.verticalAlignment !== "top" &&
      !containFit
    ) {
      firstImpression += 12;
    } else {
      firstImpression -= 18;
      problems.push("cinematic_pattern_not_cinematic");
      problems.push("weak_first_impression");
      if (!problems.includes("hero_too_shallow") && heightRank(c.minHeight) < 3) {
        problems.push("hero_too_shallow");
      }
    }
    if (containFit) {
      firstImpression -= 16;
      imageImpact -= 10;
      problems.push("cinematic_pattern_not_cinematic");
    }
  }
  if (pattern === "hero.coastal_service" && overlay <= 25 && hasGradient) {
    firstImpression += 8;
  }
  if (pattern === "hero.contractor_left" && c.contentAlignment === "left") {
    firstImpression += 10;
  }
  if (pattern === "hero.premium_minimal") {
    if (c.minHeight === "short" || c.minHeight === "medium") {
      firstImpression += 8;
    }
    if (!image && c.treatment.overlay === 0) {
      firstImpression += 4;
    }
    if (problems.includes("dead_whitespace")) {
      firstImpression -= 12;
      problems.push("minimal_empty");
    }
  }

  imageImpact = clampScore(imageImpact);
  readability = clampScore(readability);
  balance = clampScore(balance);
  hierarchy = clampScore(hierarchy);
  whitespace = clampScore(whitespace);
  ctaVisibility = clampScore(ctaVisibility);
  mobileScore = clampScore(mobileScore);
  visualFocus = clampScore(visualFocus);
  firstImpression = clampScore(firstImpression);

  const overallScore = clampScore(
    imageImpact * 0.16 +
      readability * 0.16 +
      balance * 0.12 +
      hierarchy * 0.12 +
      whitespace * 0.1 +
      ctaVisibility * 0.12 +
      mobileScore * 0.08 +
      visualFocus * 0.07 +
      firstImpression * 0.07,
  );

  // Deduplicate suggestions
  const suggestedAdjustments = [...new Set(suggested)];

  return {
    overallScore,
    imageImpact,
    readability,
    balance,
    hierarchy,
    whitespace,
    ctaVisibility,
    mobileScore,
    visualFocus,
    firstImpression,
    problems: [...new Set(problems)],
    suggestedAdjustments,
    aspectClass,
    heroHeightDecision,
    safeZoneDecision,
  };
}

export function compositionScorePasses(score: number): boolean {
  return score >= HERO_COMPOSITION_PASS_THRESHOLD;
}
