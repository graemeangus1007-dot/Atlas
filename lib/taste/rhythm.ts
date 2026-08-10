import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Alternating density, section pacing, image-to-copy cadence, vertical flow. */
export function scoreVisualRhythm(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 60;

  if (signals.cdVisualRhythm != null) {
    score = Math.round(signals.cdVisualRhythm * 0.7 + score * 0.3);
  }

  const cadence = signals.sectionCadence;
  if (cadence.length >= 3) {
    const heavy = cadence.filter((c) => c === "heavy").length;
    const light = cadence.filter((c) => c === "light").length;
    const alternates = cadence.some(
      (c, i) => i > 0 && c !== cadence[i - 1],
    );
    if (alternates && heavy <= Math.ceil(cadence.length * 0.55)) {
      score += 10;
      strengths.push("Section density alternates instead of stacking heavy blocks.");
    }
    if (heavy >= cadence.length - 1) {
      score -= 14;
      weaknesses.push("Nearly every section is heavy — pacing feels monotonous.");
    }
    if (light === 0 && cadence.length >= 5) {
      score -= 8;
      weaknesses.push("No light sections break the vertical flow.");
    }
  }

  if (signals.hasHeroImage && signals.gallerySlots > 0) {
    score += 6;
    strengths.push("Image-to-copy cadence has both a hero and proof photography.");
  } else if (!signals.hasHeroImage) {
    score -= 6;
    weaknesses.push("Without a hero image, vertical rhythm lacks a visual opener.");
  }

  if (signals.spacing === "airy") score += 6;
  if (signals.spacing === "default" && signals.sectionCount >= 7) {
    score -= 8;
    weaknesses.push("Tight spacing compresses section pacing.");
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Page rhythm is moderate with room for clearer pacing.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
