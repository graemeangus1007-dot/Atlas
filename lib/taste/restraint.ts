import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Too many accents, colors, font sizes, effects, animation. */
export function scoreRestraint(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 72;

  if (signals.distinctBrandColors >= 4) {
    score -= 10;
    weaknesses.push("Too many brand colors compete for accent attention.");
  } else if (signals.distinctBrandColors <= 3) {
    score += 6;
    strengths.push("Color accents stay limited and intentional.");
  }

  if (signals.headingFont === signals.bodyFont) {
    // Same fonts can be restrained, but also underdesigned — slight bonus for restraint
    score += 2;
  }

  let effectStack = 0;
  if (signals.motionEnabled) effectStack += 1;
  if (signals.hoverEffects) effectStack += 1;
  if (signals.sectionReveal) effectStack += 1;
  if (signals.heroScrimBlur >= 6) effectStack += 1;
  if (signals.heroOverlay >= 60) effectStack += 1;

  if (effectStack === 0) {
    score += 8;
    strengths.push("Effects are quiet — the design relies on structure.");
  } else if (effectStack === 1) {
    score += 2;
  } else if (effectStack >= 3) {
    score -= 16;
    weaknesses.push("Too many effects and treatments stack at once.");
  } else {
    score -= 6;
    weaknesses.push("Multiple competing effects reduce professional restraint.");
  }

  if (signals.hasSecondaryCta && signals.serviceIcons && signals.motionEnabled) {
    score -= 6;
    weaknesses.push("Secondary CTA, icons, and motion all ask for attention.");
  }

  if (signals.servicesCount >= 6) {
    score -= 6;
    weaknesses.push("A long service list reads as overstuffed rather than curated.");
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "The design shows moderate restraint.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
