import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const HOMEPAGE_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "homepage.one_clear_promise",
    category: "homepage",
    title: "One clear above-the-fold promise",
    principle:
      "The first screen should communicate one primary offer the intended customer immediately understands.",
    reasoning:
      "Split promises force visitors to decode the business before they can decide if it is for them.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "local-business", "all"],
    signals: ["hero", "promise", "headline", "unclear offer", "message overload"],
    relatedPrincipleIds: ["homepage.concise_hero_copy", "hierarchy.one_dominant_per_region"],
    recommendedActions: ["tighten hero headline", "reduce hero competing messages"],
  },
  {
    id: "homepage.one_dominant_cta",
    category: "homepage",
    title: "One dominant primary action",
    principle:
      "Above the fold, one primary call to action should clearly outrank secondary paths.",
    reasoning:
      "Equal CTAs create choice paralysis and weaken conversion intent at the moment of first interest.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "local-business", "all"],
    signals: ["cta", "primary action", "competing buttons", "weak cta hierarchy"],
    relatedPrincipleIds: ["conversion.one_primary_goal", "hierarchy.cta_prominence"],
    recommendedActions: ["strengthen primary CTA", "demote secondary CTA"],
    cautions: ["Portfolio sites may lead with browse/work before contact."],
  },
  {
    id: "homepage.restrained_secondary_actions",
    category: "homepage",
    title: "Restrained secondary actions",
    principle:
      "Secondary actions may exist, but they should never visually compete with the primary ask.",
    reasoning:
      "Secondary links that look identical to the primary CTA dilute hierarchy and decision clarity.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "service-business", "all"],
    signals: ["secondary cta", "competing buttons", "nav overload"],
    relatedPrincipleIds: ["homepage.one_dominant_cta", "hierarchy.reduce_competing_emphasis"],
    recommendedActions: ["soften secondary CTA style", "shorten navigation"],
  },
  {
    id: "homepage.clear_hero_hierarchy",
    category: "homepage",
    title: "Clear hero hierarchy",
    principle:
      "Hero composition should lead eyebrow → promise → support → action in an obvious scan path.",
    reasoning:
      "When type, image, and buttons share equal weight, visitors cannot find the story or the next step.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["hero hierarchy", "visual hierarchy", "flat hero", "weak heading scale"],
    relatedPrincipleIds: ["hierarchy.one_dominant_per_region", "typography.clear_heading_hierarchy"],
    recommendedActions: ["enable visual hierarchy", "set typography scale"],
  },
  {
    id: "homepage.concise_hero_copy",
    category: "homepage",
    title: "Concise hero copy",
    principle:
      "Hero copy should be short enough to scan in seconds while still naming the offer and customer.",
    reasoning:
      "Long hero paragraphs delay recognition of relevance and bury the call to action.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "all"],
    signals: ["long hero", "message overload", "dense copy", "long paragraphs"],
    relatedPrincipleIds: ["homepage.one_clear_promise", "typography.controlled_paragraph_width"],
    recommendedActions: ["shorten hero description", "tighten hero headline"],
  },
  {
    id: "homepage.trust_near_first_ask",
    category: "homepage",
    title: "Visible trust near the first conversion ask",
    principle:
      "Proof should appear before or beside the first high-commitment ask on the homepage.",
    reasoning:
      "Asking for a quote or booking without nearby credibility forces visitors to decide on trust later — often never.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "local-business", "landing-page"],
    signals: ["no testimonials", "trust gap", "proof missing", "cta without proof"],
    relatedPrincipleIds: ["trust.proof_before_high_commitment", "conversion.sequence_before_ask"],
    recommendedActions: ["insert testimonials near hero", "surface reviews near CTA"],
  },
  {
    id: "homepage.purposeful_hero_imagery",
    category: "homepage",
    title: "Purposeful hero imagery",
    principle:
      "Hero imagery should prove the offer or atmosphere — not act as empty decoration.",
    reasoning:
      "A text-only or placeholder hero leaves local and service businesses looking unfinished at first glance.",
    impact: "high",
    appliesTo: ["homepage", "local-business", "service-business", "landing-page"],
    signals: ["no hero image", "placeholder hero", "missing imagery", "generic stock"],
    relatedPrincipleIds: ["imagery.authentic_over_stock", "imagery.hero_focal_point"],
    recommendedActions: ["replace hero image", "set hero from library"],
    cautions: [
      "Some portfolio or editorial brands may intentionally lead with type; still ensure the first impression feels finished.",
    ],
  },
  {
    id: "homepage.controlled_density",
    category: "homepage",
    title: "Controlled content density",
    principle:
      "The first viewport should not try to communicate every service, proof point, and offer at once.",
    reasoning:
      "Dense first screens raise cognitive load and make the homepage feel like a brochure dump.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["content density", "message overload", "too many sections", "busy hero"],
    relatedPrincipleIds: ["spacing.whitespace_as_hierarchy", "hierarchy.progressive_disclosure"],
    recommendedActions: ["reduce hero content", "increase whitespace"],
  },
  {
    id: "homepage.first_scroll_transition",
    category: "homepage",
    title: "Clear first-scroll transition",
    principle:
      "The first scroll should land on purposeful next content — proof, work, or services — not a dead zone.",
    reasoning:
      "A weak transition after the hero breaks momentum and makes the rest of the page feel disconnected.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["section order", "first scroll", "awkward flow", "services before proof"],
    relatedPrincipleIds: ["layout.intentional_section_flow", "trust.proof_before_high_commitment"],
    recommendedActions: ["reorder sections", "move proof below hero"],
  },
  {
    id: "homepage.immediate_customer_relevance",
    category: "homepage",
    title: "Immediate relevance to the intended customer",
    principle:
      "Within seconds, a visitor should know whether this business is for people like them.",
    reasoning:
      "Generic positioning delays self-qualification and weakens both trust and conversion.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "local-business", "landing-page", "all"],
    signals: ["unclear audience", "generic messaging", "who we serve"],
    relatedPrincipleIds: ["branding.tone_alignment", "conversion.visitor_intent"],
    recommendedActions: ["sharpen hero for audience", "name customer in hero"],
  },
];
