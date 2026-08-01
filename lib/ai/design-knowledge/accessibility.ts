import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const ACCESSIBILITY_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "accessibility.text_control_contrast",
    category: "accessibility",
    title: "Text and control contrast",
    principle:
      "Body text, headings, and interactive controls need reliable contrast against their backgrounds.",
    reasoning:
      "Contrast failures exclude users and make the site feel low-quality to everyone else.",
    impact: "high",
    appliesTo: ["all", "mobile"],
    signals: ["low contrast", "low button contrast", "contrast", "unreadable"],
    relatedPrincipleIds: ["color.contrast", "color.accessible_controls"],
    recommendedActions: ["fix contrast on text and buttons"],
  },
  {
    id: "accessibility.readable_type",
    category: "accessibility",
    title: "Readable type",
    principle:
      "Type size, weight, and spacing should remain readable without zooming.",
    reasoning:
      "Tiny or low-contrast type is both an access barrier and a craft failure.",
    impact: "high",
    appliesTo: ["all", "mobile"],
    signals: ["small body", "unreadable type", "weak heading scale"],
    relatedPrincipleIds: ["typography.readable_body_size", "typography.scannable_emphasis"],
    recommendedActions: ["increase readable type scale"],
  },
  {
    id: "accessibility.keyboard_access",
    category: "accessibility",
    title: "Keyboard access",
    principle:
      "Primary navigation and actions should remain usable via keyboard.",
    reasoning:
      "Pointer-only interactions exclude users and often hide focus bugs from authors.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["keyboard", "focus trap", "nav access"],
    relatedPrincipleIds: ["accessibility.meaningful_focus", "accessibility.quality_not_afterthought"],
    recommendedActions: ["ensure keyboard operable controls"],
  },
  {
    id: "accessibility.meaningful_focus",
    category: "accessibility",
    title: "Meaningful focus states",
    principle:
      "Focus styles should be visible and intentional — not removed for aesthetics.",
    reasoning:
      "Invisible focus makes keyboard use guesswork and signals careless polish.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["focus state", "outline removed", "keyboard"],
    relatedPrincipleIds: ["accessibility.keyboard_access", "color.accessible_controls"],
    recommendedActions: ["restore visible focus styles"],
  },
  {
    id: "accessibility.tap_targets",
    category: "accessibility",
    title: "Adequate tap targets",
    principle:
      "Buttons and links need comfortable tap targets, especially on mobile.",
    reasoning:
      "Tiny hit areas create frustration and missed conversions on phones.",
    impact: "high",
    appliesTo: ["mobile", "all"],
    signals: ["tap targets", "mobile", "small buttons", "cramped cta"],
    relatedPrincipleIds: ["spacing.cta_breathing_room", "typography.mobile_behavior"],
    recommendedActions: ["enlarge tap targets"],
  },
  {
    id: "accessibility.semantic_hierarchy",
    category: "accessibility",
    title: "Semantic hierarchy",
    principle:
      "Heading levels and structure should match the visual hierarchy visitors see.",
    reasoning:
      "Mismatched semantics hurt assistive tech and often reveal confused visual ranking.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["heading order", "semantic", "h1", "structure"],
    relatedPrincipleIds: ["typography.clear_heading_hierarchy", "hierarchy.section_level"],
    recommendedActions: ["align heading semantics to visual rank"],
  },
  {
    id: "accessibility.reduced_motion",
    category: "accessibility",
    title: "Reduced-motion support",
    principle:
      "Motion should respect reduced-motion preferences and never be required to understand content.",
    reasoning:
      "Decorative motion that cannot be quieted is both inaccessible and distracting.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["motion", "animation", "reduced motion", "hover polish"],
    relatedPrincipleIds: ["hierarchy.foundational_before_decorative", "accessibility.quality_not_afterthought"],
    recommendedActions: ["respect reduced motion; demote decorative motion"],
  },
  {
    id: "accessibility.not_color_alone",
    category: "accessibility",
    title: "Not relying on color alone",
    principle:
      "Status, links, and emphasis should not depend on color as the only cue.",
    reasoning:
      "Color-only cues fail for many users and in low-quality displays.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["color alone", "link color only", "status color"],
    relatedPrincipleIds: ["hierarchy.contrast_size_weight", "color.supports_hierarchy"],
    recommendedActions: ["add non-color cues for meaning"],
  },
  {
    id: "accessibility.accessible_button_labels",
    category: "accessibility",
    title: "Accessible button labels",
    principle:
      "Buttons need descriptive labels — avoid icon-only ambiguity for primary actions.",
    reasoning:
      "Unclear labels hurt everyone and break assistive technology expectations.",
    impact: "medium",
    appliesTo: ["all", "mobile"],
    signals: ["button label", "icon only", "unclear cta"],
    relatedPrincipleIds: ["conversion.clear_cta_language", "typography.readable_button_labels"],
    recommendedActions: ["use descriptive button labels"],
  },
  {
    id: "accessibility.quality_not_afterthought",
    category: "accessibility",
    title: "Accessibility as quality",
    principle:
      "Treat accessibility as part of design quality, not a separate compliance pass after aesthetics.",
    reasoning:
      "Sites that bolt on access late usually keep the same hierarchy and contrast mistakes.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["accessibility", "quality", "low contrast", "unreadable"],
    relatedPrincipleIds: ["hierarchy.foundational_before_decorative", "color.contrast"],
    recommendedActions: ["prioritize access with foundational design fixes"],
  },
];
