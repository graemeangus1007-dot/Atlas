/**
 * Hero visual balance — readability vs image visibility (v1.3.2).
 * Corrective follow-ups after overlay strengthening must rebalance, not empty-plan.
 */

import {
  HERO_OVERLAY_STEPS,
  type HeroOverlayStep,
} from "@/data/design-options";
import { contrastRatio } from "@/lib/ai/contrast";
import type { EditOperation } from "@/lib/ai/edit-operations";
import {
  analyzeHeroReadability,
  captureBrandPalette,
  defaultHeroPreservationContext,
  type ProtectedBrandPalette,
} from "@/lib/ai/hero-readability";
import type { BusinessProject } from "@/types/business-project";

export type HeroGradientDirection = "left" | "right" | "top" | "bottom";
export type HeroTextPosition = "left" | "center" | "right";

export type HeroTreatment = {
  overlayOpacity?: number;
  gradient?: {
    direction: HeroGradientDirection;
    strength: number;
    coverage: number;
  };
  textScrim?: {
    enabled: boolean;
    opacity: number;
    blur?: number;
  };
  textPosition?: HeroTextPosition;
};

export type HeroVisualBalanceIssue =
  | "text_low_contrast"
  | "image_overdarkened"
  | "global_overlay_too_strong"
  | "missing_local_scrim"
  | "poor_text_position"
  | "cta_low_contrast";

export type HeroVisualBalanceAssessment = {
  textReadabilityScore: number;
  imageVisibilityScore: number;
  ctaContrastScore: number;
  overlayStrength: number;
  hasDirectionalGradient: boolean;
  hasTextScrim: boolean;
  textPosition?: HeroTextPosition;
  repairLevel: number;
  issues: HeroVisualBalanceIssue[];
};

export type HeroBalanceDiagnostics = {
  requestId?: string | null;
  intent: "hero_balance_repair";
  repairType: "reduce_overlay_localize_contrast" | "max_safe_balance";
  overlayBefore: number;
  overlayAfter: number;
  readabilityBefore: number;
  readabilityAfter: number;
  imageVisibilityBefore: number;
  imageVisibilityAfter: number;
  gradientApplied: boolean;
  scrimApplied: boolean;
  globalPaletteChanged: boolean;
  verified: boolean;
};

const IMAGE_VISIBILITY_THRESHOLD = 48;
const TEXT_READABILITY_FLOOR = 62;
const CTA_CONTRAST_FLOOR = 3.5;

const IMAGE_VISIBILITY_PHRASE =
  /\b(image|photo|picture|hero\s+image|hero\s+photo)\b[\s\S]{0,48}\b(hard\s+to\s+see|too\s+dark|disappeared|covered|hidden|washed\s+out|lost|easier\s+to\s+see|clearer|more\s+visible)\b|\b(hard\s+to\s+see|too\s+dark|covered|disappeared|easier\s+to\s+see|clearer|more\s+visible)\b[\s\S]{0,48}\b(image|photo|picture)\b|\b(overlay\s+is\s+too\s+strong|covered\s+too\s+much|show\s+more\s+of\s+the\s+(photo|image)|keep\s+the\s+(text|words)\s+readable\s+but\s+show|i\s+can\s+read\s+the\s+text\s+now|make\s+the\s+image\s+clearer\s+while\s+keeping|still\s+too\s+dark|a\s+little\s+(more\s+)?(visible|easier\s+to\s+see))\b/i;

/**
 * Corrective follow-up after a hero overlay/readability pass.
 */
export function isHeroImageVisibilityComplaint(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return IMAGE_VISIBILITY_PHRASE.test(text);
}

/** Image-visibility corrective follow-up (Action Memory must never intercept). */
export function isHeroVisualRepairRequest(request: string): boolean {
  return isHeroImageVisibilityComplaint(request);
}

export function nextWeakerOverlay(current: number): HeroOverlayStep {
  let weaker: HeroOverlayStep | null = null;
  for (const step of HERO_OVERLAY_STEPS) {
    if (step < current) weaker = step;
  }
  return weaker ?? 0;
}

