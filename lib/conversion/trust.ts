import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreTrust(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 48;

  if (signals.testimonialCount >= 2) {
    score += 18;
    strengths.push("Social proof is present to support trust.");
  } else if (signals.testimonialCount === 1) {
    score += 8;
  } else {
    score -= 12;
    weaknesses.push("Visitors have little third-party proof to trust the offer.");
  }

  if (signals.gallerySlots >= 3) {
    score += 12;
    strengths.push("Visual proof helps visitors believe the work is real.");
  } else if (
    signals.gallerySlots === 0 &&
    /contractor|landscap|builder|roof|gym|restaurant/i.test(signals.industry)
  ) {
    score -= 14;
    weaknesses.push("Image-led businesses need visible proof before the ask.");
  }

  if (signals.contactPhone.replace(/\D/g, "").length >= 7) {
    score += 8;
    strengths.push("A reachable phone number supports credibility.");
  } else {
    score -= 8;
    weaknesses.push("Missing phone contact weakens trust at decision time.");
  }

  if (signals.proofBeforeAsk) {
    score += 10;
    strengths.push("Proof appears before the conversion ask.");
  } else if (signals.testimonialCount > 0 || signals.gallerySlots > 0) {
    score -= 10;
    weaknesses.push("Proof is present but arrives after the ask.");
  }

  return { score: clamp(score), strengths, weaknesses };
}
