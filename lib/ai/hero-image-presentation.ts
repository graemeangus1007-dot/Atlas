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
  heroFitBefore: string;
  heroFitAfter: string;
  heroZoomBefore: number;
  heroZoomAfter: number;
  globalThemeChanged: boolean;
  verified: boolean;
};

const FULL_PICTURE =
  /\b(use\s+the\s+full\s+picture|show\s+the\s+whole\s+(photo|image|picture)|don'?t\s+crop(\s+it)?|fit\s+the\s+entire\s+(image|photo|picture)|show\s+the\s+full\s+(photo|image|picture)|full[- ]?photo\s+fit)\b/i;

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
  return FULL_PICTURE.test(request.trim());
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
}): {
  operations: EditOperation[];
  presentation: HeroImagePresentation;
  needsTargetClarification: boolean;
  explanation: string;
  before: HeroImagePresentation;
} {
  const before = readHeroImagePresentation(input.project);
  const memory = input.project.atlasActionMemory as
    | AtlasActionMemory
    | undefined;
  const active = getActiveVisualTask(memory);
  const hasHeroAsset = Boolean(input.project.heroImageId);
  const continuation = hasActiveHeroVisualTask(memory);

  // Prefer hero when an active hero task exists or a hero asset is assigned.
  const canTargetHero = continuation || hasHeroAsset || Boolean(active);

  if (!canTargetHero && (input.project.mediaLibrary?.length ?? 0) > 0) {
    return {
      operations: [],
      presentation: before,
      needsTargetClarification: true,
      explanation:
        "Which image should use the full-photo fit: the hero image or a gallery image?",
      before,
    };
  }

  const presentation = isHeroFillCropRequest(input.request)
    ? planHeroFillCropPresentation(before)
    : planHeroFullPicturePresentation();

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
    explanation: isHeroFillCropRequest(input.request)
      ? "Done. I cropped the hero image tighter while keeping the text treatment localized."
      : "Done. I changed the hero image to show the full photo instead of cropping it. The text treatment remains localized so the headline stays readable.",
    before,
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
}): {
  verified: boolean;
  failures: string[];
  globalThemeChanged: boolean;
} {
  const failures: string[] = [];
  const beforePres = readHeroImagePresentation(input.before);
  const afterPres = readHeroImagePresentation(input.after);

  if (
    (input.before.heroImageId ?? null) !== (input.after.heroImageId ?? null)
  ) {
    failures.push("hero_asset_changed");
  }
  if (afterPres.fit !== input.intendedFit) {
    failures.push("fit_mode_not_applied");
  }
  if (
    afterPres.fit === beforePres.fit &&
    afterPres.zoom === beforePres.zoom &&
    afterPres.position === beforePres.position
  ) {
    failures.push("presentation_unchanged");
  }

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

export function logHeroFitDiagnostics(diagnostics: HeroFitDiagnostics): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:hero-fit]", {
    requestId: diagnostics.requestId ?? null,
    activeVisualTaskKind: diagnostics.activeVisualTaskKind ?? null,
    resolvedTarget: diagnostics.resolvedTarget,
    pendingClarificationKind: diagnostics.pendingClarificationKind ?? null,
    continuationMatched: diagnostics.continuationMatched,
    selectedOperation: diagnostics.selectedOperation,
    heroFitBefore: diagnostics.heroFitBefore,
    heroFitAfter: diagnostics.heroFitAfter,
    heroZoomBefore: diagnostics.heroZoomBefore,
    heroZoomAfter: diagnostics.heroZoomAfter,
    globalThemeChanged: diagnostics.globalThemeChanged,
    verified: diagnostics.verified,
  });
}

export function activeTaskKindLabel(
  task: ActiveVisualTask | null,
): string | null {
  return task?.kind ?? null;
}
