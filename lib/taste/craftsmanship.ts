import type { TasteSignals } from "@/lib/taste/types";
import { scoreContrastCraft } from "@/lib/taste/contrast";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Tiny polish details, clean spacing, transitions, professional finishing. */
export function scoreCraftsmanship(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const contrast = scoreContrastCraft(signals);
  let score = Math.round(contrast.score * 0.45 + 55 * 0.55);
  strengths.push(...contrast.strengths);
  weaknesses.push(...contrast.weaknesses);

  if (signals.visualHierarchy && signals.spacing !== "default") {
    score += 12;
    strengths.push("Hierarchy and spacing finish read as intentional craft.");
  } else {
    score -= 8;
    weaknesses.push("Finishing still feels default rather than crafted.");
  }

  if (signals.hasHeroPattern) {
    score += 8;
    strengths.push("An executable hero pattern adds professional finishing.");
  }

  if (signals.cdProfessionalism != null) {
    score = Math.round(score * 0.55 + signals.cdProfessionalism * 0.45);
  }

  if (signals.motionEnabled && !signals.hoverEffects && !signals.sectionReveal) {
    score += 3;
    strengths.push("Motion is present but limited — transitions stay clean.");
  } else if (
    signals.motionEnabled &&
    signals.hoverEffects &&
    signals.sectionReveal
  ) {
    score -= 10;
    weaknesses.push("Stacked motion languages feel unfinished, not polished.");
  }

  if (
    signals.heroCompositionScore != null &&
    signals.heroCompositionScore >= 78
  ) {
    score += 6;
  } else if (
    signals.heroCompositionScore != null &&
    signals.heroCompositionScore < 60
  ) {
    score -= 8;
    weaknesses.push("Hero composition still needs finishing before craft reads.");
  }

  if (signals.headingFont !== signals.bodyFont && signals.visualHierarchy) {
    score += 4;
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Craftsmanship is developing — structure is present, finishing varies.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
