import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const TRUST_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "trust.proof_before_high_commitment",
    category: "trust",
    title: "Proof before high-commitment asks",
    principle:
      "Place testimonials, reviews, or project proof before or beside quote/booking requests.",
    reasoning:
      "High-commitment asks without prior proof feel premature and suppress leads.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "local-business", "landing-page"],
    signals: ["no testimonials", "trust gap", "proof missing", "quote", "request a quote"],
    relatedPrincipleIds: ["homepage.trust_near_first_ask", "conversion.sequence_before_ask"],
    recommendedActions: ["move proof near first ask", "insert testimonials"],
  },
  {
    id: "trust.testimonials_at_decision_points",
    category: "trust",
    title: "Testimonials near decision points",
    principle:
      "Testimonials should sit at moments of evaluation — not only in a distant footer block.",
    reasoning:
      "Proof that is present but poorly placed fails to reduce hesitation when it matters.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "local-business", "landing-page"],
    signals: ["testimonials", "social proof", "decision point", "cta"],
    relatedPrincipleIds: ["trust.proof_before_high_commitment", "conversion.reassurance_near_forms"],
    recommendedActions: ["place testimonials below hero or near form"],
  },
  {
    id: "trust.real_project_photography",
    category: "trust",
    title: "Real project photography",
    principle:
      "Show real completed work whenever possible — especially for local trade and service brands.",
    reasoning:
      "Generic lifestyle stock rarely proves capability the way authentic project photos do.",
    impact: "high",
    appliesTo: ["local-business", "service-business", "portfolio", "homepage"],
    signals: ["no hero image", "gallery empty", "generic stock", "missing imagery", "project photos"],
    relatedPrincipleIds: ["imagery.authentic_over_stock", "imagery.gallery_purpose"],
    recommendedActions: ["surface real project photos"],
  },
  {
    id: "trust.reviews_and_ratings",
    category: "trust",
    title: "Reviews and ratings",
    principle:
      "Visible reviews or ratings help visitors transfer confidence from past customers.",
    reasoning:
      "Many buyers treat third-party or named praise as stronger than brand claims alone.",
    impact: "medium",
    appliesTo: ["local-business", "service-business", "homepage"],
    signals: ["reviews", "ratings", "social proof"],
    relatedPrincipleIds: ["trust.testimonials_at_decision_points", "trust.local_credibility"],
    recommendedActions: ["surface reviews near CTA"],
  },
  {
    id: "trust.certifications_guarantees",
    category: "trust",
    title: "Certifications and guarantees",
    principle:
      "Relevant certifications, warranties, or guarantees should appear where risk feels high.",
    reasoning:
      "Risk-reducing signals convert better when tied to the ask, not buried in about copy.",
    impact: "medium",
    appliesTo: ["service-business", "local-business", "homepage"],
    signals: ["guarantee", "certified", "warranty", "licensed"],
    relatedPrincipleIds: ["trust.proof_before_high_commitment", "conversion.objection_handling"],
    recommendedActions: ["surface guarantee near form"],
  },
  {
    id: "trust.local_credibility",
    category: "trust",
    title: "Local credibility",
    principle:
      "Local businesses should make place, service area, and community relevance obvious.",
    reasoning:
      "Visitors hiring nearby providers look for geographic fit as a trust filter.",
    impact: "high",
    appliesTo: ["local-business", "service-business", "homepage"],
    signals: ["local", "service area", "city", "neighborhood", "landscap"],
    relatedPrincipleIds: ["branding.industry_fit", "trust.transparent_contact"],
    recommendedActions: ["clarify service area and locality"],
  },
  {
    id: "trust.clear_process",
    category: "trust",
    title: "Clear process",
    principle:
      "Show how working together works — steps reduce uncertainty before contact.",
    reasoning:
      "Unknown process is a hidden objection that stalls otherwise interested visitors.",
    impact: "medium",
    appliesTo: ["service-business", "local-business", "homepage"],
    signals: ["process", "how it works", "steps", "faq"],
    relatedPrincipleIds: ["conversion.objection_handling", "trust.team_credibility"],
    recommendedActions: ["add or clarify process steps"],
  },
  {
    id: "trust.team_credibility",
    category: "trust",
    title: "Team credibility",
    principle:
      "People and expertise signals help professional services feel accountable and real.",
    reasoning:
      "Anonymous service brands convert worse when the purchase feels high-risk.",
    impact: "medium",
    appliesTo: ["service-business", "homepage"],
    signals: ["team", "about", "expertise", "who we are"],
    relatedPrincipleIds: ["trust.clear_process", "branding.authenticity"],
    recommendedActions: ["surface team or expertise cues"],
  },
  {
    id: "trust.before_after_proof",
    category: "trust",
    title: "Before-and-after proof",
    principle:
      "Transformation proof is powerful when the business sells visible results.",
    reasoning:
      "Before/after evidence collapses skepticism faster than adjectives about quality.",
    impact: "high",
    appliesTo: ["local-business", "portfolio", "service-business"],
    signals: ["before and after", "transformation", "gallery", "results"],
    relatedPrincipleIds: ["imagery.before_after_use", "trust.real_project_photography"],
    recommendedActions: ["feature before/after or result pairs"],
  },
  {
    id: "trust.transparent_contact",
    category: "trust",
    title: "Transparent contact information",
    principle:
      "Phone, email, location, or clear contact paths should be easy to find and believe.",
    reasoning:
      "Hidden contact details make businesses feel evasive, especially for local hiring.",
    impact: "high",
    appliesTo: ["local-business", "service-business", "homepage", "all"],
    signals: ["contact", "phone", "email", "address", "hidden contact"],
    relatedPrincipleIds: ["conversion.contact_method_priority", "trust.local_credibility"],
    recommendedActions: ["make contact details obvious"],
  },
];
