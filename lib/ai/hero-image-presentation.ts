/**
 * Hero image fit / crop / composition controls (v1.3).
 */

import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  getActiveVisualTask,
  hasActiveHeroVisualTask,
  type ActiveVisualTask,
} from "@/lib/ai/active-visual-task";
import type { AtlasActionMemory } from "@/lib/ai/atlas-action-memory";
import { hasGalleryLightboxEvidence } from "@/lib/ai/gallery-interaction";
import {
  isExecutableHeroPatternId,
  prepareHeroPatternComposition,
  type ExecutableHeroPatternId,
} from "@/lib/ai/hero-pattern-application";
import type { HeroComposition } from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";

export type HeroImageFit = "cover" | "contain" | "full";
export type HeroImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right";

export type HeroImagePresentation = {
  fit: HeroImageFit;
  focalPoint: { x: number; y: number };
  zoom: number;
  position: HeroImagePosition;
};

export type HeroFitDiagnostics = {
  requestId?: string | null;
  activeVisualTaskKind?: string | null;
  resolvedTarget: "hero" | "unknown";
  pendingClarificationKind?: string | null;
  continuationMatched: boolean;
  selectedOperation: string;
  heroAssetIdBefore?: string | null;
  heroAssetIdAfter?: string | null;
  activeTaskAssetId?: string | null;
  requestedFit?: string | null;
  normalizedFit?: string | null;
  persistedFit?: string | null;
  renderedFit?: string | null;
  heroFitBefore: string;
  heroFitAfter: string;
  heroZoomBefore: number;
  heroZoomAfter: number;
  zoomBefore?: number;
  zoomAfter?: number;
  globalThemeChanged: boolean;
  verified: boolean;
  verificationFailure?: string | null;
};

/**
 * Canonical compare for fit modes.
 * Persist `"full"` for full-picture intent; CSS renders both as `contain`.
 * `"full"` and `"contain"` must never cause a false verification failure.
 */
export function normalizeHeroFitMode(
  fit: HeroImageFit | string | null | undefined,
): "cover" | "full" {
  if (fit === "contain" || fit === "full") return "full";
  return "cover";
}

export function fitsAreEquivalent(
  a: HeroImageFit | string | null | undefined,
  b: HeroImageFit | string | null | undefined,
): boolean {
  return normalizeHeroFitMode(a) === normalizeHeroFitMode(b);
}

const FULL_PICTURE =
  /\b(?:use\s+the\s+(?:full|entire|whole)\s+(?:hero\s+)?(?:picture|photo|image)|show\s+(?:me\s+)?(?:more\s+of\s+)?the\s+(?:full\s+|entire\s+|whole\s+)?(?:hero\s+)?(?:picture|photo|image)|(?:i\s+need\s+to\s+|need\s+to\s+|want\s+to\s+)?see\s+(?:the\s+)?(?:full|entire|whole)\s+(?:hero\s+)?(?:picture|photo|image)|show\s+more\s+of\s+the\s+(?:hero\s+)?(?:photo|image|picture)|don'?t\s+crop(?:\s+it)?|stop\s+cropping|fit\s+the\s+entire\s+(?:image|photo|picture)|full[- ]?photo\s+fit|(?:it'?s|is)\s+being\s+cut\s+off|(?:hero\s+)?(?:image|photo|picture)\s+is\s+(?:being\s+)?(?:cut\s+off|cropped)|(?:being\s+)?cut\s+off)\b/i;

const PHOTO_LED_PATTERNS = new Set<ExecutableHeroPatternId>([
  "hero.cinematic_full_width",
  "hero.coastal_service",
  "hero.contractor_left",
]);

const FILL_CROP =
  /\b(fill\s+the\s+hero|crop\s+it\s+tighter|zoom\s+in|tighter\s+crop)\b/i;

const PROFESSIONAL_HERO =
  /\b((still\s+bad[.!]?\s*)?make\s+it\s+(look\s+)?professional|make\s+the\s+hero\s+(look\s+)?professional|professional\s+hero)\b/i;

const SOFT_VISIBILITY =
  /\b(make\s+the\s+image\s+(a\s+little\s+bit\s+|a\s+little\s+|)\s*(easier\s+to\s+see|clearer|more\s+visible)|make\s+the\s+image\s+clearer\s+while\s+keeping|a\s+little\s+(more\s+)?(visible|easier\s+to\s+see)|still\s+too\s+dark|image\s+is\s+hard\s+to\s+see)\b/i;

