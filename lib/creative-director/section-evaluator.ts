/**
 * Per-section evaluation for whole-page Creative Director review.
 */

import type {
  PageSectionInventory,
  SectionEvaluation,
  WebsiteSectionId,
} from "@/lib/creative-director/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function weakCta(cta: string): boolean {
  const t = cta.trim().toLowerCase();
  return !t || t === "learn more" || t === "click here" || t.length < 3;
}

function evaluateHero(inv: PageSectionInventory): SectionEvaluation {
  let score = 72;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (inv.heroHeadline.trim().length >= 12) {
    strengths.push("Clear opening headline");
    score += 6;
  } else {
    weaknesses.push("Hero headline is thin or missing");
    score -= 16;
  }
  if (inv.hasHeroImage) {
    strengths.push("Hero imagery anchors first impression");
    score += 8;
  } else {
    weaknesses.push("No hero image for first impression");
    score -= 14;
  }
  if (!weakCta(inv.primaryCta)) {
    strengths.push("Primary call-to-action is present");
    score += 4;
  } else {
    weaknesses.push("Primary CTA is unclear");
    score -= 12;
  }
  // Render-aware: blend resolved HeroComposition quality (presence ≠ quality).
  if (inv.heroCompositionScore != null) {
    score = Math.round(score * 0.45 + inv.heroCompositionScore * 0.55);
    if (inv.heroImageImpact != null && inv.heroImageImpact < 64) {
      weaknesses.push("Hero image impact is too low for a strong first impression");
      score -= 8;
    }
    if (inv.heroMajorDefect) {
      weaknesses.push(
        inv.heroProblems[0] || "Major hero composition defect is visible",
      );
      score -= 10;
    } else if (inv.heroCompositionScore >= 75) {
      strengths.push("Resolved hero composition reads as intentional");
    }
  } else if (inv.hasHeroImage && !inv.hasHeroPattern) {
    weaknesses.push("Hero has imagery but no resolved composition structure");
    score -= 6;
  }
  // Pattern credit after blend so intentional layouts remain measurable.
  if (inv.hasHeroPattern) {
    strengths.push("Hero composition is intentionally structured");
    score += inv.heroMajorDefect ? 2 : 8;
  }
  if (inv.brandContrastWeak) {
    weaknesses.push("Hero text contrast against the image is weak");
    score -= 8;
  }
  return {
    sectionId: "hero",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: inv.hasHeroImage ? 55 : 35,
    conversionContribution: weakCta(inv.primaryCta) ? 40 : 70,
    visualWeight: "heavy",
    readingDifficulty: inv.heroSubheadline.length > 180 ? "dense" : "easy",
    attentionScore: clamp(
      inv.heroImageImpact != null
        ? inv.heroImageImpact
        : inv.hasHeroImage
          ? 88
          : 62,
    ),
    recommendations: weaknesses.length
      ? [
          {
            title: "Strengthen the first impression",
            explanation:
              "The opening should promise one clear outcome and show the work visitors came to judge.",
            priority: "high",
            theme: "hierarchy",
          },
        ]
      : [],
    explanation:
      "The hero sets the emotional and commercial promise for the rest of the page.",
  };
}

function evaluateAbout(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("about")) {
    return missing("about", "Story and credibility context are absent.");
  }
  let score = 68;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (inv.hasAboutCopy) {
    strengths.push("Business story is available");
    score += 8;
  } else {
    weaknesses.push("About copy is too thin to build confidence");
    score -= 18;
  }
  if (inv.description.length > 420) {
    weaknesses.push("About section may dominate the page");
    score -= 10;
  }
  return {
    sectionId: "about",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: inv.hasAboutCopy ? 62 : 30,
    conversionContribution: 35,
    visualWeight: inv.description.length > 320 ? "heavy" : "medium",
    readingDifficulty: inv.description.length > 320 ? "dense" : "moderate",
    attentionScore: 48,
    recommendations: weaknesses.map((w) => ({
      title: "Tighten the About story",
      explanation: w,
      priority: "medium" as const,
      theme: "narrative" as const,
    })),
    explanation: "About should answer who you are without slowing the sale.",
  };
}

