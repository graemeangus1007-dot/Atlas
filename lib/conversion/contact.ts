import type { ConversionSignals } from "@/lib/conversion/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreContactFlow(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 45;

  if (signals.formEnabled) {
    score += 20;
    strengths.push("A lead form is available for inquiries.");
  } else {
    score -= 14;
    weaknesses.push("Contact flow lacks an easy inquiry form.");
  }

  if (signals.contactPhone.replace(/\D/g, "").length >= 7) {
    score += 14;
    strengths.push("Phone contact is available.");
  } else {
    score -= 10;
    weaknesses.push("Phone contact is missing or incomplete.");
  }

  if (signals.contactEmail.includes("@")) {
    score += 10;
    strengths.push("Email contact is available.");
  } else {
    score -= 6;
  }

  if (signals.contactLocation.trim().length >= 3) {
    score += 8;
    strengths.push("Location context supports local inquiries.");
  }

  if (signals.hasBookingCta) {
    score += 6;
  }

  return { score: clamp(score), strengths, weaknesses };
}

export function scoreObjectionHandling(signals: ConversionSignals): {
  score: number;
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let score = 46;

  if (signals.faqCount >= 3) {
    score += 22;
    strengths.push("FAQ covers common objections.");
  } else if (signals.faqCount >= 1) {
    score += 10;
  } else {
    score -= 12;
    weaknesses.push("Common objections are not answered on the page.");
  }

  if (signals.testimonialCount >= 2) {
    score += 12;
    strengths.push("Proof helps disarm skepticism.");
  }

  if (signals.hasPricing) {
    score += 8;
    strengths.push("Pricing visibility reduces a common objection.");
  } else if (/service|consult|law|dental|contractor/i.test(signals.industry)) {
    score -= 4;
    weaknesses.push("Visitors may hesitate without pricing or package cues.");
  }

  return { score: clamp(score), strengths, weaknesses };
}