function clampOverlay(value: number): HeroOverlayStep {
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

function imageVisibilityScore(project: BusinessProject): number {
  const overlay = Math.min(100, Math.max(0, project.heroOverlay ?? 50));
  const treatment = project.heroTreatment;
  const hasGradient = Boolean(treatment?.gradient);
  const hasScrim = Boolean(treatment?.textScrim?.enabled);
  let score = 100 - overlay * 0.9;
  if (hasGradient) score += 14;
  if (hasScrim) score += 6;
  if (overlay >= 100) score -= 12;
  if (overlay >= 75 && !hasGradient) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Global-overlay heuristic under-credits localized gradient/scrim.
 * Credit local treatments so balance repair isn’t falsely rejected.
 */
function balancedTextReadabilityScore(project: BusinessProject): number {
  const raw = analyzeHeroReadability(
    project,
    defaultHeroPreservationContext(),
  ).heroTextScore;
  const treatment = project.heroTreatment;
  let credit = 0;
  if (treatment?.gradient) {
    credit += Math.round(
      18 * treatment.gradient.strength * treatment.gradient.coverage,
    );
  }
  if (treatment?.textScrim?.enabled) {
    credit += Math.round(14 * treatment.textScrim.opacity);
  }
  return Math.max(0, Math.min(100, raw + credit));
}

function ctaContrastScore(project: BusinessProject): number {
  const accent = project.accentColor || project.primaryColor;
  const ratio = contrastRatio("#ffffff", accent) ?? 1;
  return Math.max(0, Math.min(100, Math.round((ratio / 7) * 100)));
}

export function analyzeHeroVisualBalance(
  project: BusinessProject,
): HeroVisualBalanceAssessment {
  const textScore = balancedTextReadabilityScore(project);
  const overlayStrength = Math.min(100, Math.max(0, project.heroOverlay ?? 50));
  const hasDirectionalGradient = Boolean(project.heroTreatment?.gradient);
  const hasTextScrim = Boolean(project.heroTreatment?.textScrim?.enabled);
  const textPosition = project.heroTreatment?.textPosition;
  const imgScore = imageVisibilityScore(project);
  const ctaScore = ctaContrastScore(project);
  const issues: HeroVisualBalanceIssue[] = [];

  if (textScore < TEXT_READABILITY_FLOOR) {
    issues.push("text_low_contrast");
  }
  if (imgScore < IMAGE_VISIBILITY_THRESHOLD) {
    issues.push("image_overdarkened");
  }
  if (overlayStrength >= 75 && !hasDirectionalGradient) {
    issues.push("global_overlay_too_strong");
  }
  if (overlayStrength >= 50 && !hasTextScrim) {
    issues.push("missing_local_scrim");
  }
  if (ctaScore < CTA_CONTRAST_FLOOR * 12) {
    issues.push("cta_low_contrast");
  }

  const repairLevel =
    (
      project.atlasActionMemory as
        | { repair?: { heroReadability?: { level?: number } | null } }
        | undefined
    )?.repair?.heroReadability?.level ?? 0;

  return {
    textReadabilityScore: textScore,
    imageVisibilityScore: imgScore,
    ctaContrastScore: ctaScore,
    overlayStrength,
    hasDirectionalGradient,
    hasTextScrim,
    textPosition,
    repairLevel: typeof repairLevel === "number" ? repairLevel : 0,
    issues,
  };
}

export type HeroBalancePlan = {
  operations: EditOperation[];
  assessmentBefore: HeroVisualBalanceAssessment;
  targetOverlay: HeroOverlayStep;
  treatment: HeroTreatment;
  explanation: string;
  maxSafeBalance: boolean;
  paletteBefore: ProtectedBrandPalette;
};

/**
 * Prefer localizing contrast (gradient + scrim) over a flat global overlay.
 */
export function planHeroBalanceRepair(input: {
  project: BusinessProject;
  request: string;
}): HeroBalancePlan {
  const before = analyzeHeroVisualBalance(input.project);
  const paletteBefore = captureBrandPalette(input.project);
  const currentOverlay = clampOverlay(input.project.heroOverlay ?? 50);

  // Minimum overlay floor so we don't recreate the original readability bug.
  const floor: HeroOverlayStep = before.textReadabilityScore >= 80 ? 25 : 50;
  const weaker = nextWeakerOverlay(currentOverlay);
  const targetOverlay: HeroOverlayStep =
    weaker >= floor ? weaker : currentOverlay;

  const alreadyLocalized =
    before.hasDirectionalGradient && before.hasTextScrim;
  const cannotReduce = targetOverlay >= currentOverlay;

  if (cannotReduce && alreadyLocalized) {
    return {
      operations: [],
      assessmentBefore: before,
      targetOverlay: currentOverlay,
      treatment: input.project.heroTreatment ?? {},
      maxSafeBalance: true,
      paletteBefore,
      explanation:
        "The overlay is already at the safest balance. Showing the full image or changing its crop is the next best step.",
    };
  }

  const treatment: HeroTreatment = {
    overlayOpacity: targetOverlay,
    gradient: {
      direction: "bottom",
      strength: Math.min(0.85, 0.45 + (100 - targetOverlay) / 200),
      coverage: 0.62,
    },
    textScrim: {
      enabled: true,
      opacity: 0.42,
      blur: 8,
    },
    textPosition: input.project.heroTreatment?.textPosition ?? "center",
  };

  const operations: EditOperation[] = [];
  if (targetOverlay < currentOverlay) {
    operations.push({ operation: "setHeroOverlay", value: targetOverlay });
  }
  operations.push({
    operation: "setHeroTreatment",
    gradient: treatment.gradient,
    textScrim: treatment.textScrim,
    textPosition: treatment.textPosition,
  });

  const parts: string[] = [];
  if (targetOverlay < currentOverlay) {
    parts.push("reduced the full-image overlay");
  }
  parts.push("moved the contrast treatment behind the text");
  if (!before.hasTextScrim) {
    parts.push("added a local text scrim");
  }

  return {
    operations,
    assessmentBefore: before,
    targetOverlay,
    treatment,
    maxSafeBalance: false,
    paletteBefore,
    explanation: `I ${parts.join(" and ")}, so the photo is more visible while the headline stays readable.`,
  };
}

export function verifyHeroBalanceRepair(input: {
  before: BusinessProject;
  after: BusinessProject;
  assessmentBefore: HeroVisualBalanceAssessment;
}): {
  verified: boolean;
  assessmentAfter: HeroVisualBalanceAssessment;
  globalPaletteChanged: boolean;
  failures: string[];
} {
  const after = analyzeHeroVisualBalance(input.after);
  const paletteChanged =
    input.before.primaryColor !== input.after.primaryColor ||
    input.before.accentColor !== input.after.accentColor ||
    input.before.secondaryColor !== input.after.secondaryColor ||
    input.before.backgroundColor !== input.after.backgroundColor;

  const failures: string[] = [];
  const imageImproved =
    after.imageVisibilityScore > input.assessmentBefore.imageVisibilityScore;
  const textOk = after.textReadabilityScore >= TEXT_READABILITY_FLOOR;
  // CTA is brand-owned; only fail if palette shifted or CTA score dropped.
  const ctaOk =
    !paletteChanged &&
    after.ctaContrastScore >= input.assessmentBefore.ctaContrastScore - 1;

  if (!imageImproved) failures.push("image_visibility_not_improved");
  if (!textOk) failures.push("text_readability_regressed");
  if (!ctaOk) failures.push("cta_contrast_regressed");
  if (paletteChanged) failures.push("global_palette_changed");

  return {
    verified: failures.length === 0,
    assessmentAfter: after,
    globalPaletteChanged: paletteChanged,
    failures,
  };
}

export function logHeroBalanceDiagnostics(
  diagnostics: HeroBalanceDiagnostics,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:hero-balance]", {
    requestId: diagnostics.requestId ?? null,
    intent: diagnostics.intent,
    repairType: diagnostics.repairType,
    overlayBefore: diagnostics.overlayBefore,
    overlayAfter: diagnostics.overlayAfter,
    readabilityBefore: diagnostics.readabilityBefore,
    readabilityAfter: diagnostics.readabilityAfter,
    imageVisibilityBefore: diagnostics.imageVisibilityBefore,
    imageVisibilityAfter: diagnostics.imageVisibilityAfter,
    gradientApplied: diagnostics.gradientApplied,
    scrimApplied: diagnostics.scrimApplied,
    globalPaletteChanged: diagnostics.globalPaletteChanged,
    verified: diagnostics.verified,
  });
}
