import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Contrast as craft — local readability treatments vs broad washes.
 * Feeds craftsmanship / polish, not a standalone TasteEvaluation field.
 */
export function scoreContrastCraft(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 66;

  if (signals.heroOverlay >= 65) {
    score -= 14;
    weaknesses.push("A broad overlay wash is doing the work of local contrast.");
  } else if (signals.heroOverlay <= 40 && signals.hasHeroImage) {
    score += 8;
    strengths.push("Hero contrast stays restrained so photography can read.");
  }

  if (signals.hasHeroTreatmentGradient && signals.heroOverlay <= 45) {
    score += 6;
    strengths.push("Directional contrast supports copy without covering the frame.");
  }

  if (signals.heroScrimBlur >= 8) {
    score -= 12;
    weaknesses.push("Blur as contrast feels unfinished compared with local scrims.");
  } else if (signals.hasHeroTreatmentScrim && signals.heroScrimBlur === 0) {
    score += 4;
  }

  if (signals.photographyPreservation != null) {
    score = Math.round(score * 0.6 + signals.photographyPreservation * 0.4);
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Contrast treatments are moderate.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
