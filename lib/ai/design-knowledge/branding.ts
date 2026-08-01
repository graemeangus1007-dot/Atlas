import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const BRANDING_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "branding.consistency",
    category: "branding",
    title: "Brand consistency",
    principle:
      "Type, color, imagery, and voice should feel like one system across the homepage.",
    reasoning:
      "Inconsistency reads as unfinished even when individual parts are tasteful.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["inconsistent brand", "mixed styles", "coherence"],
    relatedPrincipleIds: ["branding.coherence", "color.consistency"],
    recommendedActions: ["unify type, color, and imagery roles"],
  },
  {
    id: "branding.differentiation",
    category: "branding",
    title: "Differentiation",
    principle:
      "The site should feel specific to this business — not interchangeable with any competitor template.",
    reasoning:
      "Generic “nice” design fails to create memory or preference.",
    impact: "high",
    appliesTo: ["all", "service-business", "local-business"],
    signals: ["generic", "template look", "undifferentiated"],
    relatedPrincipleIds: ["color.avoid_cliche_mappings", "branding.visual_personality"],
    recommendedActions: ["strengthen distinctive brand cues"],
  },
  {
    id: "branding.visual_personality",
    category: "branding",
    title: "Visual personality",
    principle:
      "Composition, type, and imagery should express a clear personality — calm, bold, craft, clinical, etc.",
    reasoning:
      "Personality-less polish feels corporate-default and forgettable.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["personality", "tone", "visual voice"],
    relatedPrincipleIds: ["branding.tone_alignment", "layout.asymmetry_when_appropriate"],
    recommendedActions: ["express a clearer visual personality"],
  },
  {
    id: "branding.tone_alignment",
    category: "branding",
    title: "Tone alignment",
    principle:
      "Copy tone and visual tone should agree — playful copy with rigid corporate visuals creates distrust.",
    reasoning:
      "Misaligned tone makes the brand feel inauthentic.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["tone mismatch", "business tone", "voice"],
    relatedPrincipleIds: ["branding.authenticity", "homepage.immediate_customer_relevance"],
    recommendedActions: ["align copy and visuals to one tone"],
  },
  {
    id: "branding.memorability",
    category: "branding",
    title: "Memorability",
    principle:
      "One distinctive cue — motif, type move, image style, or color role — should be memorable.",
    reasoning:
      "Without a memory hook, even competent sites disappear after the visit.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["forgettable", "no distinctive cue", "generic"],
    relatedPrincipleIds: ["branding.differentiation", "branding.visual_personality"],
    recommendedActions: ["introduce one memorable brand cue"],
  },
  {
    id: "branding.authenticity",
    category: "branding",
    title: "Authenticity",
    principle:
      "Claims, photos, and language should feel true to the real business and customers.",
    reasoning:
      "Over-polished fiction undercuts trust faster than honest craft.",
    impact: "high",
    appliesTo: ["local-business", "service-business", "all"],
    signals: ["inauthentic", "generic stock", "overclaim"],
    relatedPrincipleIds: ["imagery.authentic_over_stock", "trust.real_project_photography"],
    recommendedActions: ["prefer authentic proof and language"],
  },
  {
    id: "branding.industry_fit",
    category: "branding",
    title: "Industry fit without becoming generic",
    principle:
      "Design should fit the industry’s expectations while still feeling specific to the brand.",
    reasoning:
      "Ignoring category norms confuses buyers; copying category clichés erases differentiation.",
    impact: "high",
    appliesTo: ["service-business", "local-business", "portfolio", "all"],
    signals: ["industry fit", "category cliché", "landscap", "legal", "medical"],
    relatedPrincipleIds: ["layout.service_vs_portfolio_flow", "color.avoid_cliche_mappings"],
    recommendedActions: ["fit category norms with distinctive execution"],
  },
  {
    id: "branding.premium_restraint",
    category: "branding",
    title: "Premium perception through restraint",
    principle:
      "Premium feel comes from restraint, consistency, and hierarchy — not more ornaments.",
    reasoning:
      "Extra decorations usually make sites feel cheaper, not more luxurious.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["premium", "ornament", "busy", "luxury cliché"],
    relatedPrincipleIds: ["spacing.whitespace_as_hierarchy", "hierarchy.reduce_competing_emphasis"],
    recommendedActions: ["reduce ornament; increase restraint"],
  },
  {
    id: "branding.coherence",
    category: "branding",
    title: "Coherent identity system",
    principle:
      "Copy, imagery, typography, and color should resolve into one coherent identity.",
    reasoning:
      "Partial systems (great type, random photos) still feel unfinished.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["incoherent", "mixed identity", "system"],
    relatedPrincipleIds: ["branding.consistency", "imagery.image_treatment_consistency"],
    recommendedActions: ["align all identity channels"],
  },
  {
    id: "branding.customer_fit",
    category: "branding",
    title: "Customer-fit branding",
    principle:
      "Brand expression should appeal to the stated audience, not an abstract design trend.",
    reasoning:
      "Trend-led aesthetics can alienate the actual buyer even when peers admire them.",
    impact: "medium",
    appliesTo: ["all", "service-business", "local-business"],
    signals: ["audience", "customer fit", "wrong vibe"],
    relatedPrincipleIds: ["homepage.immediate_customer_relevance", "branding.tone_alignment"],
    recommendedActions: ["tune brand expression to audience"],
  },
];
