import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const HIERARCHY_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "hierarchy.one_dominant_per_region",
    category: "hierarchy",
    title: "One dominant element per region",
    principle:
      "Each viewport region should have a single dominant element that wins the eye first.",
    reasoning:
      "Multiple equal dominants create visual conflict and slow comprehension.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["competing emphasis", "flat hierarchy", "visual hierarchy", "weak hero"],
    relatedPrincipleIds: ["homepage.clear_hero_hierarchy", "hierarchy.reduce_competing_emphasis"],
    recommendedActions: ["establish one dominant per region"],
  },
  {
    id: "hierarchy.contrast_size_weight",
    category: "hierarchy",
    title: "Contrast through size, weight, spacing, and placement",
    principle:
      "Hierarchy should be built from size, weight, spacing, and placement — not only color.",
    reasoning:
      "Color-only hierarchy fails accessibility and often fails visually on varied surfaces.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["weak heading scale", "flat typography", "visual hierarchy", "contrast"],
    relatedPrincipleIds: ["typography.clear_heading_hierarchy", "accessibility.not_color_alone"],
    recommendedActions: ["increase size/weight contrast"],
  },
  {
    id: "hierarchy.scan_paths",
    category: "hierarchy",
    title: "Clear scan paths",
    principle:
      "Visitors should be able to scan promise → proof → action without hunting.",
    reasoning:
      "Broken scan paths bury conversion moments even when all content exists somewhere.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["scan path", "hard to scan", "busy layout", "message overload"],
    relatedPrincipleIds: ["typography.scannable_emphasis", "layout.focal_point_placement"],
    recommendedActions: ["clarify scan path to CTA"],
  },
  {
    id: "hierarchy.cta_prominence",
    category: "hierarchy",
    title: "CTA prominence",
    principle:
      "The primary CTA should be visually unmistakable relative to surrounding controls.",
    reasoning:
      "A weak CTA hierarchy is a conversion problem disguised as a styling preference.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "local-business", "all"],
    signals: ["weak cta hierarchy", "cta", "competing buttons", "button style"],
    relatedPrincipleIds: ["homepage.one_dominant_cta", "conversion.one_primary_goal"],
    recommendedActions: ["raise primary CTA prominence"],
  },
  {
    id: "hierarchy.section_level",
    category: "hierarchy",
    title: "Section-level hierarchy",
    principle:
      "Within each section, title, support, media, and action should have clear rank order.",
    reasoning:
      "Sections without internal hierarchy feel like equal-weight content dumps.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["section hierarchy", "equal weight", "flat sections"],
    relatedPrincipleIds: ["layout.visual_grouping", "spacing.whitespace_as_hierarchy"],
    recommendedActions: ["rank elements inside key sections"],
  },
  {
    id: "hierarchy.progressive_disclosure",
    category: "hierarchy",
    title: "Progressive disclosure",
    principle:
      "Reveal detail after relevance — do not front-load every exception, service, and FAQ.",
    reasoning:
      "Early overload prevents visitors from ever reaching the decision that matters.",
    impact: "medium",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["message overload", "too much detail", "content density"],
    relatedPrincipleIds: ["homepage.controlled_density", "conversion.sequence_before_ask"],
    recommendedActions: ["defer secondary detail below the fold"],
  },
  {
    id: "hierarchy.reduce_competing_emphasis",
    category: "hierarchy",
    title: "Reduce competing emphasis",
    principle:
      "Badges, accents, icons, and bold lines should not all shout at once.",
    reasoning:
      "When everything is emphasized, nothing is.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["competing emphasis", "too many accents", "busy", "decorative noise"],
    relatedPrincipleIds: ["color.disciplined_accent", "homepage.restrained_secondary_actions"],
    recommendedActions: ["remove secondary emphasis"],
  },
  {
    id: "hierarchy.foundational_before_decorative",
    category: "hierarchy",
    title: "Foundational clarity before decorative polish",
    principle:
      "Fix clarity, contrast, proof, and CTA hierarchy before hover polish or micro-interactions.",
    reasoning:
      "Decorative enhancements on a confusing foundation raise polish without raising conversion.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["motion", "animation", "hover", "decorative", "weak hero", "low contrast"],
    relatedPrincipleIds: ["accessibility.quality_not_afterthought", "conversion.one_primary_goal"],
    recommendedActions: ["prioritize foundational fixes first"],
  },
];