export function defaultHeroImagePresentation(): HeroImagePresentation {
  return {
    fit: "cover",
    focalPoint: { x: 0.5, y: 0.5 },
    zoom: 1,
    position: "center",
  };
}

export function readHeroImagePresentation(
  project: BusinessProject,
): HeroImagePresentation {
  const raw = project.heroImagePresentation;
  if (!raw) return defaultHeroImagePresentation();
  return {
    fit: raw.fit === "contain" || raw.fit === "full" ? raw.fit : "cover",
    focalPoint: {
      x: clamp01(raw.focalPoint?.x ?? 0.5),
      y: clamp01(raw.focalPoint?.y ?? 0.5),
    },
    zoom: clampZoom(raw.zoom ?? 1),
    position: normalizePosition(raw.position),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function clampZoom(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(1, Math.round(n * 100) / 100));
}

function normalizePosition(
  value: string | undefined,
): HeroImagePosition {
  if (
    value === "top" ||
    value === "bottom" ||
    value === "left" ||
    value === "right" ||
    value === "center"
  ) {
    return value;
  }
  return "center";
}

export function isHeroFullPictureRequest(request: string): boolean {
  const text = request.trim();
  if (!text || !FULL_PICTURE.test(text)) return false;
  // Gallery lightbox phrases often include “see the full image” — require hero
  // ownership (or no gallery evidence) so they do not steal the gallery turn.
  if (hasGalleryLightboxEvidence(text) && !/\bhero\b/i.test(text)) {
    return false;
  }
  return true;
}

export function isHeroFillCropRequest(request: string): boolean {
  return FILL_CROP.test(request.trim());
}

export function isHeroFitRequest(request: string): boolean {
  return isHeroFullPictureRequest(request) || isHeroFillCropRequest(request);
}

export function isHeroProfessionalCompositionRequest(request: string): boolean {
  return PROFESSIONAL_HERO.test(request.trim());
}

export function isSoftHeroVisibilityRequest(request: string): boolean {
  return SOFT_VISIBILITY.test(request.trim());
}

export function objectFitCss(fit: HeroImageFit): "cover" | "contain" {
  return fit === "cover" ? "cover" : "contain";
}

export function objectPositionCss(presentation: HeroImagePresentation): string {
  const { position, focalPoint } = presentation;
  if (position === "top") return "50% 0%";
  if (position === "bottom") return "50% 100%";
  if (position === "left") return "0% 50%";
  if (position === "right") return "100% 50%";
  return `${Math.round(focalPoint.x * 100)}% ${Math.round(focalPoint.y * 100)}%`;
}

export function planHeroFullPicturePresentation(): HeroImagePresentation {
  return {
    fit: "full",
    focalPoint: { x: 0.5, y: 0.5 },
    zoom: 1,
    position: "center",
  };
}

function activePhotoLedPatternId(
  project: BusinessProject,
): ExecutableHeroPatternId | null {
  const id = project.heroComposition?.patternId;
  if (id && isExecutableHeroPatternId(id) && PHOTO_LED_PATTERNS.has(id)) {
    return id;
  }
  return null;
}

/**
 * Professional full-image policy (P1.6).
 * Photo-led patterns: reveal more via cover + height/focal — never banner contain.
 */
export function planProfessionalHeroFullPicture(input: {
  project: BusinessProject;
}): {
  presentation: HeroImagePresentation;
  operations: EditOperation[];
  professionalCompromise: boolean;
  explanation: string;
  composition: HeroComposition | null;
} {
  const patternId = activePhotoLedPatternId(input.project);
  if (!patternId) {
    const presentation = planHeroFullPicturePresentation();
    return {
      presentation,
      operations: [
        {
          operation: "setHeroImagePresentation",
          fit: presentation.fit,
          focalPoint: presentation.focalPoint,
          zoom: presentation.zoom,
          position: presentation.position,
        },
      ],
      professionalCompromise: false,
      explanation:
        "Done. I changed the hero image to show the full photo instead of cropping it. The text treatment remains localized so the headline stays readable.",
      composition: null,
    };
  }

  const base = input.project.heroComposition!;
  const patched: HeroComposition = {
    ...base,
    patternId,
    minHeight:
      patternId === "hero.cinematic_full_width" ? "viewport" : "tall",
    verticalAlignment:
      patternId === "hero.cinematic_full_width" ? "bottom" : base.verticalAlignment,
    image: {
      ...base.image,
      fit: "cover",
      zoom: 1,
      focalPoint: { x: 0.5, y: 0.42 },
      position: "center",
    },
    treatment: {
      overlay: Math.min(base.treatment.overlay, 25),
      gradient: {
        direction: "bottom",
        strength: 0.38,
        coverage: 0.48,
      },
      textScrim: {
        enabled: true,
        opacity: 0.22,
        blur: 6,
      },
    },
    cta: {
      ...base.cta,
      alignment: base.contentAlignment,
      arrangement: "row",
    },
  };

  const prepared = prepareHeroPatternComposition({
    project: input.project,
    composition: patched,
  });

  const presentation: HeroImagePresentation = {
    fit: "cover",
    focalPoint: prepared.composition.image.focalPoint,
    zoom: prepared.composition.image.zoom,
    position: "center",
  };

  return {
    presentation,
    operations: [
      {
        operation: "applyHeroPattern",
        patternId,
        composition: prepared.composition,
      },
    ],
    professionalCompromise: true,
    explanation:
      "I showed more of the photo while preserving a tall cinematic frame. Displaying every edge would weaken the composition, so I used a lighter crop rather than reducing it to a banner.",
    composition: prepared.composition,
  };
}

export function planHeroFillCropPresentation(
  current: HeroImagePresentation,
): HeroImagePresentation {
  return {
    fit: "cover",
    focalPoint: current.focalPoint,
    zoom: Math.min(1.25, Math.max(1.1, current.zoom > 1 ? current.zoom : 1.15)),
    position: current.position === "center" ? "center" : current.position,
  };
}

export function planHeroFitOperations(input: {
  project: BusinessProject;
  request: string;
  /** Skip target clarification (typed “Hero image” answer or forced hero). */
  forceHero?: boolean;
}): {
  operations: EditOperation[];
  presentation: HeroImagePresentation;
  needsTargetClarification: boolean;
  explanation: string;
  before: HeroImagePresentation;
  alreadySatisfied: boolean;
} {
  const before = readHeroImagePresentation(input.project);
  const memory = input.project.atlasActionMemory as
    | AtlasActionMemory
    | undefined;
  const active = getActiveVisualTask(memory);
  // Canonical project truth + activeTask — never require a current-turn upload.
  const hasHeroAsset = Boolean(
    input.project.heroImageId || active?.assetId,
  );
  const continuation = hasActiveHeroVisualTask(memory);

  // Prefer hero when an active hero task exists, a hero asset is assigned,
  // or the caller already resolved the target (forceHero / clarification).
  const canTargetHero =
    input.forceHero ||
    continuation ||
    hasHeroAsset ||
    Boolean(active?.target === "hero") ||
    Boolean(active?.kind?.startsWith("hero_"));

  if (!canTargetHero && (input.project.mediaLibrary?.length ?? 0) > 0) {
    return {
      operations: [],
      presentation: before,
      needsTargetClarification: true,
      explanation:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      before,
      alreadySatisfied: false,
    };
  }

  if (isHeroFillCropRequest(input.request)) {
    const presentation = planHeroFillCropPresentation(before);
    const alreadySatisfied =
      fitsAreEquivalent(before.fit, presentation.fit) &&
      before.zoom === presentation.zoom &&
      before.position === presentation.position &&
      Math.abs(before.focalPoint.x - presentation.focalPoint.x) < 0.001 &&
      Math.abs(before.focalPoint.y - presentation.focalPoint.y) < 0.001;

    if (alreadySatisfied) {
      return {
        operations: [],
        presentation,
        needsTargetClarification: false,
        explanation: "The hero image is already using the tighter crop.",
        before,
        alreadySatisfied: true,
      };
    }

    return {
      operations: [
        {
          operation: "setHeroImagePresentation",
          fit: presentation.fit,
          focalPoint: presentation.focalPoint,
          zoom: presentation.zoom,
          position: presentation.position,
        },
      ],
      presentation,
      needsTargetClarification: false,
      explanation:
        "Done. I cropped the hero image tighter while keeping the text treatment localized.",
      before,
      alreadySatisfied: false,
    };
  }

  const professional = planProfessionalHeroFullPicture({
    project: input.project,
  });
  const presentation = professional.presentation;

  // Professional compromise: cover + tall frame counts as resolved full-picture intent.
  const alreadySatisfied = professional.professionalCompromise
    ? before.fit === "cover" &&
      before.zoom <= 1.05 &&
      (input.project.heroComposition?.minHeight === "viewport" ||
        input.project.heroComposition?.minHeight === "tall") &&
      (input.project.heroOverlay ?? 50) <= 25 &&
      fitsAreEquivalent(
        input.project.heroComposition?.image.fit,
        "cover",
      )
    : fitsAreEquivalent(before.fit, presentation.fit) &&
      before.zoom === presentation.zoom &&
      before.position === presentation.position &&
      Math.abs(before.focalPoint.x - presentation.focalPoint.x) < 0.001 &&
      Math.abs(before.focalPoint.y - presentation.focalPoint.y) < 0.001;

  if (alreadySatisfied) {
    return {
      operations: [],
      presentation,
      needsTargetClarification: false,
      explanation: professional.professionalCompromise
        ? "The hero already shows more of the photo in a tall cinematic frame — displaying every edge would weaken the composition."
        : "The hero image already shows the full photo — nothing else to change.",
      before,
      alreadySatisfied: true,
    };
  }

  return {
    operations: professional.operations,
    presentation,
    needsTargetClarification: false,
    explanation: professional.explanation,
    before,
    alreadySatisfied: false,
  };
}

/**
 * Hero-scoped “make it professional” — composition only, not global redesign.
 */
export function planHeroProfessionalComposition(input: {
  project: BusinessProject;
  request: string;
}): {
  operations: EditOperation[];
  explanation: string;
  before: HeroImagePresentation;
} {
  const before = readHeroImagePresentation(input.project);
  const presentation = planHeroFullPicturePresentation();
  const operations: EditOperation[] = [
    {
      operation: "setHeroImagePresentation",
      fit: presentation.fit,
      focalPoint: presentation.focalPoint,
      zoom: 1,
      position: "center",
    },
    {
      operation: "setHeroTreatment",
      gradient: {
        direction: "bottom",
        strength: 0.72,
        coverage: 0.58,
      },
      textScrim: {
        enabled: true,
        opacity: 0.4,
        blur: 8,
      },
      textPosition: input.project.heroTreatment?.textPosition ?? "center",
    },
  ];

  // Soften global overlay if it's crushing the photo, without wiping readability.
  const overlay = input.project.heroOverlay ?? 50;
  if (overlay >= 75) {
    operations.unshift({ operation: "setHeroOverlay", value: 50 });
  }

  if (
    !input.project.creativePolish?.visualHierarchy ||
    input.project.creativePolish?.spacing === "default"
  ) {
    operations.push({
      operation: "setCreativePolish",
      visualHierarchy: true,
      spacing: "comfortable",
    });
  }

  return {
    operations,
    before,
    explanation:
      "I refined the hero composition by showing more of the photo, tightening the text block, and keeping contrast behind the copy instead of darkening the entire image.",
  };
}

export function verifyHeroFitChange(input: {
  before: BusinessProject;
  after: BusinessProject;
  intendedFit: HeroImageFit;
  /** When true, already-matching presentation is success (idempotent). */
  allowAlreadySatisfied?: boolean;
}): {
  verified: boolean;
  failures: string[];
  globalThemeChanged: boolean;
} {
  const failures: string[] = [];
  const afterPres = readHeroImagePresentation(input.after);
  const intendedNorm = normalizeHeroFitMode(input.intendedFit);
  const afterNorm = normalizeHeroFitMode(afterPres.fit);

  const beforeAsset = input.before.heroImageId ?? null;
  const afterAsset = input.after.heroImageId ?? null;
  if (beforeAsset !== afterAsset) {
    failures.push("hero_asset_changed");
  }

  // full ↔ contain are equivalent for verification (CSS both render as contain).
  if (afterNorm !== intendedNorm) {
    failures.push("fit_mode_not_applied");
  }

  // Full-picture intent also requires zoom/focal defaults.
  if (intendedNorm === "full") {
    if (afterPres.zoom !== 1) {
      failures.push("zoom_not_applied");
    }
    if (
      Math.abs(afterPres.focalPoint.x - 0.5) > 0.001 ||
      Math.abs(afterPres.focalPoint.y - 0.5) > 0.001
    ) {
      failures.push("focal_point_not_applied");
    }
  }

  // Do not fail merely because the presentation was already correct.
  // Idempotent "Use the entire picture" must succeed when already full.
  void input.allowAlreadySatisfied;

  const globalThemeChanged =
    input.before.primaryColor !== input.after.primaryColor ||
    input.before.accentColor !== input.after.accentColor ||
    input.before.secondaryColor !== input.after.secondaryColor ||
    input.before.backgroundColor !== input.after.backgroundColor ||
    input.before.headingFont !== input.after.headingFont ||
    input.before.bodyFont !== input.after.bodyFont;

  if (globalThemeChanged) failures.push("global_theme_changed");

  return {
    verified: failures.length === 0,
    failures,
    globalThemeChanged,
  };
}

export function explainHeroFitVerificationFailure(input: {
  failures: string[];
  heroImageId: string | null | undefined;
  intendedFit: HeroImageFit;
}): string {
  const hasHero = Boolean(input.heroImageId);
  if (input.failures.includes("hero_asset_changed")) {
    return hasHero
      ? "I kept the current hero image, but the hero asset changed unexpectedly during the fit update. Please try the full-picture request again."
      : "I couldn’t keep the hero image assigned while updating the fit. Upload a hero photo, then ask me to show the full picture.";
  }
  if (
    input.failures.includes("fit_mode_not_applied") ||
    input.failures.includes("zoom_not_applied") ||
    input.failures.includes("focal_point_not_applied")
  ) {
    return hasHero
      ? "I kept the current hero image, but the full-image fit did not persist in Preview."
      : "I couldn’t apply the full-image fit because no hero image is assigned yet. Upload a hero photo, then ask again.";
  }
  if (input.failures.includes("global_theme_changed")) {
    return "I blocked that fit update because it would have changed your brand colors or fonts.";
  }
  return hasHero
    ? "I kept the current hero image, but I couldn’t verify the fit change in Preview."
    : "I couldn’t verify the hero fit change. Assign a hero image first, then ask me to show the full picture.";
}

export function logHeroFitDiagnostics(diagnostics: HeroFitDiagnostics): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:hero-fit]", {
    requestId: diagnostics.requestId ?? null,
    activeVisualTaskKind: diagnostics.activeVisualTaskKind ?? null,
    resolvedTarget: diagnostics.resolvedTarget,
    pendingClarificationKind: diagnostics.pendingClarificationKind ?? null,
    continuationMatched: diagnostics.continuationMatched,
    selectedOperation: diagnostics.selectedOperation,
    heroAssetIdBefore: diagnostics.heroAssetIdBefore ?? null,
    heroAssetIdAfter: diagnostics.heroAssetIdAfter ?? null,
    activeTaskAssetId: diagnostics.activeTaskAssetId ?? null,
    requestedFit: diagnostics.requestedFit ?? diagnostics.heroFitAfter,
    normalizedFit:
      diagnostics.normalizedFit ??
      normalizeHeroFitMode(diagnostics.heroFitAfter),
    persistedFit: diagnostics.persistedFit ?? diagnostics.heroFitAfter,
    renderedFit:
      diagnostics.renderedFit ??
      objectFitCss(
        normalizeHeroFitMode(diagnostics.heroFitAfter) === "full"
          ? "full"
          : "cover",
      ),
    heroFitBefore: diagnostics.heroFitBefore,
    heroFitAfter: diagnostics.heroFitAfter,
    heroZoomBefore: diagnostics.heroZoomBefore,
    heroZoomAfter: diagnostics.heroZoomAfter,
    zoomBefore: diagnostics.zoomBefore ?? diagnostics.heroZoomBefore,
    zoomAfter: diagnostics.zoomAfter ?? diagnostics.heroZoomAfter,
    globalThemeChanged: diagnostics.globalThemeChanged,
    verified: diagnostics.verified,
    verificationFailure: diagnostics.verificationFailure ?? null,
  });
}

export function activeTaskKindLabel(
  task: ActiveVisualTask | null,
): string | null {
  return task?.kind ?? null;
}
