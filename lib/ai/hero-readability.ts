/**
 * Hero readability diagnosis + local treatments (v1.2).
 * Prefer hero-local fixes; never rewrite brand palette unless explicitly allowed.
 */

import {
  HERO_OVERLAY_STEPS,
  type HeroOverlayStep,
} from "@/data/design-options";
import { contrastRatio, relativeLuminance } from "@/lib/ai/contrast";
import type { EditOperation } from "@/lib/ai/edit-operations";
import { updateInteractionState } from "@/lib/ai/interaction-state";
import type { BusinessProject } from "@/types/business-project";

export const HERO_READABILITY_THRESHOLD = 72;

/** Brand tokens protected during local hero readability fixes. */
export type EditPreservationContext = {
  preserveBrandPalette: boolean;
  protectedThemeTokens: string[];
  approvedDesignDirection?: string;
};

export type ProtectedBrandPalette = {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  backgroundColor: string;
  theme: "light" | "dark" | "auto";
};

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

/** Local-only treatments (no global theme rewrite). */
export type HeroReadabilityTreatment =
  | { kind: "strengthen_overlay"; targetOverlay: HeroOverlayStep; reason: string }
  | { kind: "strengthen_heading"; headingFont: "manrope" | "inter" | "poppins"; reason: string }
  | { kind: "improve_hierarchy"; reason: string }
  | { kind: "airy_spacing"; reason: string }
  | { kind: "simplify_subheadline"; value: string; reason: string };

export type HeroAssessmentSource =
  | "rendered_analysis"
  | "image_analysis"
  | "token_heuristic"
  | "user_report";

export type HeroReadabilityRepairLevel = 0 | 1 | 2 | 3;

export type HeroReadabilityAssessment = {
  readable: boolean;
  score: number;
  /** Score excluding CTA/button issues — used for hero-text verification. */
  heroTextScore: number;
  issues: HeroReadabilityIssue[];
  recommendedTreatments: HeroReadabilityTreatment[];
  confidence: number;
  source: HeroAssessmentSource;
  userReportedIssue?: boolean;
  estimatedSurface: string;
  textColor: string;
  mutedColor: string;
  hasHeroImage: boolean;
  overlay: number;
  imageAnalysisAvailable: boolean;
  notes: string[];
  preservation: EditPreservationContext;
  heuristicReadable: boolean;
};

export type HeroReadabilityDiagnostics = {
  requestId?: string | null;
  intent: "hero_readability";
  requestedScope: "hero";
  assessmentSource: HeroAssessmentSource;
  heuristicScore: number;
  heuristicReadable: boolean;
  userReportedIssue: boolean;
  repairLevelBefore: HeroReadabilityRepairLevel;
  repairLevelAfter: HeroReadabilityRepairLevel;
  heroScoreBefore: number;
  heroScoreAfter: number;
  heroTokensChanged: string[];
  globalPaletteChanged: string[];
  preservationViolation: boolean;
  selectedTreatments: string[];
  verified: boolean;
};

/** Future screenshot / pixel-aware analysis hook (not required for current fix). */
export type HeroVisualAnalysisInput = {
  projectId?: string;
  heroImageId: string | null;
  overlay: number;
  backgroundColor: string;
  textColor: string;
};

export type HeroVisualAnalysisResult = {
  available: boolean;
  busyBehindText?: boolean;
  localBrightnessHotspots?: boolean;
  recommendedOverlay?: HeroOverlayStep;
  confidence: number;
  notes: string[];
};

export type HeroVisualAnalyzer = {
  analyze(input: HeroVisualAnalysisInput): Promise<HeroVisualAnalysisResult>;
};

/** Deterministic low-confidence proxy until pixel analysis exists. */
export const tokenHeuristicHeroVisualAnalyzer: HeroVisualAnalyzer = {
  async analyze(input) {
    return {
      available: false,
      confidence: 0.35,
      recommendedOverlay: input.heroImageId
        ? input.overlay < 75
          ? 75
          : 100
        : undefined,
      notes: [
        "Pixel-level hero analysis unavailable — using token heuristic proxy.",
      ],
    };
  },
};

