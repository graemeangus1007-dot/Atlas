import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const COLOR_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "color.contrast",
    category: "color",
    title: "Sufficient contrast",
    principle:
      "Text and key surfaces need enough contrast to remain legible in real viewing conditions.",
    reasoning:
      "Low contrast quietly destroys readability and perceived quality.",
    impact: "high",
    appliesTo: ["all", "mobile"],
    signals: ["low contrast", "contrast", "unreadable", "washed out"],
    relatedPrincipleIds: ["accessibility.text_control_contrast", "color.readability_surfaces"],
    recommendedActions: ["increase text/background contrast"],
  },
  {
    id: "color.accessible_controls",
    category: "color",
    title: "Accessible text and controls",
    principle:
      "Buttons, links, and form controls must meet contrast expectations, not only body text.",
    reasoning:
      "A beautiful palette that fails on controls creates unusable conversion paths.",
    impact: "high",
    appliesTo: ["all", "mobile"],
    signals: ["low button contrast", "low contrast", "button contrast", "control contrast"],
    relatedPrincipleIds: ["accessibility.text_control_contrast", "hierarchy.cta_prominence"],
    recommendedActions: ["fix button contrast"],
  },
  {
    id: "color.palette_balance",
    category: "color",
    title: "Palette balance",
    principle:
      "Primary, secondary, accent, and surface colors should feel balanced rather than noisy.",
    reasoning:
      "Over-saturated multi-hue palettes fight hierarchy and brand memory.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["palette", "too many colors", "noisy color", "brand colors"],
    relatedPrincipleIds: ["color.disciplined_accent", "branding.coherence"],
    recommendedActions: ["simplify palette roles"],
  },
  {
    id: "color.disciplined_accent",
    category: "color",
    title: "Disciplined accent usage",
    principle:
      "Accent color should mark important actions and highlights, not decorate everything.",
    reasoning:
      "When accent is everywhere, CTAs lose distinctiveness.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["accent overuse", "competing emphasis", "accent"],
    relatedPrincipleIds: ["hierarchy.reduce_competing_emphasis", "homepage.one_dominant_cta"],
    recommendedActions: ["reserve accent for primary actions"],
  },
  {
    id: "color.emotional_tone",
    category: "color",
    title: "Emotional tone",
    principle:
      "Color should support the desired emotion — calm, energetic, premium, approachable — without cliché formulas.",
    reasoning:
      "Simplistic mappings like “luxury means black and gold” produce generic, forgettable brands.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["emotional tone", "luxury black gold", "generic luxury", "mood"],
    relatedPrincipleIds: ["branding.visual_personality", "branding.industry_fit"],
    recommendedActions: ["align palette to emotion, not cliché"],
    cautions: ["Do not assume luxury always equals black/gold."],
  },
  {
    id: "color.surface_differentiation",
    category: "color",
    title: "Surface and background differentiation",
    principle:
      "Surfaces should differentiate sections and cards without harsh seams or muddy blends.",
    reasoning:
      "Flat identical backgrounds erase section boundaries; harsh blocks feel dated.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["background", "surface", "section banding", "muddy surfaces"],
    relatedPrincipleIds: ["spacing.section_rhythm", "layout.avoid_identical_treatment"],
    recommendedActions: ["differentiate surfaces lightly"],
  },
  {
    id: "color.consistency",
    category: "color",
    title: "Color consistency",
    principle:
      "The same roles (primary, accent, text, surface) should behave consistently across the site.",
    reasoning:
      "Inconsistent role usage makes the brand feel accidental.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["inconsistent colors", "color consistency", "theme"],
    relatedPrincipleIds: ["branding.consistency", "color.palette_balance"],
    recommendedActions: ["normalize color roles"],
  },
  {
    id: "color.avoid_cliche_mappings",
    category: "color",
    title: "Avoid simplistic color clichés",
    principle:
      "Do not rely on default luxury, eco, or tech color tropes when the brand has a clearer personality.",
    reasoning:
      "Cliché palettes make otherwise capable businesses look interchangeable.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["cliché palette", "generic luxury", "black and gold", "generic teal"],
    relatedPrincipleIds: ["color.emotional_tone", "branding.differentiation"],
    recommendedActions: ["choose distinctive role-based palette"],
  },
  {
    id: "color.readability_surfaces",
    category: "color",
    title: "Readability across light and dark surfaces",
    principle:
      "Text and controls must remain readable on every background the design actually uses.",
    reasoning:
      "Palettes often fail on dark overlays, tinted bands, or image treatments.",
    impact: "high",
    appliesTo: ["all"],
    signals: ["overlay text", "dark surface", "low contrast", "hero text contrast"],
    relatedPrincipleIds: ["color.contrast", "imagery.overlays_when_necessary"],
    recommendedActions: ["fix contrast on all surfaces"],
  },
  {
    id: "color.supports_hierarchy",
    category: "color",
    title: "Color supports hierarchy",
    principle:
      "Color should reinforce hierarchy already established by size and spacing — not replace it.",
    reasoning:
      "Color as the only hierarchy cue fails when visitors scan quickly or have vision differences.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["color hierarchy", "accent", "visual hierarchy"],
    relatedPrincipleIds: ["hierarchy.contrast_size_weight", "accessibility.not_color_alone"],
    recommendedActions: ["pair color cues with size/spacing"],
  },
];