function evaluateServices(inv: PageSectionInventory): SectionEvaluation {
  let score = 70;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (inv.servicesCount >= 3) {
    strengths.push("Service offering is structured");
    score += 8;
  } else {
    weaknesses.push("Too few services to establish scope");
    score -= 12;
  }
  if (inv.servicesCount > 8) {
    weaknesses.push("Service list may overwhelm scanning");
    score -= 8;
  }
  return {
    sectionId: "services",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: 50,
    conversionContribution: 65,
    visualWeight: "medium",
    readingDifficulty: inv.servicesCount > 6 ? "dense" : "easy",
    attentionScore: 70,
    recommendations: [],
    explanation: "Services translate the promise into tangible offers.",
  };
}

function evaluateGallery(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("gallery") || inv.gallerySlots === 0) {
    return missing(
      "gallery",
      "Visual proof of the work is missing from the page.",
    );
  }
  let score = 64;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (inv.gallerySlots >= 4) {
    strengths.push("Gallery provides visual proof");
    score += 14;
  } else {
    weaknesses.push("Gallery is too sparse to prove capability");
    score -= 10;
  }
  if (inv.galleryLightbox) {
    strengths.push("Lightbox lets visitors inspect project detail");
    score += 8;
  }
  return {
    sectionId: "gallery",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: clamp(
      40 + inv.gallerySlots * 6 + (inv.galleryLightbox ? 6 : 0),
    ),
    conversionContribution: 45,
    visualWeight: "heavy",
    readingDifficulty: "easy",
    attentionScore: 78,
    recommendations: weaknesses.length
      ? [
          {
            title: "Strengthen proof imagery",
            explanation:
              "Visitors need enough finished work to believe the hero promise.",
            priority: "high",
            theme: "imagery",
          },
        ]
      : [],
    explanation: "Gallery is visual evidence, not decoration.",
  };
}

function evaluateTestimonials(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("testimonials") || inv.testimonialCount === 0) {
    return missing(
      "testimonials",
      "Social proof is missing before the conversion ask.",
    );
  }
  let score = 74;
  const strengths = ["Customer proof is present"];
  const weaknesses: string[] = [];
  if (inv.testimonialCount < 2) {
    weaknesses.push("Only one testimonial — thin social proof");
    score -= 12;
  } else {
    strengths.push("Multiple voices reinforce trust");
    score += 6;
  }
  return {
    sectionId: "testimonials",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: 88,
    conversionContribution: 70,
    visualWeight: "medium",
    readingDifficulty: "easy",
    attentionScore: 72,
    recommendations: [],
    explanation: "Testimonials answer the visitor’s trust question.",
  };
}

function evaluateFaq(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("faq") || inv.faqCount === 0) {
    return missing("faq", "Common objections are left unanswered.");
  }
  return {
    sectionId: "faq",
    present: true,
    score: clamp(70 + Math.min(12, inv.faqCount * 3)),
    strengths: ["FAQ reduces decision friction"],
    weaknesses: [],
    trustContribution: 60,
    conversionContribution: 68,
    visualWeight: "light",
    readingDifficulty: "moderate",
    attentionScore: 45,
    recommendations: [],
    explanation: "FAQ clears practical doubts before contact.",
  };
}

function evaluatePricing(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("pricing") || !inv.hasPricing) {
    return missing("pricing", "Pricing is not part of the current page.");
  }
  return {
    sectionId: "pricing",
    present: true,
    score: 68,
    strengths: ["Offer structure is visible"],
    weaknesses: [],
    trustContribution: 40,
    conversionContribution: 75,
    visualWeight: "medium",
    readingDifficulty: "moderate",
    attentionScore: 66,
    recommendations: [],
    explanation: "Pricing works after value and proof are established.",
  };
}

function evaluateCta(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("cta") && !inv.hasBookingCta) {
    return missing("cta", "No dedicated mid-page conversion block.");
  }
  return {
    sectionId: "cta",
    present: true,
    score: weakCta(inv.primaryCta) ? 52 : 74,
    strengths: inv.hasBookingCta ? ["Dedicated conversion moment"] : [],
    weaknesses: weakCta(inv.primaryCta) ? ["CTA wording is weak"] : [],
    trustContribution: 35,
    conversionContribution: 85,
    visualWeight: "medium",
    readingDifficulty: "easy",
    attentionScore: 80,
    recommendations: [],
    explanation: "A mid-page CTA captures intent after proof.",
  };
}

