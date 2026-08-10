/**
 * Taste dimension registry — labels, weights, and principle descriptions.
 */

import type { TasteDimensionId } from "@/lib/taste/types";

export type TasteDimensionMeta = {
  id: TasteDimensionId;
  label: string;
  /** Contribution to overallTaste (relative). */
  weight: number;
  principle: string;
};

export const TASTE_DIMENSIONS: TasteDimensionMeta[] = [
  {
    id: "spacingHarmony",
    label: "Spacing harmony",
    weight: 1.15,
    principle: "Consistent breathing room and a disciplined spacing scale",
  },
  {
    id: "typographyHarmony",
    label: "Typography harmony",
    weight: 1.2,
    principle: "Clear hierarchy, readable rhythm, restrained type scale",
  },
  {
    id: "visualRhythm",
    label: "Visual rhythm",
    weight: 1.1,
    principle: "Intentional heavy/light pacing through the page",
  },
  {
    id: "alignmentQuality",
    label: "Alignment quality",
    weight: 1.0,
    principle: "Shared edges and coherent section alignment",
  },
  {
    id: "componentConsistency",
    label: "Component consistency",
    weight: 1.05,
    principle: "One language for buttons, cards, radii, and surfaces",
  },
  {
    id: "visualWeight",
    label: "Visual weight",
    weight: 1.1,
    principle: "Balanced attention — nothing emptily light or crushingly heavy",
  },
  {
    id: "craftsmanship",
    label: "Craftsmanship",
    weight: 1.15,
    principle: "Finishing details that read as professionally made",
  },
  {
    id: "restraint",
    label: "Restraint",
    weight: 1.2,
    principle: "Fewer accents, effects, and competing signals",
  },
  {
    id: "proportion",
    label: "Proportion",
    weight: 1.0,
    principle: "Balanced hero height, cards, CTAs, and content density",
  },
  {
    id: "ctaPresence",
    label: "CTA presence",
    weight: 1.05,
    principle: "A clear primary action without a noisy cluster",
  },
  {
    id: "scanability",
    label: "Scanability",
    weight: 1.05,
    principle: "The eye can read the page in a calm vertical pass",
  },
  {
    id: "polish",
    label: "Polish",
    weight: 1.15,
    principle: "Coordinated finishing across type, space, and detail",
  },
];

export function tasteDimensionMeta(
  id: TasteDimensionId,
): TasteDimensionMeta {
  return TASTE_DIMENSIONS.find((d) => d.id === id)!;
}

export function tasteDimensionLabel(id: TasteDimensionId): string {
  return tasteDimensionMeta(id).label;
}
