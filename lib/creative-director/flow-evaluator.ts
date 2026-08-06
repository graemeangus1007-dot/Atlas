/**
 * Visitor journey / section-order flow evaluation.
 */

import type {
  FlowEvaluation,
  FlowIssue,
  PageSectionInventory,
  SectionEvaluation,
  WebsiteSectionId,
} from "@/lib/creative-director/types";

const IDEAL_SERVICE_PATH: WebsiteSectionId[] = [
  "hero",
  "about",
  "services",
  "gallery",
  "testimonials",
  "faq",
  "cta",
  "contact",
  "footer",
];

function indexOf(order: WebsiteSectionId[], id: WebsiteSectionId): number {
  return order.indexOf(id);
}

export function evaluateWebsiteFlow(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
}): FlowEvaluation {
  const order = input.inventory.order;
  const present = input.inventory.present;
  const issues: FlowIssue[] = [];
  let score = 78;

  const hero = indexOf(order, "hero");
  const services = indexOf(order, "services");
  const gallery = indexOf(order, "gallery");
  const testimonials = indexOf(order, "testimonials");
  const contact = indexOf(order, "contact");
  const pricing = indexOf(order, "pricing");
  const cta = indexOf(order, "cta");

  const hasProof =
    present.has("testimonials") && input.inventory.testimonialCount > 0;
  const hasGallery =
    present.has("gallery") && input.inventory.gallerySlots > 0;

  // Contact / CTA before proof
  if (
    contact >= 0 &&
    (!hasProof || testimonials < 0 || contact < testimonials) &&
    contact <= 3
  ) {
    issues.push({
      kind: "contact_before_proof",
      severity: "high",
      explanation:
        "Contact appears before visitors have enough proof to feel confident reaching out.",
    });
    score -= 16;
  }

  if (!hasProof && contact >= 0 && hero >= 0) {
    issues.push({
      kind: "ask_before_trust",
      severity: "high",
      explanation:
        "The page asks for contact without social proof that earns the ask.",
    });
    score -= 14;
  }

  if (hasProof && services >= 0 && testimonials > services + 2) {
    issues.push({
      kind: "testimonials_too_late",
      severity: "medium",
      explanation:
        "Testimonials arrive too late — after visitors have already judged the offer.",
    });
    score -= 10;
  }

  if (hasGallery && gallery >= 0 && gallery < services && services >= 0) {
    issues.push({
      kind: "gallery_too_early",
      severity: "low",
      explanation:
        "Gallery appears before services clarify what the photos are proving.",
    });
    score -= 4;
  }

  if (pricing >= 0 && (!hasProof || (testimonials >= 0 && pricing < testimonials))) {
    if (pricing < services || (services >= 0 && pricing <= services + 1 && !hasProof)) {
      issues.push({
        kind: "pricing_before_value",
        severity: "medium",
        explanation:
          "Pricing appears before value and proof are fully established.",
      });
      score -= 8;
    }
  }

  if (cta >= 0 && contact >= 0 && cta > contact) {
    issues.push({
      kind: "weak_cta_progression",
      severity: "low",
      explanation:
        "The conversion path peaks after contact instead of guiding toward it.",
    });
    score -= 4;
  }

  if (input.inventory.description.length > 500 && input.inventory.servicesCount > 6) {
    issues.push({
      kind: "information_overload",
      severity: "medium",
      explanation:
        "The page asks visitors to absorb a lot of copy and offers at once.",
    });
    score -= 8;
  }

  if (!hasProof && !hasGallery) {
    issues.push({
      kind: "weak_narrative",
      severity: "high",
      explanation:
        "Without proof imagery or testimonials, the story stalls after the promise.",
    });
    score -= 12;
  }

  const actualPath = order.map(String);
  const idealPath = IDEAL_SERVICE_PATH.filter((id) => present.has(id)).map(String);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    idealPath,
    actualPath,
    issues,
    explanation:
      issues.length === 0
        ? "Section order supports a natural trust-to-conversion journey."
        : `Flow has ${issues.length} sequencing issue${issues.length === 1 ? "" : "s"} that weaken trust before the ask.`,
  };
}
