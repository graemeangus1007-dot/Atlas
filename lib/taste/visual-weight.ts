import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Heavy/empty regions, CTA dominance, hero overpowering the page. */
export function scoreVisualWeight(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 64;

  if (signals.heroVisualWeight === "heavy" && signals.sectionCount >= 6) {
    score -= 8;
    weaknesses.push("A heavy hero can overpower the rest of the page.");
  } else if (signals.heroVisualWeight === "medium") {
    score += 6;
    strengths.push("Hero weight leaves room for the page to continue.");
  } else if (signals.heroVisualWeight === "light" && !signals.hasHeroImage) {
    score -= 6;
    weaknesses.push("The opening feels empty without a visual anchor.");
  }

  if (signals.heroOverlay >= 70) {
    score -= 10;
    weaknesses.push("The hero wash is visually heavier than the offer itself.");
  }

  if (signals.primaryCtaLength > 0 && signals.visualHierarchy) {
    score += 8;
    strengths.push("Hierarchy helps the CTA claim a clear visual role.");
  } else if (!signals.visualHierarchy && signals.hasSecondaryCta) {
    score -= 10;
    weaknesses.push(
      "Headline, supporting copy, and dual CTAs compete with equal weight.",
    );
  }

  if (signals.gallerySlots >= 8 && signals.servicesCount >= 5) {
    score -= 8;
    weaknesses.push("Mid-page weight piles gallery and services without relief.");
  }

  if (signals.cdFirstImpression != null && signals.cdFirstImpression < 55) {
    score -= 8;
  } else if (
    signals.cdFirstImpression != null &&
    signals.cdFirstImpression >= 80
  ) {
    score += 4;
  }

  if (signals.photographyPreservation != null && signals.photographyPreservation < 55) {
    score -= 6;
    weaknesses.push("Treatments bury photography and unbalance visual weight.");
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Visual weight is reasonably balanced across the page.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
