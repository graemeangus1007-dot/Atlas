import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function weakCta(cta: string): boolean {
  const t = cta.trim().toLowerCase();
  return (
    !t ||
    /^(learn more|click here|submit|ok|get started|contact us)$/i.test(t) ||
    t.length < 4
  );
}

export function scoreCtaStrength(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 50;

  if (!weakCta(signals.primaryCta)) {
    score += 22;
    strengths.push("The primary CTA is specific enough to act on.");
  } else {
    score -= 18;
    weaknesses.push("The primary CTA is generic and weakens conversion.");
  }

  if (signals.primaryCta.length >= 8 && signals.primaryCta.length <= 24) {
    score += 8;
  } else if (signals.primaryCta.length > 32) {
    score -= 6;
    weaknesses.push("The CTA label is long enough to dilute action clarity.");
  }

  if (signals.hasBookingCta) {
    score += 8;
    strengths.push("A booking-oriented action supports the path to inquire.");
  }

  if (signals.secondaryCta && weakCta(signals.primaryCta)) {
    score -= 8;
    weaknesses.push("A secondary action competes while the primary CTA is unclear.");
  }

  return { score: clamp(score), strengths, weaknesses };
}
