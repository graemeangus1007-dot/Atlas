import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Consistent spacing scale, breathing room, crowding, section padding language. */
export function scoreSpacingHarmony(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 62;

  if (signals.spacing === "airy") {
    score += 18;
    strengths.push("Spacing uses an airy scale with clear breathing room.");
  } else if (signals.spacing === "comfortable") {
    score += 10;
    strengths.push("Spacing is comfortable without feeling sparse.");
  } else {
    score -= 8;
    weaknesses.push("Spacing still reads default — sections can feel stacked.");
  }

  if (signals.cdWhitespace != null) {
    score = Math.round(score * 0.55 + signals.cdWhitespace * 0.45);
  }

  if (signals.sectionCount >= 9) {
    score -= 10;
    weaknesses.push("Many sections without extra space make the page feel crowded.");
  } else if (signals.sectionCount <= 6 && signals.spacing !== "default") {
    score += 4;
    strengths.push("Section count leaves room for pacing.");
  }

  if (signals.servicesCount >= 6 && signals.spacing === "default") {
    score -= 8;
    weaknesses.push("Dense service cards need more consistent padding.");
  }

  if (signals.siteWidth === "wide" && signals.spacing === "default") {
    score -= 4;
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Spacing follows a workable scale with moderate breathing room.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
