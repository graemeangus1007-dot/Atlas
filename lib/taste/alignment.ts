import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Shared edges, grid adherence, CTA/section/image alignment proxies. */
export function scoreAlignmentQuality(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 68;

  if (signals.hasHeroPattern) {
    score += 10;
    strengths.push("A hero pattern keeps content and CTA on a shared alignment.");
  }

  if (signals.buttonStyle === "rounded" || signals.buttonStyle === "pill") {
    score += 4;
    strengths.push("Button language is consistent with a clear silhouette.");
  } else if (signals.buttonStyle === "square") {
    score += 2;
  }

  if (signals.siteWidth === "boxed" || signals.siteWidth === "narrow") {
    score += 6;
    strengths.push("A contained width helps sections share edges.");
  } else if (signals.siteWidth === "full" || signals.siteWidth === "wide") {
    score -= 4;
    if (!signals.visualHierarchy) {
      weaknesses.push("Wide layout without hierarchy weakens shared alignment.");
    }
  }

  if (signals.hasSecondaryCta && signals.primaryCtaLength > 0) {
    score += 2;
  }

  if (!signals.hasHeroImage && signals.gallerySlots === 0) {
    score -= 6;
    weaknesses.push("Without imagery, alignment lacks a visual anchor.");
  }

  if (signals.heroCompositionScore != null) {
    score = Math.round(score * 0.7 + signals.heroCompositionScore * 0.3);
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Sections largely share a coherent alignment language.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
