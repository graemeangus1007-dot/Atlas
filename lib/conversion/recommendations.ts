/**
 * Conversion recommendations — analysis only (Phase 1).
 * Every recommendation declares owner + domain for scope enforcement.
 */

import { filterRecommendationsByScope } from "@/lib/scope";
import type {
  ConversionDimensionId,
  ConversionRecommendation,
  ConversionSignals,
} from "@/lib/conversion/types";

export function buildConversionRecommendations(input: {
  scores: Record<ConversionDimensionId, number>;
  signals: ConversionSignals;
  highestPriorityImprovement: ConversionDimensionId | null;
  /** When false, CTA can be refined without new business facts. */
  ctaCanRefineSafely?: boolean;
}): ConversionRecommendation[] {
  const recs: ConversionRecommendation[] = [];
  const { scores, signals } = input;

  if (scores.proof < 72 || !signals.proofBeforeAsk) {
    recs.push({
      owner: "conversion_director",
      domain: "proof",
      title: "Put proof before the ask",
      explanation:
        "Visitors are asked to convert before they see enough evidence. Sequencing testimonials or project proof earlier would raise trust at the decision moment.",
      priority: "high",
      estimatedImpact: 22,
      requiresBusinessInput: signals.testimonialCount === 0,
      improves: ["proof", "trust"],
    });
  }

  if (scores.ctaStrength < 70) {
    const canRefine = input.ctaCanRefineSafely === true;
    recs.push({
      owner: "conversion_director",
      domain: "cta",
      title: "Make the primary CTA specific",
      explanation: canRefine
        ? "The main call-to-action is too generic to feel like a clear next step. A more specific action matching the site’s real destinations would improve lead generation."
        : "The main call-to-action is too generic to feel like a clear next step. A more specific action (quote, booking, consult) would improve lead generation once a safe destination exists.",
      priority: "high",
      estimatedImpact: 18,
      requiresBusinessInput: !canRefine,
      improves: ["ctaStrength", "contactFlow"],
    });
  }

  if (scores.trust < 68) {
    recs.push({
      owner: "conversion_director",
      domain: "trust",
      title: "Strengthen trust signals before contact",
      explanation:
        "Credibility cues are thin relative to the ask. Adding verifiable proof and clear contact details would make visitors more willing to inquire.",
      priority: "high",
      estimatedImpact: 20,
      requiresBusinessInput: signals.testimonialCount < 2,
      improves: ["trust", "proof"],
    });
  }

  if (scores.offerStrength < 70) {
    recs.push({
      owner: "conversion_director",
      domain: "offer",
      title: "Clarify the primary offer",
      explanation:
        "The visitor may not immediately understand what they get. Sharpening the promise and service focus would improve offer strength without redesigning the page.",
      priority: "medium",
      estimatedImpact: 16,
      requiresBusinessInput: true,
      improves: ["offerStrength"],
    });
  }

  if (scores.friction < 68) {
    recs.push({
      owner: "conversion_director",
      domain: "friction",
      title: "Reduce inquiry friction",
      explanation:
        "The path to inquire still asks visitors to work too hard. A clearer form path, phone access, and answered questions would lower hesitation.",
      priority: "medium",
      estimatedImpact: 14,
      requiresBusinessInput: false,
      improves: ["friction", "contactFlow"],
    });
  }

  if (scores.contactFlow < 68) {
    recs.push({
      owner: "conversion_director",
      domain: "contact_flow",
      title: "Simplify the contact path",
      explanation:
        "Contact options are incomplete or hard to act on. Making phone, form, and location easy to find would improve lead capture.",
      priority: "medium",
      estimatedImpact: 14,
      requiresBusinessInput: !signals.contactPhone,
      improves: ["contactFlow", "friction"],
    });
  }

  if (scores.objectionHandling < 65) {
    recs.push({
      owner: "conversion_director",
      domain: "objections",
      title: "Answer common objections",
      explanation:
        "Likely visitor doubts are not addressed on the page. FAQ or pricing cues would handle objections before they block the inquiry.",
      priority: "medium",
      estimatedImpact: 12,
      requiresBusinessInput: true,
      improves: ["objectionHandling", "friction"],
    });
  }

  if (scores.urgency < 55) {
    recs.push({
      owner: "conversion_director",
      domain: "urgency",
      title: "Add an appropriate next-step cue",
      explanation:
        "There is little sense of when to act. A calm booking or consult cue — not fake scarcity — would improve timely inquiries.",
      priority: "low",
      estimatedImpact: 8,
      requiresBusinessInput: true,
      improves: ["urgency", "ctaStrength"],
    });
  }

  // Ensure highest priority dimension has a rec
  const top = input.highestPriorityImprovement;
  if (top && !recs.some((r) => r.improves.includes(top))) {
    recs.unshift({
      owner: "conversion_director",
      domain: domainForDimension(top),
      title: `Improve ${labelDimension(top)}`,
      explanation: `The highest-ROI conversion gap right now is ${labelDimension(top)}. Addressing it would raise inquiry confidence without changing layout or brand.`,
      priority: "high",
      estimatedImpact: 12,
      requiresBusinessInput: top === "offerStrength" || top === "ctaStrength",
      improves: [top],
    });
  }

  const scoped = filterRecommendationsByScope(recs);
  return scoped.allowed as ConversionRecommendation[];
}

function domainForDimension(
  id: ConversionDimensionId,
): ConversionRecommendation["domain"] {
  switch (id) {
    case "trust":
      return "trust";
    case "offerStrength":
      return "offer";
    case "ctaStrength":
      return "cta";
    case "proof":
      return "proof";
    case "friction":
      return "friction";
    case "urgency":
      return "urgency";
    case "contactFlow":
      return "contact_flow";
    case "objectionHandling":
      return "objections";
    default:
      return "lead_generation";
  }
}

function labelDimension(id: ConversionDimensionId): string {
  const map: Record<ConversionDimensionId, string> = {
    trust: "trust",
    offerStrength: "offer clarity",
    ctaStrength: "CTA strength",
    proof: "proof",
    friction: "friction",
    urgency: "urgency",
    contactFlow: "contact flow",
    objectionHandling: "objection handling",
  };
  return map[id];
}
