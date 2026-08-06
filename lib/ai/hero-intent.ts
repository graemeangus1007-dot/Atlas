/**
 * P1.6 — Hero vs gallery intent ownership helpers.
 * No interaction-state schema changes.
 */

import type { AtlasActiveTask } from "@/lib/ai/atlas-interaction-types";
import { isGalleryLightboxRequest } from "@/lib/ai/gallery-interaction";
import {
  isHeroFitRequest,
  isSoftHeroVisibilityRequest,
} from "@/lib/ai/hero-image-presentation";
import { isHeroReadabilityRequest } from "@/lib/ai/hero-readability";
import { isHeroImageVisibilityComplaint } from "@/lib/ai/hero-visual-balance";

/** Explicit gallery signals required for gallery interaction ownership. */
export const GALLERY_EVIDENCE =
  /\b(gallery|thumbnail|photo\s+grid|lightbox|click\s+(a\s+|the\s+|one\s+of\s+the\s+)?(gallery\s+)?(photos?|images?)|open\s+gallery|visitors?\s+click|people\s+click|let\s+(people|visitors)\s+(click|swipe))\b/i;

export function hasGalleryEvidence(request: string): boolean {
  return GALLERY_EVIDENCE.test(request.trim());
}

const HERO_PATTERN_CUE =
  /\b(cinematic|coastal|contractor|premium\s+minimal|hero\s+pattern|use\s+a\s+\w+\s+hero|make\s+this\s+a\s+\w+\s+hero)\b/i;

export function mentionsHero(request: string): boolean {
  return /\bhero\b/i.test(request.trim());
}

/** Grey / covering treatment complaints scoped to the hero photo. */
export function isHeroGreyAreaComplaint(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(grey|gray)\b[\s\S]{0,40}\b(area|layer|block|band|bar|wash|overlay|covering|cover(ing)?)\b/i.test(
      text,
    ) ||
    /\b(get\s+rid\s+of|remove|clear|kill)\b[\s\S]{0,40}\b(grey|gray|overlay|layer|wash|scrim)\b/i.test(
      text,
    ) ||
    /\b(covering|covering\s+the|covers?\s+the)\b[\s\S]{0,24}\b(hero|image|photo|picture)\b/i.test(
      text,
    ) ||
    /\b(overlay|scrim|gradient)\b[\s\S]{0,24}\b(hiding|covering|hiding\s+the)\b/i.test(
      text,
    ) ||
    /\b(still\s+looks?\s+like\s+a\s+(grey|gray)\s+block)\b/i.test(text)
  );
}

export function isActiveHeroTask(
  task: AtlasActiveTask | null | undefined,
): boolean {
  return Boolean(task?.kind?.startsWith("hero_"));
}

/**
 * Hero-domain request: fit, readability, grey treatment, pattern, or hero mention
 * with photo/visibility language.
 */
export function isHeroDomainRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  // Gallery-owned requests are never hero-domain (even if they say “full image”).
  if (galleryMayOwnRequest(text) && !mentionsHero(text)) return false;
  if (isHeroFitRequest(text)) return true;
  if (isHeroReadabilityRequest(text)) return true;
  if (isHeroImageVisibilityComplaint(text)) return true;
  if (isSoftHeroVisibilityRequest(text)) return true;
  if (isHeroGreyAreaComplaint(text)) return true;
  if (HERO_PATTERN_CUE.test(text)) return true;
  if (
    mentionsHero(text) &&
    /\b(image|photo|picture|overlay|crop|fit|composition|readable|prominen|cover|grey|gray)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  // Bare full-picture language without gallery evidence
  if (
    /\b(see|show|use|need)\b[\s\S]{0,24}\b(the\s+)?(full|entire|whole)\s+(picture|photo|image)\b/i.test(
      text,
    ) &&
    !hasGalleryEvidence(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Gallery lightbox may own the turn only with gallery evidence (and not hero-only).
 */
export function galleryMayOwnRequest(request: string): boolean {
  if (!isGalleryLightboxRequest(request)) return false;
  if (mentionsHero(request) && !hasGalleryEvidence(request)) return false;
  return true;
}

export type HeroIntentDiagnostics = {
  requestId?: string | null;
  activeTaskKind: string | null;
  heroIntentMatched: boolean;
  galleryIntentMatched: boolean;
  galleryEvidence: boolean;
  continuationOwner: "hero" | "gallery" | "none";
  greyAreaSource: string | null;
};

export function buildHeroIntentDiagnostics(input: {
  request: string;
  activeTask: AtlasActiveTask | null | undefined;
  requestId?: string | null;
  greyAreaSource?: string | null;
}): HeroIntentDiagnostics {
  const heroIntentMatched = isHeroDomainRequest(input.request);
  const galleryEvidence = hasGalleryEvidence(input.request);
  const galleryIntentMatched = galleryMayOwnRequest(input.request);
  let continuationOwner: "hero" | "gallery" | "none" = "none";
  if (isActiveHeroTask(input.activeTask) && heroIntentMatched) {
    continuationOwner = "hero";
  } else if (galleryIntentMatched) {
    continuationOwner = "gallery";
  } else if (isActiveHeroTask(input.activeTask)) {
    continuationOwner = "hero";
  }
  return {
    requestId: input.requestId ?? null,
    activeTaskKind: input.activeTask?.kind ?? null,
    heroIntentMatched,
    galleryIntentMatched,
    galleryEvidence,
    continuationOwner,
    greyAreaSource: input.greyAreaSource ?? null,
  };
}

export function logHeroIntentDiagnostics(
  diagnostics: HeroIntentDiagnostics,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:hero-intent]", diagnostics);
}

/**
 * Deterministic diagnosis of the grey region from composition/render fields.
 */
export function diagnoseGreyAreaSource(project: {
  heroOverlay?: number;
  heroTreatment?: {
    textScrim?: { enabled?: boolean; opacity?: number } | null;
    gradient?: { coverage?: number; strength?: number } | null;
  };
  heroImagePresentation?: { fit?: string } | null;
  heroComposition?: {
    minHeight?: string;
    image?: { fit?: string };
    treatment?: {
      overlay?: number;
      textScrim?: { enabled?: boolean; opacity?: number } | null;
      gradient?: { coverage?: number; strength?: number } | null;
    };
  } | null;
}): string {
  const fit =
    project.heroComposition?.image?.fit ??
    project.heroImagePresentation?.fit ??
    "cover";
  const overlay =
    project.heroComposition?.treatment?.overlay ?? project.heroOverlay ?? 50;
  const scrim =
    project.heroComposition?.treatment?.textScrim ??
    project.heroTreatment?.textScrim;
  const gradient =
    project.heroComposition?.treatment?.gradient ??
    project.heroTreatment?.gradient;

  if (fit === "contain" || fit === "full") {
    return "contain_letterbox_exposes_site_bg";
  }
  if (overlay >= 50) {
    return "global_hero_overlay_wash";
  }
  if (scrim?.enabled && (scrim.opacity ?? 0) >= 0.28) {
    return "text_scrim_coverage";
  }
  if (gradient && (gradient.coverage ?? 0) >= 0.6 && (gradient.strength ?? 0) >= 0.4) {
    return "directional_gradient_coverage";
  }
  if (
    project.heroComposition?.minHeight === "viewport" &&
    (fit === "contain" || fit === "full")
  ) {
    return "tall_frame_with_contained_image";
  }
  return "localized_treatment_or_background";
}
