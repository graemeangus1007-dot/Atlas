/**
 * WCAG contrast helpers for AI brand colors (Sprint 20.1).
 */

export type ContrastWarning = {
  code: "low_contrast_text" | "low_contrast_cta" | "invalid_color";
  message: string;
  ratio: number;
  minimum: number;
};

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 == null || l2 == null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAa(
  foreground: string,
  background: string,
  options?: { largeText?: boolean },
): boolean {
  const ratio = contrastRatio(foreground, background);
  if (ratio == null) return false;
  return ratio >= (options?.largeText ? 3 : 4.5);
}

/**
 * Warn when questionnaire brand colors are likely hard to read on the
 * tone-derived background / for CTA text on accent.
 */
export function validateBrandContrast(input: {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}): ContrastWarning[] {
  const warnings: ContrastWarning[] = [];
  const bg = input.backgroundColor;
  const textOnBg = contrastRatio("#101828", bg) ?? contrastRatio("#f2f4f7", bg);
  const lightBg =
    (relativeLuminance(bg) ?? 0) > 0.5;
  const bodyText = lightBg ? "#101828" : "#f2f4f7";
  const bodyRatio = contrastRatio(bodyText, bg);

  if (bodyRatio == null) {
    warnings.push({
      code: "invalid_color",
      message: "Background color could not be evaluated for contrast.",
      ratio: 0,
      minimum: 4.5,
    });
  } else if (bodyRatio < 4.5) {
    warnings.push({
      code: "low_contrast_text",
      message:
        "Body text may be hard to read on this background. Consider a lighter or darker page background.",
      ratio: Number(bodyRatio.toFixed(2)),
      minimum: 4.5,
    });
  }

  const ctaRatio = contrastRatio("#ffffff", input.accentColor);
  if (ctaRatio == null) {
    warnings.push({
      code: "invalid_color",
      message: "Accent color could not be evaluated for CTA contrast.",
      ratio: 0,
      minimum: 4.5,
    });
  } else if (ctaRatio < 4.5) {
    warnings.push({
      code: "low_contrast_cta",
      message:
        "White text on your accent color may fail WCAG AA. Consider a darker or brighter accent.",
      ratio: Number(ctaRatio.toFixed(2)),
      minimum: 4.5,
    });
  }

  const primaryOnBg = contrastRatio(input.primaryColor, bg);
  if (primaryOnBg != null && primaryOnBg < 3) {
    warnings.push({
      code: "low_contrast_text",
      message:
        "Primary brand color has low contrast against the page background.",
      ratio: Number(primaryOnBg.toFixed(2)),
      minimum: 3,
    });
  }

  void textOnBg;
  return warnings;
}
