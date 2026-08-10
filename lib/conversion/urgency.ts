import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Urgency should be appropriate — not fake scarcity.
 * Soft score: booking CTA + seasonal industries get moderate credit.
 */
export function scoreUrgency(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 58;

  if (signals.hasBookingCta) {
    score += 12;
    strengths.push("A booking action gives a timely next step.");
  }

  if (/season|limited|today|now|this week/i.test(signals.primaryCta)) {
    score += 6;
  }

  // Over-urgency without proof is a smell — keep restrained.
  if (
    /urgent|hurry|last chance|act now!!!/i.test(
      `${signals.heroHeadline} ${signals.primaryCta}`,
    ) &&
    signals.testimonialCount === 0
  ) {
    score -= 14;
    weaknesses.push("Urgency language without proof feels pushy rather than helpful.");
  }

  if (!signals.hasBookingCta && weakOfferTiming(signals)) {
    score -= 8;
    weaknesses.push("There is little sense of when or how to take the next step.");
  }

  return { score: clamp(score), strengths, weaknesses };
}

function weakOfferTiming(signals: ConversionSignals): boolean {
  return (
    signals.primaryCta.trim().length > 0 &&
    !signals.hasBookingCta &&
    signals.formEnabled === false
  );
}
