import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreOfferStrength(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 52;

  if (signals.heroHeadline.trim().length >= 18) {
    score += 12;
    strengths.push("The headline carries a clear promise.");
  } else {
    score -= 12;
    weaknesses.push("The offer is not obvious from the first headline.");
  }

  if (signals.heroSubheadline.trim().length >= 40) {
    score += 8;
  } else {
    score -= 6;
    weaknesses.push("Supporting copy does not clarify what the visitor gets.");
  }

  if (signals.servicesCount >= 2 && signals.servicesCount <= 5) {
    score += 12;
    strengths.push("Services outline a concrete offer set.");
  } else if (signals.servicesCount <= 1) {
    score -= 10;
    weaknesses.push("The offer set is too thin to feel specific.");
  } else if (signals.servicesCount >= 7) {
    score -= 8;
    weaknesses.push("Too many services blur the primary offer.");
  }

  if (signals.hasPricing) {
    score += 6;
    strengths.push("Pricing cues help visitors evaluate the offer.");
  }

  return { score: clamp(score), strengths, weaknesses };
}
