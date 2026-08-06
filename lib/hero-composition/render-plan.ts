/**
 * Shared hero render plan — single contract for Editor, Preview, and Publish.
 */

import type {
  HeroComposition,
  HeroContentAlignment,
  HeroContentWidth,
  HeroHeadingScale,
  HeroMinHeight,
  HeroVerticalAlignment,
} from "@/lib/hero-composition/types";

export type HeroRenderPlan = {
  composition: HeroComposition;
  /** Structural variant */
  variant: "split" | "overlay";
  legacyLayoutKey: "centered" | "split" | "minimal" | "bold-overlay";
  /** Parity contract — compared across surfaces */
  contract: {
    layout: HeroComposition["layout"];
    legacyLayoutKey: "centered" | "split" | "minimal" | "bold-overlay";
    minHeight: HeroMinHeight;
    contentAlignment: HeroContentAlignment;
    verticalAlignment: HeroVerticalAlignment;
    contentWidth: HeroContentWidth;
    headingScale: HeroHeadingScale;
    overlay: number;
    showAccentWash: boolean;
    showGrid: boolean;
    showSecondaryCta: boolean;
    ctaAlignment: HeroContentAlignment;
    mobileLayout: HeroComposition["mobile"]["layout"];
  };
  sectionClassName: string;
  contentAlignClass: string;
  ctaJustifyClass: string;
  titleSizeClass: string;
  ledeWidthClass: string;
  /** CSS custom properties driven by composition tokens */
  cssVars: Record<string, string>;
  dataAttributes: Record<string, string>;
};

const MIN_HEIGHT_PAD: Record<HeroMinHeight, string> = {
  short: "px-5 py-16 sm:px-8 sm:py-20",
  medium: "px-5 py-24 sm:px-8 sm:py-32",
  tall: "px-5 py-28 sm:px-8 sm:py-36",
  viewport: "px-5 py-28 sm:px-8 sm:py-36 min-h-[78vh]",
};

/** Split uses the historical split padding (medium-tall). */
const SPLIT_PAD = "px-5 py-20 sm:px-8 sm:py-28";

const TITLE_SIZE: Record<HeroHeadingScale, string> = {
  sm: "text-3xl sm:text-4xl md:text-5xl",
  md: "text-4xl sm:text-5xl",
  lg: "text-4xl sm:text-5xl md:text-6xl",
  xl: "text-5xl sm:text-6xl md:text-7xl",
};

const CONTENT_MAX: Record<HeroContentWidth, string> = {
  narrow: "36rem",
  medium: "42rem",
  wide: "48rem",
};

const MIN_HEIGHT_CSS: Record<HeroMinHeight, string> = {
  short: "0px",
  medium: "0px",
  tall: "0px",
  viewport: "78vh",
};

function alignTextClass(align: HeroContentAlignment): string {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}

function ctaJustifyClass(align: HeroContentAlignment): string {
  if (align === "left") return "justify-start";
  if (align === "right") return "justify-end";
  return "justify-center";
}

function legacyKey(
  composition: HeroComposition,
): "centered" | "split" | "minimal" | "bold-overlay" {
  if (composition.legacyLayoutKey) return composition.legacyLayoutKey;
  if (composition.layout === "split") return "split";
  if (composition.minHeight === "short") return "minimal";
  if (
    composition.contentAlignment === "left" &&
    composition.typography.headingScale === "xl"
  ) {
    return "bold-overlay";
  }
  return "centered";
}

/**
 * Build the shared render plan from a resolved composition.
 */
export function buildHeroRenderPlan(
  composition: HeroComposition,
): HeroRenderPlan {
  const legacyLayoutKey = legacyKey(composition);
  const variant = composition.layout === "split" ? "split" : "overlay";
  const sectionClassName =
    variant === "split"
      ? SPLIT_PAD
      : MIN_HEIGHT_PAD[composition.minHeight] ?? MIN_HEIGHT_PAD.medium;

  const contentAlignClass = alignTextClass(composition.contentAlignment);
  const ctaAlign = composition.cta.alignment;
  const titleSizeClass = TITLE_SIZE[composition.typography.headingScale];
  const ledeWidthClass =
    composition.contentAlignment === "center"
      ? "mx-auto max-w-2xl"
      : "max-w-xl";

  const contract = {
    layout: composition.layout,
    legacyLayoutKey,
    minHeight: composition.minHeight,
    contentAlignment: composition.contentAlignment,
    verticalAlignment: composition.verticalAlignment,
    contentWidth: composition.contentWidth,
    headingScale: composition.typography.headingScale,
    overlay: composition.treatment.overlay,
    showAccentWash: composition.accents.showAccentWash,
    showGrid: composition.accents.showGrid,
    showSecondaryCta: composition.typography.showSecondaryCta,
    ctaAlignment: ctaAlign,
    mobileLayout: composition.mobile.layout,
  };

  const dataAttributes: Record<string, string> = {
    "data-hero-layout": legacyLayoutKey,
    "data-hero-composition-layout": composition.layout,
    "data-hero-min-height": composition.minHeight,
    "data-hero-content-align": composition.contentAlignment,
    "data-hero-vertical-align": composition.verticalAlignment,
    "data-hero-content-width": composition.contentWidth,
    "data-hero-heading-scale": composition.typography.headingScale,
    "data-hero-mobile-layout": composition.mobile.layout,
  };

  const cssVars: Record<string, string> = {
    "--site-hero-overlay": String(composition.treatment.overlay / 100),
    "--site-hero-min-height": MIN_HEIGHT_CSS[composition.minHeight],
    "--site-hero-content-align": composition.contentAlignment,
    "--site-hero-vertical-align": composition.verticalAlignment,
    "--site-hero-content-max": CONTENT_MAX[composition.contentWidth],
  };

  return {
    composition,
    variant,
    legacyLayoutKey,
    contract,
    sectionClassName,
    contentAlignClass,
    ctaJustifyClass: ctaJustifyClass(ctaAlign),
    titleSizeClass,
    ledeWidthClass,
    cssVars,
    dataAttributes,
  };
}

/** Stable JSON contract for parity assertions. */
export function heroParityContract(
  composition: HeroComposition,
): HeroRenderPlan["contract"] {
  return buildHeroRenderPlan(composition).contract;
}
