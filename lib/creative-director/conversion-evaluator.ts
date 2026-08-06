/**
 * Conversion path evaluation — clarity, friction, next step.
 */

import type {
  ConversionEvaluation,
  PageSectionInventory,
  SectionEvaluation,
} from "@/lib/creative-director/types";

function weakCta(cta: string): boolean {
  const t = cta.trim().toLowerCase();
  return !t || /^(learn more|click here|submit|ok)$/i.test(t) || t.length < 3;
}

export function evaluateWebsiteConversion(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
  trustScore: number;
}): ConversionEvaluation {
  const inv = input.inventory;
  let ctaClarity = weakCta(inv.primaryCta) ? 42 : 82;
  let offerClarity = inv.servicesCount >= 2 ? 74 : 50;
  let friction = 70;
  let decisionConfidence = Math.round(input.trustScore * 0.65 + ctaClarity * 0.35);

  if (inv.contactPhone.replace(/\D/g, "").length < 7) {
    friction -= 18;
    decisionConfidence -= 10;
  }
  if (inv.testimonialCount === 0) {
    decisionConfidence -= 16;
    friction -= 8;
  }
  if (inv.faqCount > 0) {
    friction += 8;
    decisionConfidence += 6;
  }
  if (inv.hasBookingCta) {
    ctaClarity += 4;
  }
  if (inv.gallerySlots === 0 && /contractor|roof|plumb|electric|landscap|builder/i.test(inv.industry)) {
    offerClarity -= 12;
    decisionConfidence -= 10;
  }

  ctaClarity = Math.max(0, Math.min(100, ctaClarity));
  offerClarity = Math.max(0, Math.min(100, offerClarity));
  friction = Math.max(0, Math.min(100, friction));
  decisionConfidence = Math.max(0, Math.min(100, decisionConfidence));

  const score = Math.round(
    ctaClarity * 0.28 +
      offerClarity * 0.22 +
      friction * 0.2 +
      decisionConfidence * 0.3,
  );

  return {
    score,
    ctaClarity,
    offerClarity,
    friction,
    decisionConfidence,
    explanation:
      decisionConfidence < 55
        ? "Visitors may hesitate because the offer is clear but confidence and proof lag behind the ask."
        : "The conversion path is understandable; remaining friction is mostly about proof timing.",
  };
}