function evaluateContact(inv: PageSectionInventory): SectionEvaluation {
  let score = 70;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (inv.contactPhone.replace(/\D/g, "").length >= 7) {
    strengths.push("Phone contact is available");
    score += 8;
  } else {
    weaknesses.push("Phone contact looks weak or missing");
    score -= 14;
  }
  if (inv.contactEmail.includes("@")) {
    strengths.push("Email contact is available");
    score += 4;
  }
  if (inv.contactLocation.trim()) {
    strengths.push("Local presence signal");
    score += 4;
  }
  return {
    sectionId: "contact",
    present: true,
    score: clamp(score),
    strengths,
    weaknesses,
    trustContribution: 70,
    conversionContribution: 90,
    visualWeight: "medium",
    readingDifficulty: "easy",
    attentionScore: 60,
    recommendations: weaknesses.length
      ? [
          {
            title: "Make contact feel credible",
            explanation:
              "Clear phone, location, and next-step wording reduce friction at the decision moment.",
            priority: "high",
            theme: "conversion",
          },
        ]
      : [],
    explanation: "Contact is the conversion destination, not the first story beat.",
  };
}

function evaluateFooter(): SectionEvaluation {
  return {
    sectionId: "footer",
    present: true,
    score: 72,
    strengths: ["Closing navigation and credibility anchors"],
    weaknesses: [],
    trustContribution: 40,
    conversionContribution: 25,
    visualWeight: "light",
    readingDifficulty: "easy",
    attentionScore: 20,
    recommendations: [],
    explanation: "Footer supports orientation after the main narrative.",
  };
}

function evaluateTeam(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("team") || !inv.hasTeam) {
    return missing("team", "Team presence is not on the page.");
  }
  return {
    sectionId: "team",
    present: true,
    score: 76,
    strengths: ["Human faces increase trust"],
    weaknesses: [],
    trustContribution: 80,
    conversionContribution: 45,
    visualWeight: "medium",
    readingDifficulty: "easy",
    attentionScore: 58,
    recommendations: [],
    explanation: "Team photography makes the brand feel real.",
  };
}

function evaluateNewsletter(inv: PageSectionInventory): SectionEvaluation {
  if (!inv.present.has("newsletter") || !inv.hasNewsletter) {
    return missing("newsletter", "No secondary capture path.");
  }
  return {
    sectionId: "newsletter",
    present: true,
    score: 62,
    strengths: ["Secondary engagement path"],
    weaknesses: [],
    trustContribution: 25,
    conversionContribution: 40,
    visualWeight: "light",
    readingDifficulty: "easy",
    attentionScore: 30,
    recommendations: [],
    explanation: "Newsletter is optional; it should not compete with the primary CTA.",
  };
}

function missing(sectionId: WebsiteSectionId, why: string): SectionEvaluation {
  return {
    sectionId,
    present: false,
    score: 0,
    strengths: [],
    weaknesses: [why],
    trustContribution: 0,
    conversionContribution: 0,
    visualWeight: "light",
    readingDifficulty: "easy",
    attentionScore: 0,
    recommendations: [
      {
        title: `Consider adding ${sectionId}`,
        explanation: why,
        priority: sectionId === "testimonials" || sectionId === "gallery"
          ? "high"
          : "medium",
        theme:
          sectionId === "testimonials" || sectionId === "gallery"
            ? "proof"
            : "flow",
      },
    ],
    explanation: why,
  };
}

const EVALUATORS: Record<
  WebsiteSectionId,
  (inv: PageSectionInventory) => SectionEvaluation
> = {
  hero: evaluateHero,
  about: evaluateAbout,
  services: evaluateServices,
  gallery: evaluateGallery,
  testimonials: evaluateTestimonials,
  faq: evaluateFaq,
  pricing: evaluatePricing,
  cta: evaluateCta,
  contact: evaluateContact,
  footer: evaluateFooter,
  team: evaluateTeam,
  newsletter: evaluateNewsletter,
};

export function evaluateWebsiteSections(
  inventory: PageSectionInventory,
): SectionEvaluation[] {
  return inventory.order.map((id) => EVALUATORS[id](inventory));
}

export function evaluateAllKnownSections(
  inventory: PageSectionInventory,
): SectionEvaluation[] {
  const ids = Object.keys(EVALUATORS) as WebsiteSectionId[];
  return ids.map((id) => EVALUATORS[id](inventory));
}
