import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Button/card/hero/section/gallery balance and content density. */
export function scoreProportion(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 64;

  if (signals.servicesCount >= 3 && signals.servicesCount <= 4) {
    score += 8;
    strengths.push("Service density feels proportioned rather than stuffed.");
  } else if (signals.servicesCount >= 6) {
    score -= 10;
    weaknesses.push("Too many service cards crowd the mid-page proportion.");
  } else if (signals.servicesCount <= 1) {
    score -= 4;
  }

  if (signals.gallerySlots >= 3 && signals.gallerySlots <= 6) {
    score += 6;
    strengths.push("Gallery volume balances proof without overwhelming copy.");
  } else if (signals.gallerySlots >= 9) {
    score -= 8;
    weaknesses.push("Gallery density competes with the rest of the page.");
  }

  if (signals.heroOverlay >= 70) {
    score -= 8;
    weaknesses.push("A heavy hero wash throws section proportions out of balance.");
  } else if (signals.heroOverlay <= 35 && signals.hasHeroImage) {
    score += 4;
  }

  if (signals.primaryCtaLength >= 8 && signals.primaryCtaLength <= 22) {
    score += 4;
    strengths.push("Primary CTA size language stays decisive without shouting.");
  } else if (signals.primaryCtaLength > 32) {
    score -= 6;
    weaknesses.push("CTA label length makes the action feel oversized.");
  }

  if (signals.sectionCount >= 8 && signals.spacing === "default") {
    score -= 8;
    weaknesses.push("Content density is high relative to available space.");
  }

  if (signals.visualCompositionScore != null) {
    score = Math.round(score * 0.75 + signals.visualCompositionScore * 0.25);
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Proportions are workable across hero, cards, and CTAs.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
