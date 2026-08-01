import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const SPACING_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "spacing.consistent_scale",
    category: "spacing",
    title: "Consistent spacing scale",
    principle:
      "Gaps between elements should follow a repeatable scale rather than arbitrary pixel jumps.",
    reasoning:
      "Inconsistent spacing is one of the fastest ways a site looks amateur even with good content.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["spacing", "default spacing", "inconsistent gaps", "flat spacing"],
    relatedPrincipleIds: ["spacing.section_rhythm", "typography.vertical_rhythm"],
    recommendedActions: ["set spacing scale", "setCreativePolish spacing"],
  },
  {
    id: "spacing.section_rhythm",
    category: "spacing",
    title: "Section rhythm",
    principle:
      "Sections should breathe with a steady cadence so the page feels paced, not stacked.",
    reasoning:
      "Identical tight packing across sections removes drama and makes scanning harder.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["section rhythm", "cramped sections", "default spacing"],
    relatedPrincipleIds: ["layout.intentional_section_flow", "spacing.whitespace_as_hierarchy"],
    recommendedActions: ["increase section spacing"],
  },
  {
    id: "spacing.group_related",
    category: "spacing",
    title: "Group related content",
    principle:
      "Related elements should sit closer together than unrelated ones (proximity).",
    reasoning:
      "When related content is spaced like unrelated content, meaning and hierarchy collapse.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["proximity", "grouping", "related content"],
    relatedPrincipleIds: ["layout.visual_grouping", "hierarchy.section_level"],
    recommendedActions: ["tighten related clusters"],
  },
  {
    id: "spacing.separate_unrelated",
    category: "spacing",
    title: "Separate unrelated content",
    principle:
      "Unrelated blocks need clearer separation so visitors do not misread relationships.",
    reasoning:
      "Crowding unrelated offers and proof together creates false associations and clutter.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["clutter", "unrelated content", "dense layout"],
    relatedPrincipleIds: ["spacing.group_related", "homepage.controlled_density"],
    recommendedActions: ["increase separation between unrelated blocks"],
  },
  {
    id: "spacing.whitespace_as_hierarchy",
    category: "spacing",
    title: "Whitespace as hierarchy",
    principle:
      "Whitespace should emphasize what matters — not merely fill leftover space.",
    reasoning:
      "Strategic emptiness creates premium perception and guides the eye better than added decoration.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["whitespace", "premium", "cramped", "default spacing", "visual hierarchy"],
    relatedPrincipleIds: ["hierarchy.contrast_size_weight", "branding.premium_restraint"],
    recommendedActions: ["add breathing room around hero and CTA"],
  },
  {
    id: "spacing.avoid_extremes",
    category: "spacing",
    title: "Avoid cramped and excessively empty layouts",
    principle:
      "Layouts should avoid both cramped packing and large empty voids that feel unfinished.",
    reasoning:
      "Extremes either overwhelm visitors or make the site feel content-starved.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["too empty", "cramped", "sparse", "uneven spacing"],
    relatedPrincipleIds: ["spacing.section_rhythm", "spacing.consistent_scale"],
    recommendedActions: ["normalize spacing extremes"],
  },
  {
    id: "spacing.mobile_compression",
    category: "spacing",
    title: "Mobile spacing compression",
    principle:
      "On mobile, spacing should compress thoughtfully without collapsing hierarchy into a single dense column.",
    reasoning:
      "Desktop air that becomes mobile clutter destroys rhythm and CTA clarity.",
    impact: "high",
    appliesTo: ["mobile", "all"],
    signals: ["mobile", "mobile spacing", "compressed layout"],
    relatedPrincipleIds: ["typography.mobile_behavior", "layout.responsive_stacking"],
    recommendedActions: ["review mobile section spacing"],
  },
  {
    id: "spacing.cta_breathing_room",
    category: "spacing",
    title: "CTA breathing room",
    principle:
      "Primary calls to action need surrounding space so they feel intentional and easy to tap.",
    reasoning:
      "CTAs jammed against dense copy or competing controls look accidental and convert worse.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "mobile", "all"],
    signals: ["cta spacing", "weak cta", "cramped cta", "button crowding"],
    relatedPrincipleIds: ["homepage.one_dominant_cta", "conversion.clear_cta_language"],
    recommendedActions: ["add space around primary CTA"],
  },
];