const DEFAULT_PROTECTED_TOKENS = [
  "primaryColor",
  "accentColor",
  "secondaryColor",
  "backgroundColor",
  "theme",
] as const;

export function defaultHeroPreservationContext(
  approvedDesignDirection?: string,
): EditPreservationContext {
  return {
    preserveBrandPalette: true,
    protectedThemeTokens: [...DEFAULT_PROTECTED_TOKENS],
    approvedDesignDirection,
  };
}

export function captureBrandPalette(project: BusinessProject): ProtectedBrandPalette {
  const theme =
    project.theme === "dark" || project.theme === "auto" ? project.theme : "light";
  return {
    primaryColor: project.primaryColor,
    accentColor: project.accentColor,
    secondaryColor: project.secondaryColor,
    backgroundColor: project.backgroundColor,
    theme,
  };
}

export function restoreBrandPalette(
  project: BusinessProject,
  palette: ProtectedBrandPalette,
): BusinessProject {
  return {
    ...project,
    primaryColor: palette.primaryColor,
    accentColor: palette.accentColor,
    secondaryColor: palette.secondaryColor,
    backgroundColor: palette.backgroundColor,
    theme: palette.theme,
  };
}

export function globalThemeTokensChanged(
  before: BusinessProject,
  after: BusinessProject,
  protectedTokens: string[] = [...DEFAULT_PROTECTED_TOKENS],
): string[] {
  const a = captureBrandPalette(before);
  const b = captureBrandPalette(after);
  const changed: string[] = [];
  if (a.primaryColor !== b.primaryColor && protectedTokens.includes("primaryColor")) {
    changed.push("primaryColor");
  }
  if (a.accentColor !== b.accentColor && protectedTokens.includes("accentColor")) {
    changed.push("accentColor");
  }
  if (
    a.secondaryColor !== b.secondaryColor &&
    protectedTokens.includes("secondaryColor")
  ) {
    changed.push("secondaryColor");
  }
  if (
    a.backgroundColor !== b.backgroundColor &&
    protectedTokens.includes("backgroundColor")
  ) {
    changed.push("backgroundColor");
  }
  if (a.theme !== b.theme && protectedTokens.includes("theme")) {
    changed.push("theme");
  }
  return changed;
}

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
} {
  const lum = relativeLuminance(background) ?? 0;
  const lightBg = lum > 0.5;
  return {
    textColor: lightBg ? "#101828" : "#f2f4f7",
    mutedColor: lightBg ? "#667085" : "#9aa3b2",
  };
}

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

  const imageProxy = "#6b7280";
  notes.push(
    "Hero image brightness couldn’t be measured safely; assuming a busy mid-tone photo and preferring a stronger overlay.",
  );
  return {
    surface: mixHex(imageProxy, bg, overlay),
    hasHeroImage: true,
    imageAnalysisAvailable: false,
    overlay: overlayPct,
    notes,
  };
}

const THIN_HEADING_FONTS = new Set(["playfair", "lora"]);

/**
 * Deterministic hero readability assessment.
 * Default preservation keeps brand palette intact.
 */
