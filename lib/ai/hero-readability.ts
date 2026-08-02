/**
 * Hero readability diagnosis + treatment selection (v1.2).
 * Diagnose the visual cause before applying typography or theme changes.
 */

import {
  HERO_OVERLAY_STEPS,
  type HeroOverlayStep,
} from "@/data/design-options";
import {
  contrastRatio,
  meetsWcagAa,
  relativeLuminance,
} from "@/lib/ai/contrast";
import type { EditOperation } from "@/lib/ai/edit-operations";
import type { BusinessProject } from "@/types/business-project";

export const HERO_READABILITY_THRESHOLD = 72;

export type HeroReadabilityIssue =
  | "low_text_background_contrast"
  | "busy_image_behind_text"
  | "weak_overlay"
  | "thin_heading_weight"
  | "small_body_text"
  | "excessive_line_width"
  | "weak_button_contrast"
  | "poor_spacing"
  | "image_unanalyzed";

export type HeroReadabilityTreatment =
  | { kind: "strengthen_overlay"; targetOverlay: HeroOverlayStep; reason: string }
  | { kind: "adjust_background"; background: string; theme: "light" | "dark"; reason: string }
  | { kind: "strengthen_heading"; headingFont: "manrope" | "inter" | "poppins"; reason: string }
  | { kind: "improve_hierarchy"; reason: string }
  | { kind: "narrow_text_width"; reason: string }
  | { kind: "improve_cta_contrast"; accent: string; reason: string }
  | { kind: "airy_spacing"; reason: string }
  | { kind: "simplify_subheadline"; value: string; reason: string };

