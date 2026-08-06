/**
 * Compare site quality signals against a benchmark profile.
 * Never copies layouts, colors, wording, or branding.
 */

import type {
  BenchmarkComparison,
  BenchmarkDimensionId,
  BenchmarkDimensionMatch,
  BenchmarkProfile,
} from "@/lib/benchmarks/types";
import { BENCHMARK_LIBRARY_VERSION } from "@/lib/benchmarks/types";
import type { CreativeDirectorEvaluation } from "@/lib/creative-director/types";
import type { PageSectionInventory } from "@/lib/creative-director/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Derive benchmark-dimension site scores from Creative Director evaluation.
 * Presence of fields is not enough — uses scored quality signals.
 */
export function deriveSiteBenchmarkScores(input: {
  evaluation: CreativeDirectorEvaluation;
  inventory?: PageSectionInventory | null;
}): Record<BenchmarkDimensionId, number> {
  const { evaluation: ev, inventory: inv } = input;
  const d = ev.dimensions;
  const hero = ev.sections.find((s) => s.sectionId === "hero");
  const gallery = ev.sections.find((s) => s.sectionId === "gallery");

  // Presence of a hero image is not enough — composition + preservation matter.
  const heroQuality = clamp(
    avg([
      d.firstImpression,
      hero?.score ?? d.firstImpression,
      inv?.heroCompositionScore ?? d.firstImpression,
      inv?.visualCompositionScore ??
        inv?.heroImageImpact ??
        (inv?.hasHeroImage ? 72 : 48),
      inv?.photographyPreservation ??
        (inv?.hasHeroImage ? 70 : 40),
    ]),
  );

  const imagery = clamp(
    avg([
      gallery?.present ? gallery.score : inv?.gallerySlots ? 60 : 42,
      inv?.gallerySlots
        ? Math.min(95, 50 + inv.gallerySlots * 10)
        : 40,
      // Prefer how photography is used/preserved over mere presence.
      inv?.photographyPreservation ?? (inv?.hasHeroImage ? 62 : 40),
      inv?.visualCompositionScore ??
        inv?.heroImageImpact ??
        (inv?.hasHeroImage ? 68 : 40),
      inv?.hasHeroImage ? 70 : 42,
    ]),
  );

  const typography = clamp(
    avg([
      d.scanability,
      d.visualHierarchy,
      inv?.visualHierarchy ? 82 : 62,
      // Distinct heading/body is a craft signal, not a brand identity.
      inv && inv.headingFont !== inv.bodyFont ? 78 : 70,
    ]),
  );

  const polish = clamp(
    avg([
      d.professionalism,
      d.whitespace,
      ev.consistency.score,
      inv?.visualHierarchy ? 80 : 64,
    ]),
  );

  return {
    hero_quality: heroQuality,
    trust_progression: clamp(d.trust),
    visual_hierarchy: clamp(d.visualHierarchy),
    narrative_flow: clamp(d.narrativeFlow),
    section_rhythm: clamp(
      avg([d.visualRhythm, ev.rhythm.score, d.sectionBalance]),
    ),
    spacing_discipline: clamp(d.whitespace),
    typography,
    cta_confidence: clamp(
      avg([d.conversion, ev.conversion.ctaClarity, ev.conversion.score]),
    ),
    imagery_quality: imagery,
    polish,
    professionalism: clamp(d.professionalism),
  };
}

function matchPercentage(siteScore: number, target: number): number {
  if (target <= 0) return 100;
  // Meeting or exceeding the target is a full match for that dimension.
  if (siteScore >= target) return 100;
  return clamp((siteScore / target) * 100);
}

export function compareAgainstBenchmark(input: {
  profile: BenchmarkProfile;
  siteScores: Record<BenchmarkDimensionId, number>;
}): BenchmarkComparison {
  const { profile, siteScores } = input;
  const dimensionMatches: BenchmarkDimensionMatch[] = profile.dimensions.map(
    (dim) => {
      const siteScore = siteScores[dim.id] ?? 50;
      const match = matchPercentage(siteScore, dim.target);
      return {
        dimension: dim.id,
        siteScore,
        targetScore: dim.target,
        matchPercentage: match,
        gap: Math.max(0, dim.target - siteScore),
        characteristic: dim.characteristic,
      };
    },
  );

  const totalWeight = profile.dimensions.reduce((s, d) => s + d.weight, 0);
  const weightedMatch =
    totalWeight > 0
      ? profile.dimensions.reduce((sum, dim, i) => {
          const m = dimensionMatches[i]!;
          return sum + m.matchPercentage * dim.weight;
        }, 0) / totalWeight
      : 0;

  const sortedByGap = [...dimensionMatches].sort((a, b) => b.gap - a.gap);
  const sortedByMatch = [...dimensionMatches].sort(
    (a, b) => b.matchPercentage - a.matchPercentage,
  );
  const dimensionGaps = sortedByGap.filter((d) => d.gap >= 4);
  const highestGap = dimensionGaps[0] ?? sortedByGap[0] ?? null;
  const strongestMatch = sortedByMatch[0] ?? null;

  const recommendedFocus = highestGap
    ? recommendFocus(highestGap.dimension, profile)
    : "Maintain the current quality level — the site already tracks this benchmark closely.";

  const explanation = buildComparisonExplanation({
    profile,
    matchPercentage: clamp(weightedMatch),
    highestGap,
    strongestMatch,
  });

  return {
    version: BENCHMARK_LIBRARY_VERSION,
    benchmarkId: profile.id,
    benchmarkName: profile.name,
    matchPercentage: clamp(weightedMatch),
    dimensionMatches,
    dimensionGaps,
    highestGap,
    strongestMatch,
    recommendedFocus,
    explanation,
  };
}