export function analyzeHeroReadability(
  project: BusinessProject,
  preservation: EditPreservationContext = defaultHeroPreservationContext(),
): HeroReadabilityAssessment {
  const surfaceInfo = estimateHeroSurface(project);
  const pageBg = project.backgroundColor || "#07090d";
  const { textColor, mutedColor } = derivedTextColors(pageBg);
  const issues: HeroReadabilityIssue[] = [];
  let score = 100;
  let heroTextScore = 100;

  const headlineRatio = contrastRatio(textColor, surfaceInfo.surface);
  const mutedRatio = contrastRatio(mutedColor, surfaceInfo.surface);
  const ctaRatio = contrastRatio(
    "#ffffff",
    project.accentColor || project.primaryColor,
  );

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
    heroTextScore -= 28;
  }

  if (surfaceInfo.hasHeroImage && surfaceInfo.overlay < 50) {
    issues.push("weak_overlay");
    score -= 22;
    heroTextScore -= 22;
  }

  if (surfaceInfo.hasHeroImage && surfaceInfo.overlay < 75) {
    if (!surfaceInfo.imageAnalysisAvailable || surfaceInfo.overlay < 50) {
      if (!issues.includes("busy_image_behind_text")) {
        issues.push("busy_image_behind_text");
        score -= 16;
        heroTextScore -= 16;
      }
    }
  }

  if (THIN_HEADING_FONTS.has(project.headingFont)) {
    issues.push("thin_heading_weight");
    score -= 12;
    heroTextScore -= 12;
  }

  const sub = (project.heroSubheadline ?? "").trim();
  if (
    sub.length > 160 ||
    (sub.length > 100 && !project.creativePolish?.visualHierarchy)
  ) {
    issues.push("small_body_text");
    score -= 10;
    heroTextScore -= 10;
  }

  if (project.siteWidth === "full") {
    issues.push("excessive_line_width");
    score -= 8;
    heroTextScore -= 8;
  }

  if (ctaRatio == null || ctaRatio < 4.5) {
    issues.push("weak_button_contrast");
    score -= 14;
    // Intentionally omitted from heroTextScore — CTA palette is brand, not hero text.
  }

  if (
    !project.creativePolish?.spacing ||
    project.creativePolish.spacing === "default"
  ) {
    issues.push("poor_spacing");
    score -= 6;
    heroTextScore -= 6;
  }

  score = Math.max(0, Math.min(100, score));
  heroTextScore = Math.max(0, Math.min(100, heroTextScore));

  const treatments = selectLocalTreatments({
    project,
    issues,
    surfaceInfo,
    sub,
    preservation,
  });

  const heroTextIssues = issues.filter(
    (i) =>
      i !== "image_unanalyzed" &&
      i !== "poor_spacing" &&
      i !== "weak_button_contrast" &&
      i !== "excessive_line_width",
  );
  const heuristicReadable =
    heroTextScore >= HERO_READABILITY_THRESHOLD && heroTextIssues.length === 0;

  // Token heuristic is a low-confidence proxy when image pixels aren’t measured.
  const confidence = surfaceInfo.hasHeroImage
    ? surfaceInfo.imageAnalysisAvailable
      ? 0.7
      : 0.35
    : 0.75;

  return {
    readable: heuristicReadable,
    heuristicReadable,
    score,
    heroTextScore,
    issues,
    recommendedTreatments: treatments,
    confidence,
    source: "token_heuristic",
    userReportedIssue: false,
    estimatedSurface: surfaceInfo.surface,
    textColor,
    mutedColor,
    hasHeroImage: surfaceInfo.hasHeroImage,
    overlay: surfaceInfo.overlay,
    imageAnalysisAvailable: surfaceInfo.imageAnalysisAvailable,
    notes: [
      ...surfaceInfo.notes,
      ...(surfaceInfo.hasHeroImage && !surfaceInfo.imageAnalysisAvailable
        ? ["Assessment source: low-confidence token heuristic (no pixel analysis)."]
        : []),
    ],
    preservation,
  };
}

