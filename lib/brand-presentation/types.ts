/**
 * Adaptive Brand Presentation — identity vs presentation (computed).
 * Identity is never mutated; presentation is derived at render time.
 */

import type { BusinessProject } from "@/types/business-project";

export const WHITE_PRESENTATION = "#ffffff";
export const NEAR_BLACK_PRESENTATION = "#101828";

export type BrandIdentity = {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  theme: BusinessProject["theme"];
  typography: {
    headingFont: BusinessProject["headingFont"];
    bodyFont: BusinessProject["bodyFont"];
  };
};

export type HeroCtaPresentationStyle = {
  background: string;
  color: string;
  border?: string;
  emphasis: "strong" | "default" | "quiet" | "outline";
};

export type BrandPresentationDecisions = {
  usedWhitePresentation: boolean;
  headlineColorDecision: string;
  ctaDecision: string;
  scrimDecision: string;
  gradientDecision: string;
  presentationDecision: string;
  overlayDecision: string;
};

export type AdaptiveBrandPresentation = {
  heroHeadlineColor: string;
  heroEyebrowColor: string;
  heroBodyColor: string;
  heroPrimaryCTAStyle: HeroCtaPresentationStyle;
  heroSecondaryCTAStyle: HeroCtaPresentationStyle;
  heroOverlayStrength: number;
  heroScrim: {
    enabled: boolean;
    opacity: number;
    blur: number;
  };
  heroGradient: {
    direction: "bottom" | "top" | "left" | "right";
    strength: number;
    coverage: number;
  } | null;
  heroButtonContrast: number;
  decisions: BrandPresentationDecisions;
};

export type ImageBrightnessClass = "light" | "medium" | "dark" | "unknown";
export type ImageComplexityClass = "simple" | "moderate" | "busy" | "unknown";

export type HeroImagePresentationContext = {
  hasImage: boolean;
  brightness: ImageBrightnessClass;
  complexity: ImageComplexityClass;
  dominantFamily: "warm" | "cool" | "neutral" | "unknown";
  titleHints: string[];
  aspectRatio: number | null;
};

export type BrandPresentationEvaluation = {
  presentationScore: number;
  headlineContrast: number;
  bodyContrast: number;
  ctaContrast: number;
  accentVisibility: number;
  brandConsistency: number;
  visualHarmony: number;
  accessibility: number;
  firstImpression: number;
  overallReadability: number;
};

export type ResolvedBrandPresentation = {
  identity: BrandIdentity;
  presentation: AdaptiveBrandPresentation;
  evaluation: BrandPresentationEvaluation;
  image: HeroImagePresentationContext;
  /** Effective surface used for contrast math (proxy). */
  effectiveHeroSurface: string;
};

export type BrandPresentationDiagnostics = {
  presentationScore: number;
  brandIntegrityScore: number;
  contrastImprovement: number;
  presentationDecision: string;
  headlineColorDecision: string;
  ctaDecision: string;
  scrimDecision: string;
  gradientDecision: string;
};

export type BrandPresentationVerifyResult = {
  verified: boolean;
  failures: string[];
  diagnostics: BrandPresentationDiagnostics;
};

/** CSS custom properties emitted for Editor / Preview / Publish. */
export type BrandPresentationCssVars = Record<string, string>;
