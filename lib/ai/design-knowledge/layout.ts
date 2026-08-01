import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const LAYOUT_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "layout.intentional_section_flow",
    category: "layout",
    title: "Intentional section flow",
    principle:
      "Sections should progress in a deliberate story: promise → proof → offer → action.",
    reasoning:
      "Random section order forces visitors to assemble the narrative themselves.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "all"],
    signals: ["section order", "flow", "services before proof", "awkward sequence"],
    relatedPrincipleIds: ["homepage.first_scroll_transition", "conversion.sequence_before_ask"],
    recommendedActions: ["reorder sections for story"],
  },
  {
    id: "layout.alignment",
    category: "layout",
    title: "Alignment",
    principle:
      "Shared edges and columns should align so the composition feels intentional.",
    reasoning:
      "Slight misalignment reads as low craft even when content is strong.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["alignment", "ragged columns", "uneven edges"],
    relatedPrincipleIds: ["layout.visual_grouping", "layout.content_width"],
    recommendedActions: ["normalize alignment"],
  },
  {
    id: "layout.visual_grouping",
    category: "layout",
    title: "Visual grouping",
    principle:
      "Cards, lists, and media should form clear groups that match meaning.",
    reasoning:
      "Ungrouped modules make services and proof feel like unrelated fragments.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["grouping", "cards", "modules", "proximity"],
    relatedPrincipleIds: ["spacing.group_related", "hierarchy.section_level"],
    recommendedActions: ["group related modules"],
  },
  {
    id: "layout.alternating_composition",
    category: "layout",
    title: "Alternating composition without forced repetition",
    principle:
      "Vary composition across sections when it aids scanning — without mechanical left/right alternation.",
    reasoning:
      "Forced zig-zag patterns feel templated; identical blocks feel monotonous.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["repetitive sections", "identical treatment", "alternating layout"],
    relatedPrincipleIds: ["layout.avoid_identical_treatment", "hierarchy.section_level"],
    recommendedActions: ["vary section composition thoughtfully"],
    cautions: ["Do not alternate purely for decoration."],
  },
  {
    id: "layout.content_width",
    category: "layout",
    title: "Content width",
    principle:
      "Primary reading and offer content should sit in a controlled width suited to the brand.",
    reasoning:
      "Overly wide content weakens focus; overly narrow content can feel timid for bold brands.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["site width", "content width", "wide measure"],
    relatedPrincipleIds: ["typography.controlled_paragraph_width", "branding.premium_restraint"],
    recommendedActions: ["set site width"],
  },
  {
    id: "layout.responsive_stacking",
    category: "layout",
    title: "Responsive stacking",
    principle:
      "Multi-column layouts should stack into a clear mobile order that preserves priority.",
    reasoning:
      "Bad stacking can bury the CTA or proof below less important content on phones.",
    impact: "high",
    appliesTo: ["mobile", "all"],
    signals: ["mobile", "stacking", "responsive order"],
    relatedPrincipleIds: ["spacing.mobile_compression", "homepage.one_dominant_cta"],
    recommendedActions: ["fix mobile stack order"],
  },
  {
    id: "layout.focal_point_placement",
    category: "layout",
    title: "Focal-point placement",
    principle:
      "Each major region should place its focal point where the eye naturally enters.",
    reasoning:
      "Important imagery or headlines placed in dead zones are effectively invisible.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "portfolio", "all"],
    signals: ["focal point", "hero composition", "eye path"],
    relatedPrincipleIds: ["imagery.hero_focal_point", "hierarchy.scan_paths"],
    recommendedActions: ["reposition hero focal content"],
  },
  {
    id: "layout.asymmetry_when_appropriate",
    category: "layout",
    title: "Asymmetry when appropriate",
    principle:
      "Asymmetry can create energy and premium feel when balance and hierarchy remain clear.",
    reasoning:
      "Rigid symmetry can feel generic; uncontrolled asymmetry feels messy.",
    impact: "low",
    appliesTo: ["homepage", "portfolio", "landing-page"],
    signals: ["asymmetry", "editorial layout", "static symmetry"],
    relatedPrincipleIds: ["branding.visual_personality", "layout.focal_point_placement"],
    recommendedActions: ["introduce intentional asymmetry"],
    cautions: ["Prefer clarity over novelty for trust-heavy local services."],
  },
  {
    id: "layout.avoid_identical_treatment",
    category: "layout",
    title: "Avoid identical section treatment",
    principle:
      "Do not treat every section with the same card, density, and emphasis pattern.",
    reasoning:
      "Identical treatment flattens importance and makes the page feel like a template loop.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["identical sections", "template loop", "monotony"],
    relatedPrincipleIds: ["layout.alternating_composition", "hierarchy.section_level"],
    recommendedActions: ["differentiate key sections"],
  },
  {
    id: "layout.service_vs_portfolio_flow",
    category: "layout",
    title: "Industry-appropriate flow",
    principle:
      "Service businesses often need proof early; portfolio sites may lead with work before contact.",
    reasoning:
      "Applying one homepage formula to every industry creates awkward or conversion-hostile flows.",
    impact: "medium",
    appliesTo: ["service-business", "portfolio", "local-business", "homepage"],
    signals: ["portfolio", "service business", "section order", "industry fit"],
    relatedPrincipleIds: ["branding.industry_fit", "conversion.visitor_intent"],
    recommendedActions: ["adapt section flow to industry"],
    cautions: ["Do not force testimonials above a gallery on a portfolio-first brand."],
  },
];