function selectLocalTreatments(input: {
  project: BusinessProject;
  issues: HeroReadabilityIssue[];
  surfaceInfo: ReturnType<typeof estimateHeroSurface>;
  sub: string;
  preservation: EditPreservationContext;
}): HeroReadabilityTreatment[] {
  const { project, issues, surfaceInfo, sub } = input;
  const treatments: HeroReadabilityTreatment[] = [];

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
    } else if (surfaceInfo.overlay < 100) {
      // Already at planned min but still struggling — push one more step if possible.
      const bump = nextStrongerOverlay(surfaceInfo.overlay, surfaceInfo.overlay + 1);
      if (bump > surfaceInfo.overlay) {
        treatments.push({
          kind: "strengthen_overlay",
          targetOverlay: bump,
          reason: "Push the hero overlay further so type clears the background.",
        });
      }
    }
  }

  // No-image low contrast: strengthen hierarchy/type locally; do NOT rewrite page bg
  // when preserveBrandPalette is on (global background is a protected token).
  if (
    issues.includes("low_text_background_contrast") &&
    !surfaceInfo.hasHeroImage &&
    !project.creativePolish?.visualHierarchy
  ) {
    treatments.push({
      kind: "improve_hierarchy",
      reason: "Increase heading scale so the hero title reads more clearly.",
    });
  }

  if (issues.includes("thin_heading_weight")) {
    treatments.push({
      kind: "strengthen_heading",
      headingFont: "manrope",
      reason:
        "Switch to a heavier heading face so the hero title holds against the background.",
    });
  }

  if (
    (issues.includes("small_body_text") ||
      issues.includes("thin_heading_weight") ||
      issues.includes("low_text_background_contrast")) &&
    !project.creativePolish?.visualHierarchy
  ) {
    if (!treatments.some((t) => t.kind === "improve_hierarchy")) {
      treatments.push({
        kind: "improve_hierarchy",
        reason: "Increase heading scale so the hero title reads first.",
      });
    }
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

  // Explicitly never emit improve_cta_contrast / changeTheme while preserving brand.
  void input.preservation;

  return prioritizeTreatments(treatments);
}

function prioritizeTreatments(
  treatments: HeroReadabilityTreatment[],
): HeroReadabilityTreatment[] {
  const order: HeroReadabilityTreatment["kind"][] = [
    "strengthen_overlay",
    "strengthen_heading",
    "improve_hierarchy",
    "airy_spacing",
    "simplify_subheadline",
  ];
  return [...treatments]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, 3);
}

/** Convert local treatments — never emits changeTheme / accent rewrites. */
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
      case "strengthen_heading":
        ops.push({
          operation: "setTypography",
          headingFont: treatment.headingFont,
        });
        break;
      case "improve_hierarchy":
        polish = { ...polish, visualHierarchy: true };
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

  // Hard reject any accidental theme ops.
  return ops.filter((op) => op.operation !== "changeTheme");
}

