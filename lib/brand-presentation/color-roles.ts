/**
 * Brand color role helpers — gold is accent, white is presentation.
 */

import { contrastRatio, relativeLuminance } from "@/lib/ai/contrast";
import { WHITE_PRESENTATION } from "@/lib/brand-presentation/types";

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

/** Gold / metallic accents — fine for eyebrow & CTA, not long body copy. */
export function isGoldLikeAccent(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) {
    return /\b(gold|mustard|bronze|amber)\b/i.test(hex);
  }
  const { r, g, b } = rgb;
  // Warm yellow-gold band: high R/G, lower B, moderate luminance.
  const lum = relativeLuminance(hex) ?? 0;
  const warm = r > 160 && g > 120 && b < 140 && r >= g && g > b + 20;
  const mustard = r > 170 && g > 120 && g < 200 && b < 80;
  return (warm || mustard) && lum > 0.18 && lum < 0.72;
}

export function isLightBrandSurface(hex: string): boolean {
  return (relativeLuminance(hex) ?? 0) > 0.58;
}

export function isDarkBrandColor(hex: string): boolean {
  return (relativeLuminance(hex) ?? 1) < 0.28;
}

export function bestReadableInk(
  surface: string,
  candidates: string[],
): string {
  let best = candidates[0] ?? WHITE_PRESENTATION;
  let bestRatio = 0;
  for (const c of candidates) {
    const ratio = contrastRatio(c, surface) ?? 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return best;
}

export function ctaTextOnBackground(background: string): string {
  return isLightBrandSurface(background) ? "#101828" : WHITE_PRESENTATION;
}

export function snapOverlayStrength(value: number): number {
  const steps = [0, 25, 50, 75, 100];
  let best = 0;
  let bestDist = Infinity;
  for (const step of steps) {
    const dist = Math.abs(step - value);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}