function recommendFocus(
  dimension: BenchmarkDimensionId,
  profile: BenchmarkProfile,
): string {
  const map: Record<BenchmarkDimensionId, string> = {
    hero_quality:
      "Raise first-impression quality — clearer promise, stronger hero craft, and intentional composition.",
    trust_progression:
      "Strengthen trust progression so proof appears before the conversion ask.",
    visual_hierarchy:
      "Clarify visual hierarchy so one lead idea guides the eye through each section.",
    narrative_flow:
      "Tighten narrative flow from promise → proof → decision without stalled momentum.",
    section_rhythm:
      "Improve section rhythm with more intentional heavy/light pacing.",
    spacing_discipline:
      "Apply more disciplined spacing so the page feels finished rather than compressed.",
    typography:
      "Refine typography hierarchy for cleaner scanning and a more professional read.",
    cta_confidence:
      "Make the primary call-to-action more specific and easier to take at the right moment.",
    imagery_quality:
      "Raise imagery quality and proof photography so visuals earn the promise.",
    polish:
      "Increase overall polish — coordinated spacing, hierarchy, and detail.",
    professionalism:
      "Raise professionalism signals so the site reads as a premium operator.",
  };
  const base = map[dimension];
  // Keep focus quality-oriented; never suggest copying the benchmark’s appearance.
  return `${base} Aim for the “${profile.name}” quality bar — not its look.`;
}

function buildComparisonExplanation(input: {
  profile: BenchmarkProfile;
  matchPercentage: number;
  highestGap: BenchmarkDimensionMatch | null;
  strongestMatch: BenchmarkDimensionMatch | null;
}): string {
  const { profile, matchPercentage, highestGap, strongestMatch } = input;
  const strong = strongestMatch
    ? `Strongest alignment: ${labelDimension(strongestMatch.dimension)}.`
    : "";
  const gap = highestGap
    ? `Largest gap: ${labelDimension(highestGap.dimension)} (${highestGap.gap} points below the reference quality level).`
    : "No material quality gaps against this benchmark.";
  return [
    `Compared to the ${profile.name} quality benchmark, this site matches about ${matchPercentage}%.`,
    strong,
    gap,
    "This is a quality comparison only — layouts, colors, wording, and branding are not copied.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function labelDimension(id: BenchmarkDimensionId): string {
  const labels: Record<BenchmarkDimensionId, string> = {
    hero_quality: "hero quality",
    trust_progression: "trust progression",
    visual_hierarchy: "visual hierarchy",
    narrative_flow: "narrative flow",
    section_rhythm: "section rhythm",
    spacing_discipline: "spacing discipline",
    typography: "typography",
    cta_confidence: "CTA confidence",
    imagery_quality: "imagery quality",
    polish: "polish",
    professionalism: "professionalism",
  };
  return labels[id];
}

/** Map benchmark gaps → transformation / CD themes (priority only). */
export function benchmarkGapToThemes(
  dimension: BenchmarkDimensionId,
): Array<"trust" | "proof" | "conversion" | "flow" | "rhythm" | "hero" | "messaging" | "hierarchy" | "imagery"> {
  switch (dimension) {
    case "hero_quality":
      return ["hero", "hierarchy", "imagery"];
    case "trust_progression":
      return ["trust", "proof", "flow"];
    case "visual_hierarchy":
      return ["hierarchy", "hero"];
    case "narrative_flow":
      return ["flow", "messaging"];
    case "section_rhythm":
      return ["rhythm"];
    case "spacing_discipline":
      return ["rhythm"];
    case "typography":
      return ["hierarchy", "messaging"];
    case "cta_confidence":
      return ["conversion"];
    case "imagery_quality":
      return ["imagery", "proof"];
    case "polish":
      return ["rhythm", "hierarchy"];
    case "professionalism":
      return ["trust", "hierarchy"];
    default:
      return [];
  }
}
