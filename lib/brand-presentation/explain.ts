/**
 * User-facing explanations — never claim brand colors changed.
 */

import { isGoldLikeAccent } from "@/lib/brand-presentation/color-roles";
import type { ResolvedBrandPresentation } from "@/lib/brand-presentation/types";

const BRAND_CHANGE_CLAIM =
  /\b(changed|updated|replaced|rewrote|switched)\b[\s\S]{0,40}\b(brand\s+colors?|palette|branding\s+colors?)\b|\b(new\s+brand\s+colors?|recolored\s+your\s+brand)\b/i;

export function explanationClaimsBrandChange(text: string): boolean {
  return BRAND_CHANGE_CLAIM.test(text.trim());
}

export function explainBrandPresentation(
  resolved: ResolvedBrandPresentation,
): string {
  const { presentation: p, image, identity } = resolved;
  const gold = isGoldLikeAccent(identity.accent);

  if (!image.hasImage) {
    return "I kept your brand palette and used a clean hero presentation matched to your theme.";
  }

  if (image.brightness === "light" && gold && p.decisions.usedWhitePresentation) {
    return "Your brand colors work well overall, but this hero image has large bright areas. I'll keep your brand palette and present the hero using white headings with gold accents for stronger readability.";
  }

  if (image.complexity === "busy") {
    return "I adjusted the hero presentation so your branding remains readable — local contrast behind the text instead of darkening the whole photo.";
  }

  if (p.decisions.usedWhitePresentation) {
    return "I adjusted the hero presentation so your branding remains readable, using white headings while keeping your brand accents.";
  }

  return "I adjusted the hero presentation so your branding remains readable without changing your brand colors.";
}