export type HeroReadabilityAssessment = {
  readable: boolean;
  score: number;
  issues: HeroReadabilityIssue[];
  recommendedTreatments: HeroReadabilityTreatment[];
  /** Estimated composite surface behind hero text (hex). */
  estimatedSurface: string;
  /** Derived foreground used for hero headline. */
  textColor: string;
  /** Derived muted color for subheadline. */
  mutedColor: string;
  hasHeroImage: boolean;
  overlay: number;
  imageAnalysisAvailable: boolean;
  notes: string[];
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

function mixHex(base: string, tint: string, amount: number): string {
  const a = parseHex(base);
  const b = parseHex(tint);
  if (!a || !b) return base;
  const t = Math.min(Math.max(amount, 0), 1);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
}

function clampOverlayStep(value: number): HeroOverlayStep {
  let best: HeroOverlayStep = HERO_OVERLAY_STEPS[0]!;
  let bestDist = Infinity;
  for (const step of HERO_OVERLAY_STEPS) {
    const dist = Math.abs(step - value);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best;
}

function nextStrongerOverlay(current: number, minTarget: number): HeroOverlayStep {
  const floor = Math.max(current + 1, minTarget);
  for (const step of HERO_OVERLAY_STEPS) {
    if (step >= floor) return step;
  }
  return 100;
}

function derivedTextColors(background: string): {
  textColor: string;
  mutedColor: string;
  lightBg: boolean;
} {
  const lum = relativeLuminance(background) ?? 0;
  const lightBg = lum > 0.5;
  return {
    lightBg,
    textColor: lightBg ? "#101828" : "#f2f4f7",
    mutedColor: lightBg ? "#667085" : "#9aa3b2",
  };
}

/**
 * Estimate the surface behind hero type.
 * Overlay tints the image toward page background (matches --site-hero-overlay CSS).
 * When image brightness is unknown, use a mid-gray “busy photo” proxy.
 */
export function estimateHeroSurface(project: BusinessProject): {
  surface: string;
  hasHeroImage: boolean;
  imageAnalysisAvailable: boolean;
  overlay: number;
  notes: string[];
} {
  const bg = project.backgroundColor || "#07090d";
  const overlayPct = Math.min(100, Math.max(0, project.heroOverlay ?? 50));
  const overlay = overlayPct / 100;
  const hasHeroImage = Boolean(project.heroImageId);
  const notes: string[] = [];

  if (!hasHeroImage) {
    return {
      surface: bg,
      hasHeroImage: false,
      imageAnalysisAvailable: true,
      overlay: overlayPct,
      notes: ["No hero image — evaluating text against the page background."],
    };
  }

  // Pixel brightness unavailable in this runtime — conservative busy-image proxy.
  const imageProxy = "#6b7280";
  notes.push(
    "Hero image brightness couldn’t be measured safely; assuming a busy mid-tone photo and preferring a stronger overlay.",
  );
  const surface = mixHex(imageProxy, bg, overlay);
  return {
    surface,
    hasHeroImage: true,
    imageAnalysisAvailable: false,
    overlay: overlayPct,
    notes,
  };
}

const THIN_HEADING_FONTS = new Set(["playfair", "lora"]);

/**
 * Deterministic hero readability assessment from project + design tokens.
 */
export function analyzeHeroReadability(
  project: BusinessProject,
): HeroReadabilityAssessment {
  const surfaceInfo = estimateHeroSurface(project);
  const pageBg = project.backgroundColor || "#07090d";
  const { textColor, mutedColor } = derivedTextColors(pageBg);
  const issues: HeroReadabilityIssue[] = [];
  const treatments: HeroReadabilityTreatment[] = [];
  let score = 100;

  const headlineRatio = contrastRatio(textColor, surfaceInfo.surface);
  const mutedRatio = contrastRatio(mutedColor, surfaceInfo.surface);
  const ctaRatio = contrastRatio("#ffffff", project.accentColor || project.primaryColor);

  if (!surfaceInfo.imageAnalysisAvailable && surfaceInfo.hasHeroImage) {
    issues.push("image_unanalyzed");
  }

  if (
    headlineRatio == null ||
    headlineRatio < 4.5 ||
    (mutedRatio != null && mutedRatio < 3)
  ) {
    issues.push("low_text_background_contrast");
    score -= 28;
  }

  if (surfaceInfo.hasHeroImage && surfaceInfo.overlay < 50) {
    issues.push("weak_overlay");
    score -= 22;
  }

  if (surfaceInfo.hasHeroImage && surfaceInfo.overlay < 75) {
    // Busy image is the default assumption when pixels aren’t available.
    if (!surfaceInfo.imageAnalysisAvailable || surfaceInfo.overlay < 50) {
      if (!issues.includes("busy_image_behind_text")) {
        issues.push("busy_image_behind_text");
        score -= 16;
      }
    }
  }

  if (THIN_HEADING_FONTS.has(project.headingFont)) {
    issues.push("thin_heading_weight");
    score -= 12;
  }

  const sub = (project.heroSubheadline ?? "").trim();
  if (sub.length > 140 || !project.creativePolish?.visualHierarchy) {
    if (sub.length > 160 || (sub.length > 100 && !project.creativePolish?.visualHierarchy)) {
      issues.push("small_body_text");
      score -= 10;
    }
  }

  if (project.siteWidth === "full") {
    issues.push("excessive_line_width");
    score -= 8;
  }

  if (ctaRatio == null || ctaRatio < 4.5) {
    issues.push("weak_button_contrast");
    score -= 14;
  }

  if (
    !project.creativePolish?.spacing ||
    project.creativePolish.spacing === "default"
  ) {
    issues.push("poor_spacing");
    score -= 6;
  }

  score = Math.max(0, Math.min(100, score));

  // --- Smallest coordinated treatment set ---
  const needsOverlay =
    issues.includes("weak_overlay") ||
    issues.includes("busy_image_behind_text") ||
    (issues.includes("low_text_background_contrast") &&
      surfaceInfo.hasHeroImage);

  if (needsOverlay && surfaceInfo.hasHeroImage) {
    const minTarget =
      issues.includes("busy_image_behind_text") ||
      !surfaceInfo.imageAnalysisAvailable
        ? 75
        : 50;
    const target = nextStrongerOverlay(surfaceInfo.overlay, minTarget);
    if (target > surfaceInfo.overlay) {
      treatments.push({
        kind: "strengthen_overlay",
        targetOverlay: target,
        reason: surfaceInfo.imageAnalysisAvailable
          ? "Strengthen the hero overlay so type separates from the photo."
          : "Image brightness is unknown — use a stronger overlay as a conservative fix.",
      });
    }
  }

  if (
    issues.includes("low_text_background_contrast") &&
    !surfaceInfo.hasHeroImage
  ) {
    const pageLum = relativeLuminance(pageBg) ?? 0.5;
    const background = pageLum > 0.5 ? "#f7f8fa" : "#0f1419";
    const theme = pageLum > 0.5 ? "light" : "dark";
    // Push further if still weak
    const probe = derivedTextColors(background);
    const probeSurface = background;
    if (!meetsWcagAa(probe.textColor, probeSurface, { largeText: true })) {
      treatments.push({
        kind: "adjust_background",
        background: pageLum > 0.5 ? "#ffffff" : "#07090d",
        theme,
        reason: "Shift the hero/page background so headline contrast clears WCAG AA.",
      });
    } else {
      treatments.push({
        kind: "adjust_background",
        background,
        theme,
        reason: "Improve page background contrast behind hero type.",
      });
    }
  }

  // If contrast is still weak with an image even after overlay plan, nudge page bg.
  if (
    issues.includes("low_text_background_contrast") &&
    surfaceInfo.hasHeroImage
  ) {
    const plannedOverlay = treatments.find((t) => t.kind === "strengthen_overlay");
    const overlayPct =
      plannedOverlay && plannedOverlay.kind === "strengthen_overlay"
        ? plannedOverlay.targetOverlay
        : surfaceInfo.overlay;
    const projected = mixHex("#6b7280", pageBg, overlayPct / 100);
    if (!meetsWcagAa(textColor, projected, { largeText: true })) {
      const pageLum = relativeLuminance(pageBg) ?? 0.5;
      treatments.push({
        kind: "adjust_background",
        background: pageLum > 0.45 ? "#0f1419" : "#f7f8fa",
        theme: pageLum > 0.45 ? "dark" : "light",
        reason:
          "Adjust the overlay tint color so reinforced opacity yields readable type.",
      });
    }
  }

  if (issues.includes("thin_heading_weight")) {
    treatments.push({
      kind: "strengthen_heading",
      headingFont: "manrope",
      reason: "Switch to a heavier heading face so the hero title holds against the image.",
    });
  }

  if (
    issues.includes("small_body_text") ||
    issues.includes("thin_heading_weight") ||
    issues.includes("low_text_background_contrast")
  ) {
    if (!project.creativePolish?.visualHierarchy) {
      treatments.push({
        kind: "improve_hierarchy",
        reason: "Increase heading scale so the hero title reads first.",
      });
    }
  }

  if (issues.includes("excessive_line_width")) {
    treatments.push({
      kind: "narrow_text_width",
      reason: "Narrow the content width so hero lines are easier to scan.",
    });
  }

  if (issues.includes("weak_button_contrast")) {
    treatments.push({
      kind: "improve_cta_contrast",
      accent: "#0f766e",
      reason: "Darken the accent so white CTA label contrast meets WCAG AA.",
    });
  }

  if (issues.includes("poor_spacing")) {
    treatments.push({
      kind: "airy_spacing",
      reason: "Give the hero block more breathing room.",
    });
  }

  if (issues.includes("small_body_text") && sub.length > 140) {
    treatments.push({
      kind: "simplify_subheadline",
      value: `${sub.slice(0, 117).trimEnd()}…`,
      reason: "Shorten a long hero lede so it stays legible at a glance.",
    });
  }

  const readable = score >= HERO_READABILITY_THRESHOLD && issues.filter(
    (i) => i !== "image_unanalyzed" && i !== "poor_spacing",
  ).length === 0;

  // Prefer overlay-first; avoid flooding with every secondary treatment.
  const prioritized = prioritizeTreatments(treatments);

  return {
    readable,
    score,
    issues,
    recommendedTreatments: prioritized,
    estimatedSurface: surfaceInfo.surface,
    textColor,
    mutedColor,
    hasHeroImage: surfaceInfo.hasHeroImage,
    overlay: surfaceInfo.overlay,
    imageAnalysisAvailable: surfaceInfo.imageAnalysisAvailable,
    notes: surfaceInfo.notes,
  };
}

function prioritizeTreatments(
  treatments: HeroReadabilityTreatment[],
): HeroReadabilityTreatment[] {
  const order: HeroReadabilityTreatment["kind"][] = [
    "strengthen_overlay",
    "adjust_background",
    "strengthen_heading",
    "improve_hierarchy",
    "improve_cta_contrast",
    "narrow_text_width",
    "airy_spacing",
    "simplify_subheadline",
  ];
  const sorted = [...treatments].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
  // Cap to a small coordinated set.
  return sorted.slice(0, 4);
}

/** Convert treatments into existing (plus setHeroOverlay) edit operations. */
export function heroTreatmentsToOperations(
  treatments: HeroReadabilityTreatment[],
): EditOperation[] {
  const ops: EditOperation[] = [];
  let polish: {
    visualHierarchy?: boolean;
    spacing?: "default" | "comfortable" | "airy";
  } = {};

  for (const treatment of treatments) {
    switch (treatment.kind) {
      case "strengthen_overlay":
        ops.push({
          operation: "setHeroOverlay",
          value: treatment.targetOverlay,
        });
        break;
      case "adjust_background":
        ops.push({
          operation: "changeTheme",
          background: treatment.background,
          theme: treatment.theme,
        });
        break;
      case "strengthen_heading":
        ops.push({
          operation: "setTypography",
          headingFont: treatment.headingFont,
          bodyFont: "inter",
        });
        break;
      case "improve_hierarchy":
        polish = { ...polish, visualHierarchy: true };
        break;
      case "narrow_text_width":
        ops.push({ operation: "setSiteWidth", value: "boxed" });
        break;
      case "improve_cta_contrast":
        ops.push({
          operation: "changeTheme",
          accent: treatment.accent,
        });
        break;
      case "airy_spacing":
        polish = { ...polish, spacing: "airy" };
        break;
      case "simplify_subheadline":
        ops.push({
          operation: "replaceText",
          target: "hero.subheadline",
          value: treatment.value,
        });
        break;
      default: {
        const _exhaustive: never = treatment;
        void _exhaustive;
      }
    }
  }

  if (polish.visualHierarchy !== undefined || polish.spacing !== undefined) {
    ops.push({
      operation: "setCreativePolish",
      ...(polish.visualHierarchy !== undefined
        ? { visualHierarchy: polish.visualHierarchy }
        : {}),
      ...(polish.spacing !== undefined ? { spacing: polish.spacing } : {}),
    });
  }

  return ops;
}

export function buildHeroReadabilityExplanation(
  before: HeroReadabilityAssessment,
  after: HeroReadabilityAssessment,
  applied: HeroReadabilityTreatment[],
): string {
  if (applied.length === 0 && before.readable) {
    if (before.hasHeroImage && !before.imageAnalysisAvailable) {
      return "The hero typography is already readable. The remaining issue may be the background image itself — a darker overlay or a different crop would help further.";
    }
    return "The hero already has strong contrast and readable type. The remaining issue may be the background image itself.";
  }

  const parts: string[] = [];
  for (const t of applied) {
    switch (t.kind) {
      case "strengthen_overlay":
        parts.push("strengthened the hero overlay");
        break;
      case "adjust_background":
        parts.push("adjusted the hero background contrast");
        break;
      case "strengthen_heading":
        parts.push("increased the headline weight");
        break;
      case "improve_hierarchy":
        parts.push("increased the headline scale");
        break;
      case "improve_cta_contrast":
        parts.push("improved button contrast");
        break;
      case "narrow_text_width":
        parts.push("narrowed the text width");
        break;
      case "airy_spacing":
        parts.push("added more breathing room");
        break;
      case "simplify_subheadline":
        parts.push("simplified the hero lede");
        break;
      default:
        break;
    }
  }

  const lead =
    parts.length > 0
      ? `Done. I ${formatList(parts)} so the text stands out more clearly from the background.`
      : "I reviewed the hero for readability.";

  if (
    after.score > before.score &&
    after.hasHeroImage &&
    (after.issues.includes("busy_image_behind_text") ||
      after.issues.includes("image_unanalyzed"))
  ) {
    return `${lead} The background image is still visually busy, so replacing or repositioning it would improve readability further.`;
  }

  if (after.score <= before.score) {
    return "I wasn’t able to improve measured hero readability with the available treatments. A different hero image or crop is likely needed.";
  }

  return lead;
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** True when the user is asking about hero-local readability (not site-wide). */
export function isHeroReadabilityRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;

  const heroCue =
    /\bhero\b/i.test(text) ||
    /\b(headline|hero\s+(text|words|copy|title|section))\b/i.test(text);

  const readCue =
    /\b(easier\s+to\s+read|easy\s+to\s+read|hard\s+to\s+(read|see)|can['\u2019]?t\s+read|cannot\s+read|blends?\s+into|hard\s+to\s+see|clearer|stand\s+out|contrast|unreadable|illegible|readability|readable)\b/i.test(
      text,
    );

  if (heroCue && readCue) return true;

  // “The text blends into the image” / “I can’t read the headline”
  if (
    /\b(blends?\s+into\s+(the\s+)?(image|photo|background)|can['\u2019]?t\s+read\s+the\s+headline|cannot\s+read\s+the\s+headline|hero\s+text\s+is\s+hard|text\s+is\s+hard\s+to\s+see)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  // Headline-specific readability without the word “hero”
  if (
    /\b(can['\u2019]?t|cannot)\s+read\s+the\s+headline\b/i.test(text) ||
    /\bheadline\b.{0,24}\b(hard\s+to\s+(read|see)|unreadable)\b/i.test(text)
  ) {
    return true;
  }

  return false;
}

export function verifyHeroReadabilityImprovement(
  before: BusinessProject,
  after: BusinessProject,
): {
  improved: boolean;
  beforeScore: number;
  afterScore: number;
  overlayChanged: boolean;
  tokensChanged: boolean;
  explanationHint?: string;
} {
  const a = analyzeHeroReadability(before);
  const b = analyzeHeroReadability(after);
  const overlayChanged = (before.heroOverlay ?? 50) !== (after.heroOverlay ?? 50);
  const tokensChanged =
    overlayChanged ||
    before.backgroundColor !== after.backgroundColor ||
    before.headingFont !== after.headingFont ||
    before.accentColor !== after.accentColor ||
    before.siteWidth !== after.siteWidth ||
    before.heroSubheadline !== after.heroSubheadline ||
    JSON.stringify(before.creativePolish) !== JSON.stringify(after.creativePolish);

  const improved = b.score > a.score && tokensChanged;
  return {
    improved,
    beforeScore: a.score,
    afterScore: b.score,
    overlayChanged,
    tokensChanged,
    explanationHint:
      !tokensChanged
        ? "Rendered hero tokens did not change."
        : b.score <= a.score
          ? "Readability score did not improve."
          : undefined,
  };
}

/** Plan ops from analysis — empty when already readable. */
export function planHeroReadabilityOperations(
  project: BusinessProject,
): {
  assessment: HeroReadabilityAssessment;
  operations: EditOperation[];
  alreadyReadable: boolean;
} {
  const assessment = analyzeHeroReadability(project);
  if (assessment.readable || assessment.recommendedTreatments.length === 0) {
    return {
      assessment,
      operations: [],
      alreadyReadable: true,
    };
  }
  return {
    assessment,
    operations: heroTreatmentsToOperations(assessment.recommendedTreatments),
    alreadyReadable: false,
  };
}

export function snapOverlayValue(value: number): HeroOverlayStep {
  return clampOverlayStep(value);
}
