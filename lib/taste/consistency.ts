import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Border radius, shadow language, button/card/spacing/icon language. */
export function scoreComponentConsistency(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 64;

  if (signals.cdConsistency != null) {
    score = Math.round(signals.cdConsistency * 0.65 + score * 0.35);
  }

  if (signals.buttonStyle) {
    score += 4;
    strengths.push("Buttons share one silhouette language.");
  }

  if (signals.spacing !== "default" && signals.visualHierarchy) {
    score += 10;
    strengths.push("Spacing and hierarchy agree on the same design language.");
  } else if (signals.spacing === "default" && !signals.visualHierarchy) {
    score -= 10;
    weaknesses.push("Spacing and hierarchy both default — components feel unfinished.");
  }

  if (signals.serviceIcons && signals.servicesCount >= 5) {
    score -= 4;
    weaknesses.push("Icon treatment across many cards needs tighter consistency.");
  } else if (signals.serviceIcons && signals.servicesCount <= 4) {
    score += 3;
  }

  if (signals.hasHeroPattern && signals.templateId) {
    score += 6;
    strengths.push("Hero pattern and template reinforce one layout language.");
  }

  if (
    signals.motionEnabled &&
    signals.hoverEffects &&
    signals.sectionReveal
  ) {
    score -= 8;
    weaknesses.push("Motion, hover, and reveal languages stack without restraint.");
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Components mostly share a coherent design language.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
