import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreProof(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 40;

  if (signals.testimonialCount >= 2) {
    score += 24;
    strengths.push("Testimonials provide verbal proof.");
  } else if (signals.testimonialCount === 0) {
    score -= 10;
    weaknesses.push("No testimonials leave claims unbacked.");
  } else {
    score += 10;
  }

  if (signals.gallerySlots >= 3) {
    score += 20;
    strengths.push("Gallery proof shows finished work.");
  } else if (signals.gallerySlots === 0) {
    score -= 8;
    weaknesses.push("Little visual proof supports the promise.");
  } else {
    score += 8;
  }

  if (signals.proofBeforeAsk) {
    score += 14;
    strengths.push("Proof is sequenced before the conversion ask.");
  } else if (signals.testimonialCount + signals.gallerySlots > 0) {
    score -= 12;
    weaknesses.push("Proof exists but is not sequenced before the ask.");
  }

  if (signals.hasHeroImage) {
    score += 6;
  }

  return { score: clamp(score), strengths, weaknesses };
}
