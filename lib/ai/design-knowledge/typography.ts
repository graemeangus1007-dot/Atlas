import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const TYPOGRAPHY_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "typography.clear_heading_hierarchy",
    category: "typography",
    title: "Clear heading hierarchy",
    principle:
      "Heading sizes and weights should form an obvious H1 → H2 → H3 ladder visitors can scan.",
    reasoning:
      "Technically valid type can still feel flat when every heading competes at similar scale.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["weak heading scale", "flat typography", "visual hierarchy", "heading"],
    relatedPrincipleIds: ["hierarchy.contrast_size_weight", "homepage.clear_hero_hierarchy"],
    recommendedActions: ["set typography", "enable visual hierarchy"],
  },
  {
    id: "typography.readable_body_size",
    category: "typography",
    title: "Readable body size",
    principle:
      "Body text should be large enough for comfortable reading on desktop and mobile.",
    reasoning:
      "Small body copy reduces comprehension and makes even strong writing feel low-quality.",
    impact: "high",
    appliesTo: ["all", "mobile"],
    signals: ["small body", "unreadable type", "body size"],
    relatedPrincipleIds: ["accessibility.readable_type", "typography.line_height"],
    recommendedActions: ["increase body size", "set typography"],
  },
  {
    id: "typography.line_height",
    category: "typography",
    title: "Appropriate line height",
    principle:
      "Line height should give body copy air without drifting into sparse, disconnected lines.",
    reasoning:
      "Tight leading feels cramped; overly loose leading weakens paragraph cohesion.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["line height", "leading", "cramped text", "sparse text"],
    relatedPrincipleIds: ["typography.readable_body_size", "typography.vertical_rhythm"],
    recommendedActions: ["adjust line height", "set typography"],
  },
  {
    id: "typography.controlled_paragraph_width",
    category: "typography",
    title: "Controlled paragraph width",
    principle:
      "Long-form text should stay within a comfortable measure so lines do not stretch edge to edge.",
    reasoning:
      "Wide paragraphs fatigue readers and make professional-service content feel unfinished.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "all"],
    signals: ["long paragraphs", "wide measure", "about body", "dense copy"],
    relatedPrincipleIds: ["layout.content_width", "homepage.concise_hero_copy"],
    recommendedActions: ["narrow content width", "shorten long paragraphs"],
  },
  {
    id: "typography.vertical_rhythm",
    category: "typography",
    title: "Consistent vertical rhythm",
    principle:
      "Spacing between headings, paragraphs, and lists should follow a consistent rhythm.",
    reasoning:
      "Irregular type spacing makes the page feel hand-assembled rather than designed.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["vertical rhythm", "uneven type spacing", "spacing scale"],
    relatedPrincipleIds: ["spacing.consistent_scale", "spacing.section_rhythm"],
    recommendedActions: ["normalize spacing scale", "set creative polish spacing"],
  },
  {
    id: "typography.deliberate_font_pairing",
    category: "typography",
    title: "Deliberate font pairing",
    principle:
      "Heading and body fonts should feel intentionally paired, not accidentally mismatched.",
    reasoning:
      "Clashing or redundant pairings undermine brand coherence even when colors are strong.",
    impact: "medium",
    appliesTo: ["all", "service-business"],
    signals: ["font pairing", "typography", "heading font", "body font"],
    relatedPrincipleIds: ["branding.coherence", "typography.restrained_variety"],
    recommendedActions: ["set typography pairing"],
  },
  {
    id: "typography.restrained_variety",
    category: "typography",
    title: "Restrained font variety",
    principle:
      "Limit typefaces and decorative styles so emphasis remains meaningful.",
    reasoning:
      "Too many fonts or weights create noise and weaken hierarchy.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["too many fonts", "font variety", "decorative type"],
    relatedPrincipleIds: ["typography.deliberate_font_pairing", "hierarchy.reduce_competing_emphasis"],
    recommendedActions: ["simplify typefaces"],
  },
  {
    id: "typography.scannable_emphasis",
    category: "typography",
    title: "Scannable emphasis",
    principle:
      "Use weight, size, and short lines so key phrases can be scanned without reading every word.",
    reasoning:
      "Walls of evenly weighted text hide the offer, proof, and next step.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "service-business", "all"],
    signals: ["scannable", "emphasis", "wall of text", "weak heading scale", "long paragraphs"],
    relatedPrincipleIds: ["typography.clear_heading_hierarchy", "hierarchy.scan_paths"],
    recommendedActions: ["strengthen heading contrast", "shorten dense blocks"],
  },
  {
    id: "typography.readable_button_labels",
    category: "typography",
    title: "Readable button labels",
    principle:
      "Button labels should be short, action-led, and easy to read at a glance.",
    reasoning:
      "Vague or cramped labels make primary actions feel weaker than the surrounding copy.",
    impact: "medium",
    appliesTo: ["all", "mobile"],
    signals: ["button label", "cta language", "unclear cta"],
    relatedPrincipleIds: ["conversion.clear_cta_language", "accessibility.accessible_button_labels"],
    recommendedActions: ["rewrite CTA labels"],
  },
  {
    id: "typography.mobile_behavior",
    category: "typography",
    title: "Mobile typography behavior",
    principle:
      "Type should reflow with readable sizes and hierarchy on small screens, not just shrink uniformly.",
    reasoning:
      "Desktop-tuned type that collapses poorly on mobile destroys first impressions for local businesses.",
    impact: "high",
    appliesTo: ["mobile", "local-business", "all"],
    signals: ["mobile", "tap", "small screen typography", "overflow text"],
    relatedPrincipleIds: ["spacing.mobile_compression", "accessibility.tap_targets"],
    recommendedActions: ["review mobile type scale"],
  },
];
