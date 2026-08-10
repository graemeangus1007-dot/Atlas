import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Higher score = less friction (easier to convert). */
export function scoreFriction(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 62;

  if (signals.formEnabled) {
    score += 10;
    strengths.push("A contact form is available for low-friction inquiries.");
  } else {
    score -= 12;
    weaknesses.push("Without a form, visitors face more friction to inquire.");
  }

  if (signals.contactPhone.replace(/\D/g, "").length >= 7) {
    score += 8;
  } else {
    score -= 10;
    weaknesses.push("No clear phone path increases decision friction.");
  }

  if (signals.faqCount >= 2) {
    score += 10;
    strengths.push("FAQ reduces common objections before the ask.");
  } else {
    score -= 6;
    weaknesses.push("Unanswered questions can stall conversion.");
  }

  if (!signals.proofBeforeAsk && signals.testimonialCount + signals.gallerySlots > 0) {
    score -= 10;
    weaknesses.push("Asking before proof adds avoidable hesitation.");
  }

  if (signals.servicesCount >= 7) {
    score -= 8;
    weaknesses.push("Offer overload creates choice friction.");
  }

  return { score: clamp(score), strengths, weaknesses };
}
