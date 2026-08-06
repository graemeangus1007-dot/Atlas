/**
 * HeroComposition — coordinated hero render model (P0).
 * Optional on BusinessProject; always resolved at render time.
 */

export const HERO_COMPOSITION_VERSION = 1 as const;

export type HeroCompositionLayout =
  | "full_width"
  | "split"
  | "contained"
  | "floating_card";

export type HeroMinHeight = "short" | "medium" | "tall" | "viewport";
export type HeroContentAlignment = "left" | "center" | "right";
export type HeroVerticalAlignment = "top" | "center" | "bottom";
export type HeroContentWidth = "narrow" | "medium" | "wide";
export type HeroHeadingScale = "sm" | "md" | "lg" | "xl";
export type HeroBodyScale = "sm" | "md" | "lg";
export type HeroCtaArrangement = "row" | "stack";
export type HeroPrimaryEmphasis = "default" | "strong" | "quiet";
export type HeroMobileLayout =
  | "stack_copy_first"
  | "stack_image_first"
  | "keep_overlay";

/**
 * Persisted / resolved coordinated hero composition.
 * Does not replace heroOverlay / heroTreatment / heroImagePresentation —
 * those remain mirrored sources for CSS vars and legacy tools.
 */
export type HeroComposition = {
  /** Pattern id when applied later; null for legacy-inferred compositions. */
  patternId: string | null;
  version: typeof HERO_COMPOSITION_VERSION;
  layout: HeroCompositionLayout;
  /**
   * Template heroLayout this composition mirrors (for CSS class parity).
   * Present on legacy inference; optional on future pattern applies.
   */
  legacyLayoutKey?: "centered" | "split" | "minimal" | "bold-overlay";
  minHeight: HeroMinHeight;
  contentAlignment: HeroContentAlignment;
  verticalAlignment: HeroVerticalAlignment;
  contentWidth: HeroContentWidth;
  image: {
    fit: "cover" | "contain";
    position: "center" | "top" | "bottom" | "left" | "right";
    zoom: number;
    focalPoint: { x: number; y: number };
  };
  treatment: {
    /** Effective overlay 0–100 used for rendering. */
    overlay: number;
    gradient?: {
      direction: "left" | "right" | "top" | "bottom";
      strength: number;
      coverage: number;
    } | null;
    textScrim?: {
      enabled: boolean;
      opacity: number;
      blur?: number;
    } | null;
  };
  typography: {
    headingScale: HeroHeadingScale;
    headingWeight: 400 | 500 | 600 | 700;
    bodyScale: HeroBodyScale;
    showSecondaryCta: boolean;
  };
  cta: {
    arrangement: HeroCtaArrangement;
    alignment: HeroContentAlignment;
    primaryEmphasis: HeroPrimaryEmphasis;
  };
  mobile: {
    layout: HeroMobileLayout;
    minHeight: HeroMinHeight;
  };
  /** Decorative layers matching legacy PreviewHero. */
  accents: {
    showAccentWash: boolean;
    showGrid: boolean;
  };
};

/** Inputs needed to resolve a composition without a full BusinessProject. */
export type HeroCompositionResolveInput = {
  heroComposition?: HeroComposition | null;
  heroLayout: "centered" | "split" | "minimal" | "bold-overlay";
  heroOverlay: number;
  heroTreatment?: {
    overlayOpacity?: number;
    gradient?: {
      direction: "left" | "right" | "top" | "bottom";
      strength: number;
      coverage: number;
    };
    textScrim?: {
      enabled: boolean;
      opacity: number;
      blur?: number;
    };
    textPosition?: "left" | "center" | "right";
  };
  heroImagePresentation?: {
    fit: "cover" | "contain" | "full";
    focalPoint: { x: number; y: number };
    zoom: number;
    position: "center" | "top" | "bottom" | "left" | "right";
  };
};
