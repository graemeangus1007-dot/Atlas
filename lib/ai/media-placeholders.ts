/**
 * Category-specific media placeholder metadata (Sprint 20.1).
 * Structured so real uploads can replace placeholders later.
 */

import {
  detectIndustryCategory,
  getIndustryCopyPack,
  type IndustryCategory,
} from "@/lib/ai/industry-content";
import { placeholderImageUrl } from "@/lib/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export type MediaPlaceholderKind = "hero" | "gallery";

export type AiMediaPlaceholder = {
  id: string;
  kind: MediaPlaceholderKind;
  category: IndustryCategory;
  label: string;
  alt: string;
  width: number;
  height: number;
  /** Inline SVG data URL used until a real asset is uploaded. */
  imageUrl: string;
  isPlaceholder: true;
};

export function buildMediaPlaceholders(input: {
  businessName: string;
  businessType: string;
}): {
  category: IndustryCategory;
  hero: AiMediaPlaceholder;
  gallery: AiMediaPlaceholder[];
} {
  const category = detectIndustryCategory(input.businessType);
  const pack = getIndustryCopyPack(input.businessType);
  const name = input.businessName.trim() || "Business";

  const heroLabel = `${name} hero`;
  const hero: AiMediaPlaceholder = {
    id: "ai-hero-placeholder",
    kind: "hero",
    category,
    label: heroLabel,
    alt: `${name} — ${pack.galleryLabels[0] || "hero image"}`,
    width: 1600,
    height: 900,
    imageUrl: placeholderImageUrl(heroLabel, 1600, 900),
    isPlaceholder: true,
  };

  const gallery = Array.from({ length: GALLERY_SLOT_COUNT }, (_, index) => {
    const label =
      pack.galleryLabels[index] || `Gallery image ${index + 1}`;
    return {
      id: `ai-gallery-placeholder-${index + 1}`,
      kind: "gallery" as const,
      category,
      label,
      alt: `${name} — ${label}`,
      width: 800,
      height: 600,
      imageUrl: placeholderImageUrl(label, 800, 600),
      isPlaceholder: true as const,
    };
  });

  return { category, hero, gallery };
}
