/**
 * Metadata-first image analysis for Visual Composition.
 * No ML / segmentation. Future pixel analysis merges via pixelAnalysis hints.
 */

import type {
  CompositionAnalysisInput,
  SubjectRegion,
  VisualCompositionPixelHints,
} from "@/lib/composition/types";

export type ImageAspectClass =
  | "portrait"
  | "square"
  | "landscape"
  | "panoramic"
  | "unknown";

export type ImageAnalysisEstimate = {
  aspectClass: ImageAspectClass;
  aspectRatio: number | null;
  imageQuality: number;
  subjectLocation: SubjectRegion;
  focalPoint: { x: number; y: number };
  busyLikely: boolean;
  minimalLikely: boolean;
  confidence: number;
};

export function classifyAspectRatio(
  aspectRatio: number | null | undefined,
): ImageAspectClass {
  if (aspectRatio == null || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return "unknown";
  }
  if (aspectRatio < 0.85) return "portrait";
  if (aspectRatio < 1.15) return "square";
  if (aspectRatio < 2.1) return "landscape";
  return "panoramic";
}

function subjectFromFocal(focal: { x: number; y: number }): SubjectRegion {
  const { x, y } = focal;
  if (x < 0.38) return y < 0.4 ? "left" : y > 0.62 ? "left" : "left";
  if (x > 0.62) return "right";
  if (y < 0.38) return "upper";
  if (y > 0.62) return "lower";
  return "center";
}

function subjectFromLayout(input: CompositionAnalysisInput): SubjectRegion | null {
  if (input.layout === "split" || input.legacyLayoutKey === "split") {
    // Split layouts typically keep photography on one side.
    return input.patternId?.includes("left") ? "right" : "right";
  }
  if (input.patternId === "hero.contractor_left") return "right";
  if (input.legacyLayoutKey === "bold-overlay") return "full";
  if (input.imagePosition === "left") return "left";
  if (input.imagePosition === "right") return "right";
  if (input.imagePosition === "top") return "upper";
  if (input.imagePosition === "bottom") return "lower";
  return null;
}

/**
 * Estimate image composition signals from available metadata.
 * Pixel hints improve the estimate when provided.
 */
export function analyzeImageComposition(
  input: CompositionAnalysisInput,
): ImageAnalysisEstimate {
  const aspectRatio = input.aspectRatio ?? null;
  const aspectClass = classifyAspectRatio(aspectRatio);

  const focal = resolveFocalPoint(input);

  const layoutSubject = subjectFromLayout(input);
  const pixelSubject = subjectFromPixelHints(input.pixelAnalysis);
  const subjectLocation =
    pixelSubject ?? layoutSubject ?? subjectFromFocal(focal);

  let imageQuality = input.hasHeroImage ? 72 : 28;
  if (input.imageFit === "contain") imageQuality -= 14;
  if (input.imageFit === "cover") imageQuality += 6;
  if ((input.zoom ?? 1) > 1.25) imageQuality -= 8;
  if (aspectClass === "panoramic") imageQuality += 4;
  if (aspectClass === "portrait") imageQuality += 2;
  if (input.pixelAnalysis?.brightnessMap === "bright") imageQuality += 2;

  // Busy vs minimal heuristics (metadata)
  const busyLikely =
    input.pixelAnalysis?.brightnessMap === "mixed" ||
    (input.currentOverlay ?? 0) >= 50 ||
    Boolean(input.industry && /landscap|restaurant|gym|builder/i.test(input.industry)) ||
    aspectClass === "panoramic";
  const minimalLikely =
    input.legacyLayoutKey === "minimal" ||
    input.patternId === "hero.premium_minimal" ||
    input.pixelAnalysis?.brightnessMap === "dark";

  if (busyLikely) imageQuality -= 4;
  if (minimalLikely) imageQuality += 4;

  let confidence = input.hasHeroImage ? 0.62 : 0.35;
  if (input.focalPoint) confidence += 0.12;
  if (input.aspectRatio) confidence += 0.08;
  if (input.patternId) confidence += 0.06;
  if (input.pixelAnalysis) confidence += 0.18;
  confidence = Math.min(0.95, confidence);

  return {
    aspectClass,
    aspectRatio,
    imageQuality: clamp(imageQuality),
    subjectLocation,
    focalPoint: {
      x: clamp01(focal.x),
      y: clamp01(focal.y),
    },
    busyLikely,
    minimalLikely,
    confidence,
  };
}

function resolveFocalPoint(
  input: CompositionAnalysisInput,
): { x: number; y: number } {
  if (input.focalPoint) {
    return {
      x: clamp01(input.focalPoint.x),
      y: clamp01(input.focalPoint.y),
    };
  }
  const box = input.pixelAnalysis?.subjectBoundingBox;
  if (box) {
    return {
      x: clamp01(box.x + box.width / 2),
      y: clamp01(box.y + box.height / 2),
    };
  }
  // Default: slightly above center — common for people/product photography.
  return { x: 0.5, y: 0.45 };
}

function subjectFromPixelHints(
  hints: VisualCompositionPixelHints | null | undefined,
): SubjectRegion | null {
  if (!hints?.subjectBoundingBox) return null;
  const box = hints.subjectBoundingBox;
  return subjectFromFocal({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