export function buildHeroReadabilityExplanation(
  before: HeroReadabilityAssessment,
  after: HeroReadabilityAssessment,
  applied: HeroReadabilityTreatment[],
  options?: {
    preservedPalette?: boolean;
    repairLevelAfter?: HeroReadabilityRepairLevel;
    maxRepairReached?: boolean;
  },
): string {
  // Never claim “already strong contrast” after an explicit user difficulty report.
  if (options?.maxRepairReached || (applied.length === 0 && before.userReportedIssue)) {
    return "I’ve applied the strongest local contrast treatments available without changing your brand colors. If the headline still blends in, the hero image or crop itself needs to change.";
  }

  if (applied.length === 0 && before.heuristicReadable && !before.userReportedIssue) {
    return "Hero type already meets contrast targets on the current background. If a specific area still feels hard to read, point me at the hero and I’ll strengthen the local overlay.";
  }

  if (applied.length === 0 && !before.readable) {
    return "I couldn’t improve hero readability with local treatments alone without changing your brand colors. Strengthening the overlay further or swapping the hero image would help.";
  }

  const parts: string[] = [];
  for (const t of applied) {
    switch (t.kind) {
      case "strengthen_overlay":
        parts.push("strengthened the hero overlay");
        break;
      case "strengthen_heading":
        parts.push("increased the headline weight");
        break;
      case "improve_hierarchy":
        parts.push("increased the headline scale");
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

  const paletteNote =
    options?.preservedPalette !== false
      ? " without changing your brand colors"
      : "";

  const level = options?.repairLevelAfter ?? 1;
  if (level >= 2 && parts.length > 0) {
    return `I increased the local contrast again${parts.includes("strengthened the hero overlay") ? " with a stronger overlay" : ""}${parts.includes("increased the headline weight") || parts.includes("increased the headline scale") ? " and a clearer headline treatment" : ""}${paletteNote}. If it still feels busy, the image or crop is the remaining issue.`;
  }

  if (parts.includes("strengthened the hero overlay")) {
    return `I strengthened the hero overlay so the headline separates more clearly from the image${paletteNote}.`;
  }

  const lead =
    parts.length > 0
      ? `Done. I ${formatList(parts)} so the text stands out more clearly from the background${paletteNote}.`
      : "I reviewed the hero for readability.";

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
    /\b(easier\s+to\s+read|easy\s+to\s+read|hard\s+to\s+(read|see)|can['\u2019]?t\s+read|cannot\s+read|blends?\s+in(to)?|hard\s+to\s+see|clearer|stand\s+out|contrast|unreadable|illegible|readability|readable|fix\s+(that|it|the\s+contrast))\b/i.test(
      text,
    );

  if (heroCue && readCue) return true;

  if (
    /\b(blends?\s+in(to)?\s+(with\s+)?(the\s+)?(hero\s+)?(image|photo|background)|can['\u2019]?t\s+read\s+the\s+headline|cannot\s+read\s+the\s+headline|hero\s+text\s+is\s+hard|text\s+is\s+hard\s+to\s+see)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\b(can['\u2019]?t|cannot)\s+read\s+the\s+headline\b/i.test(text) ||
    /\bheadline\b.{0,24}\b(hard\s+to\s+(read|see)|unreadable)\b/i.test(text)
  ) {
    return true;
  }

  if (
    /\b(fix\s+the\s+hero\s+contrast|i\s+still\s+can['\u2019]?t\s+read(\s+it|\s+the\s+headline)?|that\s+didn['\u2019]?t\s+fix\s+it|the\s+hero\s+is\s+still\s+hard\s+to\s+read|still\s+hard\s+to\s+read|make\s+the\s+hero\s+text\s+stand\s+out)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Explicit user observation that the hero is hard to read.
 * Overrides heuristic readable:true — scoped to hero only.
 */
export function isUserReportedHeroDifficulty(request: string): boolean {
  if (!isHeroReadabilityRequest(request)) return false;
  const text = request.trim();
  return (
    /\b(blends?\s+in|hard\s+to\s+(read|see)|can['\u2019]?t\s+read|cannot\s+read|still\s+|didn['\u2019]?t\s+fix|stand\s+out\s+more|easier\s+to\s+read|fix\s+that|unreadable|illegible)\b/i.test(
      text,
    )
  );
}

export function getHeroReadabilityRepairLevel(
  project: BusinessProject,
): HeroReadabilityRepairLevel {
  const memory = project.atlasActionMemory as
    | {
        repair?: {
          heroReadability?: { level: number; heroImageId: string | null } | null;
        };
      }
    | undefined;
  const state = memory?.repair?.heroReadability;
  if (!state) return 0;
  const currentImage = project.heroImageId ?? null;
  if ((state.heroImageId ?? null) !== currentImage) return 0;
  const level = state.level;
  if (level === 0 || level === 1 || level === 2 || level === 3) return level;
  return 0;
}

/**
 * Sprint 29.3 — writes canonical repair.heroReadability via adapter.
 * Legacy heroReadabilityRepair mirror is derived on serialize.
 * See docs/atlas-interaction-ownership.md.
 */
export function withHeroReadabilityRepairLevel(
  project: BusinessProject,
  level: HeroReadabilityRepairLevel,
): BusinessProject {
  const now = new Date().toISOString();
  return updateInteractionState(
    project,
    (state) => ({
      ...state,
      repair: {
        ...(state.repair ?? {}),
        heroReadability: {
          level,
          heroImageId: project.heroImageId ?? null,
          updatedAt: now,
        },
      },
      updatedAt: now,
    }),
    { origin: "hero-readability.withHeroReadabilityRepairLevel" },
  );
}

/** Force local corrective treatments for a repair level (1–3). */
export function treatmentsForRepairLevel(
  project: BusinessProject,
  level: Exclude<HeroReadabilityRepairLevel, 0>,
): HeroReadabilityTreatment[] {
  const current = project.heroOverlay ?? 50;
  const treatments: HeroReadabilityTreatment[] = [];

  const targetOverlay: HeroOverlayStep =
    level === 1
      ? nextStrongerOverlay(current, Math.min(75, Math.max(50, current + 25)))
      : level === 2
        ? nextStrongerOverlay(current, 75)
        : 100;

  if (targetOverlay > current) {
    treatments.push({
      kind: "strengthen_overlay",
      targetOverlay,
      reason: "User-reported blending — strengthen local hero overlay.",
    });
  } else if (current < 100) {
    const bump = nextStrongerOverlay(current, current + 1);
    if (bump > current) {
      treatments.push({
        kind: "strengthen_overlay",
        targetOverlay: bump,
        reason: "Escalate hero overlay after continued user difficulty report.",
      });
    }
  }

  if (level >= 2 && !project.creativePolish?.visualHierarchy) {
    treatments.push({
      kind: "improve_hierarchy",
      reason: "Escalate headline scale for clearer separation.",
    });
  }

  if (level >= 3) {
    if (THIN_HEADING_FONTS.has(project.headingFont)) {
      treatments.push({
        kind: "strengthen_heading",
        headingFont: "manrope",
        reason: "Max local escalation — heavier hero heading face.",
      });
    }
    if (
      !project.creativePolish?.visualHierarchy &&
      !treatments.some((t) => t.kind === "improve_hierarchy")
    ) {
      treatments.push({
        kind: "improve_hierarchy",
        reason: "Max local escalation — stronger headline scale.",
      });
    }
  }

  return prioritizeTreatments(treatments);
}

/** User noticed Atlas wiped brand colors during a prior edit. */
export function isBrandRegressionComplaint(request: string): boolean {
  const text = request.trim();
  if (!text) return false;
  return (
    /\b(why\s+did\s+you|get\s+rid\s+of|removed|changed|lost|wiped)\b[\s\S]{0,60}\b(gold|green|brand|color|palette|accent)s?\b/i.test(
      text,
    ) ||
    /\b(gold|green|brand\s+colors?|palette|accent)\b[\s\S]{0,40}\b(gone|missing|changed|removed)\b/i.test(
      text,
    )
  );
}

export function listHeroLocalTokenChanges(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const changed: string[] = [];
  if ((before.heroOverlay ?? 50) !== (after.heroOverlay ?? 50)) {
    changed.push("heroOverlay");
  }
  if (before.headingFont !== after.headingFont) {
    changed.push("headingFont");
  }
  if (before.heroSubheadline !== after.heroSubheadline) {
    changed.push("heroSubheadline");
  }
  if (
    JSON.stringify(before.creativePolish ?? null) !==
    JSON.stringify(after.creativePolish ?? null)
  ) {
    changed.push("creativePolish");
  }
  return changed;
}

export function verifyHeroReadabilityImprovement(
  before: BusinessProject,
  after: BusinessProject,
  preservation: EditPreservationContext = defaultHeroPreservationContext(),
  options?: { userReportedIssue?: boolean },
): {
  improved: boolean;
  beforeScore: number;
  afterScore: number;
  overlayChanged: boolean;
  tokensChanged: boolean;
  heroTokensChanged: string[];
  globalThemeTokensChanged: string[];
  preservationViolation: boolean;
  explanationHint?: string;
} {
  const a = analyzeHeroReadability(before, preservation);
  const b = analyzeHeroReadability(after, preservation);
  const heroTokensChanged = listHeroLocalTokenChanges(before, after);
  const themeChanged = globalThemeTokensChanged(
    before,
    after,
    preservation.protectedThemeTokens,
  );
  const preservationViolation =
    preservation.preserveBrandPalette && themeChanged.length > 0;
  const overlayChanged = (before.heroOverlay ?? 50) !== (after.heroOverlay ?? 50);
  const tokensChanged = heroTokensChanged.length > 0;

  // Button / accent-only diffs must never count as hero-readability success.
  const accentOnly =
    themeChanged.includes("accentColor") &&
    heroTokensChanged.length === 0;

  // User-reported difficulty: verify the corrective treatment was applied,
  // not that the low-confidence heuristic score crossed a threshold.
  const improved = options?.userReportedIssue
    ? !preservationViolation && !accentOnly && tokensChanged
    : !preservationViolation &&
      !accentOnly &&
      b.heroTextScore > a.heroTextScore &&
      tokensChanged;

  return {
    improved,
    beforeScore: a.heroTextScore,
    afterScore: b.heroTextScore,
    overlayChanged,
    tokensChanged,
    heroTokensChanged,
    globalThemeTokensChanged: themeChanged,
    preservationViolation,
    explanationHint: preservationViolation
      ? "Hero readability must not change protected brand colors."
      : accentOnly
        ? "Button contrast alone does not satisfy a hero-readability request."
        : !tokensChanged
          ? "Rendered hero tokens did not change."
          : !options?.userReportedIssue && b.heroTextScore <= a.heroTextScore
            ? "Hero readability score did not improve."
            : undefined,
  };
}

/** Plan local ops — user reports override heuristic readable:true. */
export function planHeroReadabilityOperations(
  project: BusinessProject,
  preservation: EditPreservationContext = defaultHeroPreservationContext(),
  options?: { request?: string },
): {
  assessment: HeroReadabilityAssessment;
  operations: EditOperation[];
  alreadyReadable: boolean;
  paletteBefore: ProtectedBrandPalette;
  repairLevelBefore: HeroReadabilityRepairLevel;
  repairLevelAfter: HeroReadabilityRepairLevel;
  maxRepairReached: boolean;
} {
  const request = options?.request?.trim() ?? "";
  const heuristic = analyzeHeroReadability(project, preservation);
  const paletteBefore = captureBrandPalette(project);
  const repairLevelBefore = getHeroReadabilityRepairLevel(project);
  const userReported =
    Boolean(request) && isUserReportedHeroDifficulty(request);

  // Direct user observation always overrides heuristic readable:true for hero scope.
  const shouldOverride = userReported;

  if (!shouldOverride && heuristic.heuristicReadable) {
    return {
      assessment: heuristic,
      operations: [],
      alreadyReadable: true,
      paletteBefore,
      repairLevelBefore,
      repairLevelAfter: repairLevelBefore,
      maxRepairReached: false,
    };
  }

  if (!shouldOverride && heuristic.recommendedTreatments.length > 0) {
    return {
      assessment: heuristic,
      operations: heroTreatmentsToOperations(heuristic.recommendedTreatments),
      alreadyReadable: false,
      paletteBefore,
      repairLevelBefore,
      repairLevelAfter: Math.min(
        3,
        Math.max(1, repairLevelBefore + 1),
      ) as HeroReadabilityRepairLevel,
      maxRepairReached: false,
    };
  }

  // User report path (or empty heuristic treatments with difficulty report).
  const repairLevelAfter = (
    repairLevelBefore >= 3
      ? 3
      : Math.min(3, Math.max(1, repairLevelBefore + 1))
  ) as HeroReadabilityRepairLevel;

  const forced =
    repairLevelAfter === 0
      ? []
      : treatmentsForRepairLevel(
          project,
          repairLevelAfter as 1 | 2 | 3,
        );

  // Prefer forced escalation treatments; fall back to heuristic set.
  const treatments =
    forced.length > 0 ? forced : heuristic.recommendedTreatments;
  const operations = heroTreatmentsToOperations(treatments);
  const maxRepairReached =
    userReported && operations.length === 0 && repairLevelBefore >= 3;

  const assessment: HeroReadabilityAssessment = {
    ...heuristic,
    readable: userReported ? false : heuristic.readable,
    userReportedIssue: userReported,
    source: userReported ? "user_report" : heuristic.source,
    confidence: userReported ? Math.min(heuristic.confidence, 0.4) : heuristic.confidence,
    recommendedTreatments: treatments,
    issues: userReported
      ? Array.from(
          new Set<HeroReadabilityIssue>([
            ...heuristic.issues,
            "busy_image_behind_text",
            "low_text_background_contrast",
          ]),
        )
      : heuristic.issues,
  };

  return {
    assessment,
    operations,
    alreadyReadable: false,
    paletteBefore,
    repairLevelBefore,
    repairLevelAfter,
    maxRepairReached,
  };
}

export function buildHeroReadabilityDiagnostics(input: {
  requestId?: string | null;
  before: BusinessProject;
  after: BusinessProject;
  treatments: HeroReadabilityTreatment[];
  verified: boolean;
  preservation?: EditPreservationContext;
  assessmentSource?: HeroAssessmentSource;
  userReportedIssue?: boolean;
  repairLevelBefore?: HeroReadabilityRepairLevel;
  repairLevelAfter?: HeroReadabilityRepairLevel;
}): HeroReadabilityDiagnostics {
  const preservation = input.preservation ?? defaultHeroPreservationContext();
  const check = verifyHeroReadabilityImprovement(
    input.before,
    input.after,
    preservation,
    { userReportedIssue: input.userReportedIssue },
  );
  const heuristic = analyzeHeroReadability(input.before, preservation);
  return {
    requestId: input.requestId ?? null,
    intent: "hero_readability",
    requestedScope: "hero",
    assessmentSource: input.assessmentSource ?? heuristic.source,
    heuristicScore: heuristic.heroTextScore,
    heuristicReadable: heuristic.heuristicReadable,
    userReportedIssue: Boolean(input.userReportedIssue),
    repairLevelBefore: input.repairLevelBefore ?? 0,
    repairLevelAfter: input.repairLevelAfter ?? 0,
    heroScoreBefore: check.beforeScore,
    heroScoreAfter: check.afterScore,
    heroTokensChanged: check.heroTokensChanged,
    globalPaletteChanged: check.globalThemeTokensChanged,
    preservationViolation: check.preservationViolation,
    selectedTreatments: input.treatments.map((t) => t.kind),
    verified: input.verified && check.improved,
  };
}

export function logHeroReadabilityDiagnostics(
  diagnostics: HeroReadabilityDiagnostics,
): void {
  // Safe structured log — no prompts or project content.
  console.info(
    "[atlas.hero_readability]",
    JSON.stringify({
      type: "hero_readability",
      ...diagnostics,
    }),
  );
}

export function snapOverlayValue(value: number): HeroOverlayStep {
  return clampOverlayStep(value);
}

/** Reject ops that would violate brand preservation for hero-local requests. */
export function filterOperationsForBrandPreservation(
  operations: EditOperation[],
  preservation: EditPreservationContext = defaultHeroPreservationContext(),
): EditOperation[] {
  if (!preservation.preserveBrandPalette) return operations;
  return operations.filter((op) => {
    if (op.operation === "changeTheme") return false;
    if (op.operation === "replaceColors") return false;
    return true;
  });
}
