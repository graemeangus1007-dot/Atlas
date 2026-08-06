/**
 * Verify adaptive presentation without brand identity drift.
 */

import { contrastRatio } from "@/lib/ai/contrast";
import { resolveAdaptiveBrandPresentation } from "@/lib/brand-presentation/resolver";
import type {
  BrandPresentationDiagnostics,
  BrandPresentationVerifyResult,
} from "@/lib/brand-presentation/types";
import { resolveHeroCompositionFromProject } from "@/lib/hero-composition";
import type { BusinessProject } from "@/types/business-project";

function identityEqual(a: BusinessProject, b: BusinessProject): boolean {
  return (
    a.primaryColor === b.primaryColor &&
    a.secondaryColor === b.secondaryColor &&
    a.accentColor === b.accentColor &&
    a.backgroundColor === b.backgroundColor &&
    a.headingFont === b.headingFont &&
    a.bodyFont === b.bodyFont &&
    a.theme === b.theme
  );
}

function baselineHeadlineContrast(project: BusinessProject): number {
  // Naive pre-adaptation: brand accent or fg on mid grey — used only for delta.
  const surface = "#6b7280";
  const ink = project.theme === "light" ? "#101828" : "#ffffff";
  return contrastRatio(ink, surface) ?? 1;
}

export function verifyBrandPresentation(input: {
  before: BusinessProject;
  after: BusinessProject;
}): BrandPresentationVerifyResult {
  const failures: string[] = [];

  if (!identityEqual(input.before, input.after)) {
    failures.push("brand_identity_changed");
  }

  if (input.before.heroImageId !== input.after.heroImageId) {
    failures.push("hero_image_changed");
  }

  const beforePattern =
    resolveHeroCompositionFromProject(input.before).patternId ?? null;
  const afterPattern =
    resolveHeroCompositionFromProject(input.after).patternId ?? null;
  if (beforePattern !== afterPattern) {
    failures.push("pattern_changed");
  }

  const resolved = resolveAdaptiveBrandPresentation(input.after);
  if (resolved.evaluation.presentationScore < 55) {
    failures.push(
      `presentation_score_too_low:${resolved.evaluation.presentationScore}`,
    );
  }
  if (resolved.evaluation.accessibility < 50) {
    failures.push("accessibility_regressed");
  }

  const brandIntegrityScore = identityEqual(input.before, input.after)
    ? 100
    : 0;
  const contrastImprovement = Math.max(
    0,
    resolved.evaluation.headlineContrast -
      Math.round((baselineHeadlineContrast(input.before) / 7) * 100),
  );

  const diagnostics: BrandPresentationDiagnostics = {
    presentationScore: resolved.evaluation.presentationScore,
    brandIntegrityScore,
    contrastImprovement,
    presentationDecision: resolved.presentation.decisions.presentationDecision,
    headlineColorDecision:
      resolved.presentation.decisions.headlineColorDecision,
    ctaDecision: resolved.presentation.decisions.ctaDecision,
    scrimDecision: resolved.presentation.decisions.scrimDecision,
    gradientDecision: resolved.presentation.decisions.gradientDecision,
  };

  return {
    verified: failures.length === 0,
    failures,
    diagnostics,
  };
}
