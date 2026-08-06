/**
 * Composition scoring — hierarchy, trust, conversion, brand, mobile, etc.
 */

import { scorePatternPairCompatibility } from "@/lib/ai/design-patterns/compatibility";
import { getDesignPatternById } from "@/lib/ai/design-patterns/registry";
import type {
  DesignPatternComposition,
  DesignPatternScoreDimensions,
  DesignPatternSelectionContext,
} from "@/lib/ai/design-patterns/types";

const DIMENSION_WEIGHTS: Record<keyof DesignPatternScoreDimensions, number> = {
  visualHierarchy: 0.14,
  trust: 0.12,
  readability: 0.1,
  conversion: 0.14,
  imageUse: 0.1,
  brandConsistency: 0.12,
  spacing: 0.08,
  balance: 0.08,
  originality: 0.06,
  mobileSuitability: 0.06,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function emptyScoreDimensions(): DesignPatternScoreDimensions {
  return {
    visualHierarchy: 0,
    trust: 0,
    readability: 0,
    conversion: 0,
    imageUse: 0,
    brandConsistency: 0,
    spacing: 0,
    balance: 0,
    originality: 0,
    mobileSuitability: 0,
  };
}

export function scoreCompositionDimensions(
  patternIds: string[],
  ctx: DesignPatternSelectionContext,
): DesignPatternScoreDimensions {
  const patterns = patternIds
    .map((id) => getDesignPatternById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  if (patterns.length === 0) return emptyScoreDimensions();

  const hero = patterns.find((p) => p.category === "hero");
  const trust = patterns.find((p) => p.category === "trust");
  const services = patterns.find((p) => p.category === "services");
  const gallery = patterns.find((p) => p.category === "gallery");
  const cta = patterns.find((p) => p.category === "cta");

  let pairSum = 0;
  let pairCount = 0;
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      pairSum += scorePatternPairCompatibility(patterns[i]!, patterns[j]!);
      pairCount += 1;
    }
  }
  const pairAvg = pairCount ? pairSum / pairCount : 0;

  const tones = ctx.agencyTones ?? [];
  const brandHits = patterns.reduce((acc, p) => {
    return (
      acc + p.brandAffinity.filter((t) => tones.includes(t)).length
    );
  }, 0);
  const brandConsistency = tones.length
    ? clamp01(brandHits / (patterns.length * 1.5))
    : 0.55;

  const visualHierarchy = clamp01(
    (hero?.visualWeight ?? 0.5) * 0.55 +
      (1 - (services?.visualWeight ?? 0.5) * 0.3) +
      (hero && cta && hero.visualWeight > cta.visualWeight ? 0.25 : 0.05),
  );

  const trustScore = clamp01(
    (trust?.conversionStrength ?? 0.3) * 0.7 +
      (ctx.hasTestimonials ? 0.2 : 0) +
      (trust ? 0.15 : 0),
  );

  const readability = clamp01(
    0.55 +
      (hero && /minimal|center|soft|local/.test(hero.id) ? 0.2 : 0) +
      (services && /icon_grid|stacked|spotlight/.test(services.id) ? 0.15 : 0.05) -
      (hero && /bold_statement|cinematic/.test(hero.id) ? 0.05 : 0),
  );

  const conversion = clamp01(
    ((cta?.conversionStrength ?? 0.4) +
      (hero?.conversionStrength ?? 0.4) +
      (trust?.conversionStrength ?? 0.3)) /
      3,
  );

  const imageUse = clamp01(
    ((ctx.hasHeroImage ? 0.35 : 0) +
      Math.min(0.35, (ctx.galleryFilledSlots ?? 0) * 0.08) +
      (gallery ? 0.25 : 0) +
      (hero && hero.requiredAssets.some((a) => a !== "none") ? 0.1 : 0)),
  );

  const spacing = clamp01(
    0.45 +
      (hero && /minimal|luxury|coastal|premium/.test(hero.id) ? 0.3 : 0.1) +
      (services && /premium_tiles|feature_strips/.test(services.id) ? 0.15 : 0.05),
  );

  const balance = clamp01(pairAvg * 0.75 + (patterns.length >= 4 ? 0.2 : 0.1));

  const originality = clamp01(
    0.35 +
      (hero && /asymmetric|editorial|mosaic|before_after/.test(hero.id) ? 0.25 : 0.1) +
      (gallery && /masonry|case_studies|mosaic/.test(gallery.id) ? 0.2 : 0.08),
  );

  const mobileSuitability = clamp01(
    0.5 +
      (services && /stacked|icon_grid|spotlight/.test(services.id) ? 0.2 : 0.05) +
      (cta && /call_now|schedule|request_quote/.test(cta.id) ? 0.15 : 0.05) +
      (gallery && /carousel|grid|lightbox/.test(gallery.id) ? 0.1 : 0.05),
  );

  return {
    visualHierarchy,
    trust: trustScore,
    readability,
    conversion,
    imageUse,
    brandConsistency,
    spacing,
    balance,
    originality,
    mobileSuitability,
  };
}

export function aggregateCompositionScore(
  dimensions: DesignPatternScoreDimensions,
): number {
  let total = 0;
  for (const key of Object.keys(DIMENSION_WEIGHTS) as Array<
    keyof DesignPatternScoreDimensions
  >) {
    total += dimensions[key] * DIMENSION_WEIGHTS[key];
  }
  return Math.round(clamp01(total) * 1000) / 1000;
}

export function scoreComposition(
  composition: Pick<DesignPatternComposition, "patternIds">,
  ctx: DesignPatternSelectionContext,
): { score: number; dimensions: DesignPatternScoreDimensions } {
  const dimensions = scoreCompositionDimensions(composition.patternIds, ctx);
  return {
    score: aggregateCompositionScore(dimensions),
    dimensions,
  };
}
