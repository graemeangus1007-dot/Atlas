import type { TasteSignals } from "@/lib/taste/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Hierarchy, paragraph rhythm, line length proxies, font pairing, headline dominance. */
export function scoreTypographyHarmony(signals: TasteSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 58;

  if (signals.visualHierarchy) {
    score += 16;
    strengths.push("Visual hierarchy is enabled so headings lead the read.");
  } else {
    score -= 14;
    weaknesses.push("Without hierarchy, headlines and body compete equally.");
  }

  if (signals.headingFont !== signals.bodyFont) {
    score += 10;
    strengths.push("Heading and body fonts are paired, not identical.");
  } else {
    score -= 6;
    weaknesses.push("Identical heading and body fonts flatten typographic taste.");
  }

  // Line-length / dominance proxies from copy length
  if (signals.headlineLength >= 18 && signals.headlineLength <= 56) {
    score += 6;
    strengths.push("Headline length supports a decisive first line.");
  } else if (signals.headlineLength > 72) {
    score -= 8;
    weaknesses.push("The headline runs long and loses visual dominance.");
  } else if (signals.headlineLength > 0 && signals.headlineLength < 12) {
    score -= 4;
    weaknesses.push("The headline is too short to carry the first impression.");
  }

  if (signals.subheadlineLength > 140) {
    score -= 6;
    weaknesses.push("Supporting copy is dense — paragraph rhythm suffers.");
  } else if (
    signals.subheadlineLength >= 40 &&
    signals.subheadlineLength <= 120
  ) {
    score += 4;
  }

  if (signals.cdScanability != null) {
    score = Math.round(score * 0.65 + signals.cdScanability * 0.35);
  }

  const explanation =
    weaknesses[0] ??
    strengths[0] ??
    "Typography is readable with a moderate sense of hierarchy.";

  return { score: clamp(score), strengths, weaknesses, explanation };
}
