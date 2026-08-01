import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const CONVERSION_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "conversion.one_primary_goal",
    category: "conversion",
    title: "One primary conversion goal",
    principle:
      "Each page should optimize for one primary conversion goal, with secondary paths clearly subordinate.",
    reasoning:
      "Multiple equal goals split attention and reduce completion of the valuable action.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "local-business", "all"],
    signals: ["primary goal", "competing cta", "weak cta hierarchy", "multiple asks"],
    relatedPrincipleIds: ["homepage.one_dominant_cta", "hierarchy.cta_prominence"],
    recommendedActions: ["define and emphasize one primary CTA"],
  },
  {
    id: "conversion.clear_cta_language",
    category: "conversion",
    title: "Clear CTA language",
    principle:
      "CTA labels should state the outcome in plain language visitors recognize.",
    reasoning:
      "Vague labels like “Submit” or “Learn more” hide the value of acting now.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["cta language", "vague cta", "button label", "learn more"],
    relatedPrincipleIds: ["typography.readable_button_labels", "accessibility.accessible_button_labels"],
    recommendedActions: ["rewrite CTA for outcome"],
  },
  {
    id: "conversion.repeated_ctas",
    category: "conversion",
    title: "Repeated CTAs at appropriate moments",
    principle:
      "Reintroduce the primary action after proof and offer sections — not on every line.",
    reasoning:
      "Visitors become ready at different moments; absent CTAs waste late-stage intent.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "service-business"],
    signals: ["missing cta later", "single cta only", "contact"],
    relatedPrincipleIds: ["conversion.one_primary_goal", "trust.proof_before_high_commitment"],
    recommendedActions: ["repeat primary CTA after proof"],
    cautions: ["Do not spam identical CTAs in every section."],
  },
  {
    id: "conversion.reduce_form_friction",
    category: "conversion",
    title: "Reduced form friction",
    principle:
      "Ask only for fields needed to start a quality conversation.",
    reasoning:
      "Long forms punish mobile users and convert curiosity into abandonment.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "mobile", "all"],
    signals: ["form friction", "long form", "too many fields"],
    relatedPrincipleIds: ["conversion.lead_quality_vs_volume", "conversion.reassurance_near_forms"],
    recommendedActions: ["shorten lead form"],
  },
  {
    id: "conversion.objection_handling",
    category: "conversion",
    title: "Objection handling",
    principle:
      "Answer common fears — price, process, timing, fit — before or beside the ask.",
    reasoning:
      "Unhandled objections silently end sessions that looked engaged.",
    impact: "medium",
    appliesTo: ["service-business", "local-business", "homepage"],
    signals: ["faq", "objections", "price concern", "process"],
    relatedPrincipleIds: ["trust.clear_process", "trust.certifications_guarantees"],
    recommendedActions: ["add FAQ or process near CTA"],
  },
  {
    id: "conversion.reassurance_near_forms",
    category: "conversion",
    title: "Reassurance near forms",
    principle:
      "Place privacy, response-time, or no-obligation cues beside contact forms.",
    reasoning:
      "Forms feel risky; nearby reassurance lowers the emotional cost of submitting.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "service-business", "all"],
    signals: ["form", "contact form", "hesitation", "privacy"],
    relatedPrincipleIds: ["trust.testimonials_at_decision_points", "conversion.reduce_form_friction"],
    recommendedActions: ["add reassurance near form"],
  },
  {
    id: "conversion.visitor_intent",
    category: "conversion",
    title: "Visitor intent",
    principle:
      "Match the ask to likely intent — browse, evaluate, or hire — rather than forcing one path too early.",
    reasoning:
      "A hard ask before relevance feels aggressive; a soft ask after readiness feels weak.",
    impact: "high",
    appliesTo: ["homepage", "portfolio", "service-business", "all"],
    signals: ["visitor intent", "wrong ask", "portfolio browse", "quote too early"],
    relatedPrincipleIds: ["layout.service_vs_portfolio_flow", "homepage.immediate_customer_relevance"],
    recommendedActions: ["align CTA intensity to intent"],
  },
  {
    id: "conversion.contact_method_priority",
    category: "conversion",
    title: "Contact-method prioritization",
    principle:
      "Prioritize the contact methods the business can actually answer well.",
    reasoning:
      "Offering every channel equally creates confusion and missed leads.",
    impact: "medium",
    appliesTo: ["local-business", "service-business", "homepage"],
    signals: ["phone", "email", "form", "contact methods"],
    relatedPrincipleIds: ["trust.transparent_contact", "conversion.one_primary_goal"],
    recommendedActions: ["prioritize best-response contact method"],
  },
  {
    id: "conversion.lead_quality_vs_volume",
    category: "conversion",
    title: "Lead quality versus lead volume",
    principle:
      "Optimize for qualified conversations when the offer is high-consideration — not raw form fills.",
    reasoning:
      "Frictionless spammy CTAs can increase junk leads while lowering close rates.",
    impact: "medium",
    appliesTo: ["service-business", "local-business"],
    signals: ["lead quality", "qualified leads", "high consideration"],
    relatedPrincipleIds: ["conversion.reduce_form_friction", "homepage.immediate_customer_relevance"],
    recommendedActions: ["qualify with clear offer and audience"],
    cautions: ["Do not add arbitrary friction that blocks good leads."],
  },
  {
    id: "conversion.sequence_before_ask",
    category: "conversion",
    title: "Information sequence before the ask",
    principle:
      "Visitors should understand offer, fit, and credibility before a high-commitment request.",
    reasoning:
      "Asking too early — before proof — is one of the most common homepage conversion failures.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "local-business"],
    signals: ["ask too early", "no testimonials", "proof missing", "request a quote"],
    relatedPrincipleIds: ["trust.proof_before_high_commitment", "homepage.trust_near_first_ask"],
    recommendedActions: ["sequence proof before high-commitment CTA"],
  },
];
