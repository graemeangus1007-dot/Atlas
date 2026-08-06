/**
 * Cross-page trust signal evaluation.
 */

import type {
  PageSectionInventory,
  SectionEvaluation,
  TrustEvaluation,
} from "@/lib/creative-director/types";

export function evaluateWebsiteTrust(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
}): TrustEvaluation {
  const inv = input.inventory;
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 48;

  if (inv.testimonialCount > 0) {
    if (inv.proofBeforeAsk) {
      signals.push("Social proof / testimonials before the ask");
      score += 18;
    } else {
      // Present but weakly positioned — not full trust credit
      signals.push("Testimonials present but late in the journey");
      score += 9;
      missing.push("Proof positioned before conversion");
    }
  } else {
    missing.push("Testimonials");
  }

  if (inv.gallerySlots >= 3) {
    signals.push("Proof imagery / gallery");
    score += 14;
  } else if (inv.gallerySlots > 0) {
    signals.push("Limited proof imagery");
    score += 6;
    missing.push("Stronger before/after or portfolio depth");
  } else {
    missing.push("Gallery / proof photography");
  }

  if (inv.galleryLightbox && inv.gallerySlots > 0) {
    signals.push("Inspectable project photography (lightbox)");
    score += 4;
  }

  if (inv.hasAboutCopy) {
    signals.push("Business story");
    score += 6;
  } else {
    missing.push("Credible About narrative");
  }

  if (inv.hasTeam) {
    signals.push("Team photography");
    score += 8;
  }

  if (inv.faqCount > 0) {
    signals.push("FAQ / objection handling");
    score += 6;
  }

  if (inv.contactPhone.replace(/\D/g, "").length >= 7) {
    signals.push("Contact credibility (phone)");
    score += 6;
  } else {
    missing.push("Clear phone contact");
  }

  if (inv.contactLocation.trim()) {
    signals.push("Local signal");
    score += 5;
  } else {
    missing.push("Local presence signal");
  }

  // Certifications / years / logos — not modeled yet; note as opportunity.
  if (!/\b(\d+)\s*\+?\s*years?\b/i.test(inv.description + inv.heroSubheadline)) {
    missing.push("Years-in-business cue");
  } else {
    signals.push("Years in business mentioned");
    score += 4;
  }

  const sectionTrust = input.sections
    .filter((s) => s.present)
    .reduce((sum, s) => sum + s.trustContribution, 0);
  const avg =
    input.sections.filter((s) => s.present).length > 0
      ? sectionTrust / input.sections.filter((s) => s.present).length
      : 40;
  score = Math.round(score * 0.7 + avg * 0.3);

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    missing: missing.slice(0, 6),
    explanation:
      missing.length === 0
        ? "Trust signals are present across proof, people, and contact."
        : `Trust is limited by missing ${missing.slice(0, 2).join(" and ").toLowerCase()}.`,
  };
}
