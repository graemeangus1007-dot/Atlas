import type { DesignPrinciple } from "@/lib/ai/design-knowledge/types";

export const IMAGERY_PRINCIPLES: DesignPrinciple[] = [
  {
    id: "imagery.authentic_over_stock",
    category: "imagery",
    title: "Authentic imagery over generic stock",
    principle:
      "Prefer real people, places, and projects over interchangeable stock whenever possible.",
    reasoning:
      "Generic stock signals “template website” and weakens trust for local service hiring.",
    impact: "high",
    appliesTo: ["local-business", "service-business", "portfolio", "homepage"],
    signals: ["generic stock", "placeholder", "no hero image", "authentic photos"],
    relatedPrincipleIds: ["trust.real_project_photography", "homepage.purposeful_hero_imagery"],
    recommendedActions: ["replace stock with authentic photos"],
  },
  {
    id: "imagery.hero_focal_point",
    category: "imagery",
    title: "Hero focal points",
    principle:
      "Hero images need a clear subject and composition that support the promise.",
    reasoning:
      "Busy or poorly cropped heroes compete with the headline instead of amplifying it.",
    impact: "high",
    appliesTo: ["homepage", "landing-page", "all"],
    signals: ["hero image", "focal point", "busy photo", "crop"],
    relatedPrincipleIds: ["layout.focal_point_placement", "homepage.purposeful_hero_imagery"],
    recommendedActions: ["choose hero with clear subject"],
  },
  {
    id: "imagery.crop_composition",
    category: "imagery",
    title: "Crop and composition",
    principle:
      "Crops should keep subjects intentional and leave room for type when overlays are used.",
    reasoning:
      "Bad crops make even good photography feel careless.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["crop", "composition", "cut off subject"],
    relatedPrincipleIds: ["imagery.hero_focal_point", "imagery.overlays_when_necessary"],
    recommendedActions: ["improve crop and composition"],
  },
  {
    id: "imagery.aspect_ratio_consistency",
    category: "imagery",
    title: "Aspect-ratio consistency",
    principle:
      "Galleries and card media should use consistent ratios so the set feels designed.",
    reasoning:
      "Mixed ratios create visual jitter and reduce perceived quality.",
    impact: "medium",
    appliesTo: ["portfolio", "homepage", "all"],
    signals: ["aspect ratio", "gallery inconsistency", "mixed ratios"],
    relatedPrincipleIds: ["imagery.image_treatment_consistency", "imagery.gallery_purpose"],
    recommendedActions: ["normalize gallery ratios"],
  },
  {
    id: "imagery.image_hierarchy",
    category: "imagery",
    title: "Image hierarchy",
    principle:
      "Not every image deserves equal size — hero and proof images should outrank decorative slots.",
    reasoning:
      "Equal image treatment flattens storytelling and wastes attention.",
    impact: "medium",
    appliesTo: ["homepage", "portfolio", "all"],
    signals: ["image hierarchy", "equal images", "decorative image"],
    relatedPrincipleIds: ["hierarchy.one_dominant_per_region", "imagery.meaningful_not_decorative"],
    recommendedActions: ["enlarge key proof imagery"],
  },
  {
    id: "imagery.gallery_purpose",
    category: "imagery",
    title: "Gallery purpose",
    principle:
      "Galleries should prove capability or taste — not fill space with unrelated photos.",
    reasoning:
      "Purposeless galleries add scroll without adding confidence.",
    impact: "high",
    appliesTo: ["local-business", "portfolio", "service-business", "homepage"],
    signals: ["gallery", "gallery empty", "project gallery", "portfolio"],
    relatedPrincipleIds: ["trust.real_project_photography", "trust.before_after_proof"],
    recommendedActions: ["curate gallery around proof"],
  },
  {
    id: "imagery.before_after_use",
    category: "imagery",
    title: "Before-and-after use",
    principle:
      "Use before/after pairs when the offer is a visible transformation.",
    reasoning:
      "Transformation evidence is often the fastest trust builder for trades and renovation brands.",
    impact: "high",
    appliesTo: ["local-business", "portfolio", "service-business"],
    signals: ["before and after", "transformation", "results photography"],
    relatedPrincipleIds: ["trust.before_after_proof", "imagery.gallery_purpose"],
    recommendedActions: ["feature before/after pairs"],
  },
  {
    id: "imagery.overlays_when_necessary",
    category: "imagery",
    title: "Overlays only when necessary",
    principle:
      "Dark overlays and filters should exist only to protect readability or mood — never by default.",
    reasoning:
      "Heavy overlays hide the very craft the business is trying to show.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["overlay", "darken image", "unreadable hero text"],
    relatedPrincipleIds: ["color.readability_surfaces", "imagery.hero_focal_point"],
    recommendedActions: ["lighten or remove unnecessary overlays"],
  },
  {
    id: "imagery.image_treatment_consistency",
    category: "imagery",
    title: "Image treatment consistency",
    principle:
      "Tone, saturation, and finish should feel like one photographer or one art direction.",
    reasoning:
      "Mixed treatments make a single brand look like a collage of unrelated sites.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["inconsistent photo style", "mixed treatments", "image style"],
    relatedPrincipleIds: ["branding.coherence", "imagery.authentic_over_stock"],
    recommendedActions: ["unify image treatment"],
  },
  {
    id: "imagery.supports_promise",
    category: "imagery",
    title: "Photography supporting the business promise",
    principle:
      "Images should reinforce what the business claims to deliver.",
    reasoning:
      "Mismatched imagery creates subconscious distrust even when copy is accurate.",
    impact: "high",
    appliesTo: ["homepage", "service-business", "local-business", "all"],
    signals: ["mismatched imagery", "irrelevant photos", "hero image"],
    relatedPrincipleIds: ["homepage.purposeful_hero_imagery", "branding.authenticity"],
    recommendedActions: ["align imagery to the promise"],
  },
  {
    id: "imagery.meaningful_not_decorative",
    category: "imagery",
    title: "Avoid meaningless decorative images",
    principle:
      "If an image does not inform, prove, or set useful atmosphere, remove or replace it.",
    reasoning:
      "Decorative filler increases noise and slows the path to conversion.",
    impact: "medium",
    appliesTo: ["all"],
    signals: ["decorative image", "filler photo", "stock filler"],
    relatedPrincipleIds: ["imagery.image_hierarchy", "hierarchy.reduce_competing_emphasis"],
    recommendedActions: ["remove non-meaningful images"],
  },
];
