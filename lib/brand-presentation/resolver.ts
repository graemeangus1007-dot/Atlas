/**
 * Resolve adaptive brand presentation from project — never mutates identity.
 */

import { adaptBrandPresentation } from "@/lib/brand-presentation/adapt";
import { evaluateBrandPresentation } from "@/lib/brand-presentation/evaluator";
import {
  estimateEffectiveHeroSurface,
  readHeroImagePresentationContext,
} from "@/lib/brand-presentation/image-context";
import type {
  BrandIdentity,
  BrandPresentationCssVars,
  ResolvedBrandPresentation,
} from "@/lib/brand-presentation/types";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";

export function readBrandIdentity(project: BusinessProject): BrandIdentity {
  return {
    primary: project.primaryColor,
    secondary: project.secondaryColor,
    accent: project.accentColor,
    neutral: project.backgroundColor,
    theme: project.theme,
    typography: {
      headingFont: project.headingFont,
      bodyFont: project.bodyFont,
    },
  };
}

/**
 * Compute hero-scoped presentation colors/treatments.
 * Does not write to the project or Brand Studio palette.
 */
export function resolveAdaptiveBrandPresentation(
  project: BusinessProject,
): ResolvedBrandPresentation {
  const identity = readBrandIdentity(project);
  const image = readHeroImagePresentationContext(project);
  const composition = resolveHeroCompositionFromProject(project);
  const effectiveHeroSurface = estimateEffectiveHeroSurface(
    image,
    identity.neutral,
  );
  const presentation = adaptBrandPresentation({
    identity,
    image,
    composition,
    effectiveHeroSurface,
    currentOverlay: project.heroOverlay ?? composition.treatment.overlay,
  });
  const evaluation = evaluateBrandPresentation({
    identity,
    presentation,
    image,
    effectiveHeroSurface,
  });

  return {
    identity,
    presentation,
    evaluation,
    image,
    effectiveHeroSurface,
  };
}

/** CSS vars for Editor / Preview / Publish — identity tokens stay unchanged. */
export function brandPresentationCssVars(
  resolved: ResolvedBrandPresentation,
): BrandPresentationCssVars {
  const p = resolved.presentation;
  return {
    "--site-hero-headline": p.heroHeadlineColor,
    "--site-hero-eyebrow": p.heroEyebrowColor,
    "--site-hero-body": p.heroBodyColor,
    "--site-hero-cta-bg": p.heroPrimaryCTAStyle.background,
    "--site-hero-cta-fg": p.heroPrimaryCTAStyle.color,
    "--site-hero-cta-secondary-fg": p.heroSecondaryCTAStyle.color,
    "--site-hero-cta-secondary-border":
      p.heroSecondaryCTAStyle.border ?? "var(--site-border)",
    // Presentation may soften overlay without mutating stored palette/overlay.
    "--site-hero-overlay": String(p.heroOverlayStrength / 100),
    "--site-hero-scrim-opacity": String(
      p.heroScrim.enabled ? p.heroScrim.opacity : 0,
    ),
    "--site-hero-scrim-blur": `${p.heroScrim.blur}px`,
    "--site-hero-gradient-opacity": String(p.heroGradient?.strength ?? 0),
    "--site-hero-gradient-coverage": `${Math.round(
      (p.heroGradient?.coverage ?? 0) * 100,
    )}%`,
  };
}

export function logBrandPresentationDiagnostics(
  resolved: ResolvedBrandPresentation,
  requestId?: string | null,
): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas:brand-presentation]", {
    requestId: requestId ?? null,
    presentationScore: resolved.evaluation.presentationScore,
    brandIntegrityScore: 100,
    contrastImprovement: resolved.evaluation.headlineContrast,
    presentationDecision: resolved.presentation.decisions.presentationDecision,
    headlineColorDecision:
      resolved.presentation.decisions.headlineColorDecision,
    ctaDecision: resolved.presentation.decisions.ctaDecision,
    scrimDecision: resolved.presentation.decisions.scrimDecision,
    gradientDecision: resolved.presentation.decisions.gradientDecision,
  });
}
