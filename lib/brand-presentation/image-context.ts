/**
 * Deterministic hero image context from project/render metadata.
 * No screenshot computer vision dependency — title/alt/filename heuristics.
 */

import type { BusinessProject } from "@/types/business-project";
import type {
  HeroImagePresentationContext,
  ImageBrightnessClass,
  ImageComplexityClass,
} from "@/lib/brand-presentation/types";

const LIGHT_HINTS =
  /\b(bright|beach|sand|sky|coastal|ocean|daylight|sunny|snow|white\s+wall|overcast\s+bright|pastel)\b/i;
const DARK_HINTS =
  /\b(dark|forest|woods|pine|dusk|night|evening|shadow|moody|low[- ]light|black)\b/i;
const BUSY_HINTS =
  /\b(busy|city|street|skyline|traffic|crowd|market|clutter|pattern|graffiti)\b/i;
const SIMPLE_HINTS =
  /\b(minimal|plain|studio|product|gradient|solid|empty|soft\s+blur)\b/i;
const WARM_HINTS = /\b(warm|sunset|gold|sand|amber|orange|desert)\b/i;
const COOL_HINTS = /\b(cool|ocean|blue|teal|forest|pine|ice|steel)\b/i;

function collectHints(project: BusinessProject): string[] {
  if (!project.heroImageId) return [];
  const asset = project.mediaLibrary.find((a) => a.id === project.heroImageId);
  if (!asset) return [];
  return [asset.title, asset.description, asset.alt, asset.name, asset.filename]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim());
}

function classifyBrightness(blob: string): ImageBrightnessClass {
  if (LIGHT_HINTS.test(blob)) return "light";
  if (DARK_HINTS.test(blob)) return "dark";
  return "medium";
}

function classifyComplexity(blob: string): ImageComplexityClass {
  if (BUSY_HINTS.test(blob)) return "busy";
  if (SIMPLE_HINTS.test(blob)) return "simple";
  return "moderate";
}

function classifyDominant(blob: string): HeroImagePresentationContext["dominantFamily"] {
  if (WARM_HINTS.test(blob)) return "warm";
  if (COOL_HINTS.test(blob)) return "cool";
  return "neutral";
}

export function readHeroImagePresentationContext(
  project: Pick<
    BusinessProject,
    "heroImageId" | "mediaLibrary"
  >,
): HeroImagePresentationContext {
  const hints = collectHints(project as BusinessProject);
  const hasImage = Boolean(
    project.heroImageId &&
      project.mediaLibrary.some(
        (a) => a.id === project.heroImageId && Boolean(a.url),
      ),
  );

  if (!hasImage) {
    return {
      hasImage: false,
      brightness: "unknown",
      complexity: "unknown",
      dominantFamily: "unknown",
      titleHints: [],
      aspectRatio: null,
    };
  }

  const blob = hints.join(" ");
  const asset = project.mediaLibrary.find((a) => a.id === project.heroImageId);
  const aspectRatio =
    asset?.width && asset?.height && asset.height > 0
      ? asset.width / asset.height
      : null;

  return {
    hasImage: true,
    brightness: classifyBrightness(blob),
    complexity: classifyComplexity(blob),
    dominantFamily: classifyDominant(blob),
    titleHints: hints,
    aspectRatio,
  };
}

/**
 * Proxy surface color for contrast math when pixel analysis is unavailable.
 * Assumes localized scrim/gradient behind copy for light/busy imagery
 * (presentation darkens the safe zone — not a global overlay crush).
 */
export function estimateEffectiveHeroSurface(
  image: HeroImagePresentationContext,
  backgroundColor: string,
): string {
  if (!image.hasImage) return backgroundColor;
  // After local scrim, light beach copy sits on a darkened lower third.
  if (image.brightness === "light") return "#3a3f48";
  if (image.brightness === "dark") return "#2a3140";
  if (image.complexity === "busy") return "#3f4550";
  return "#5c6570";
}
