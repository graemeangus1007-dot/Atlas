/**
 * Benchmark Library — advisory quality references (not templates).
 * Benchmarks define design quality characteristics, never appearance, copy, or branding.
 */

export const BENCHMARK_LIBRARY_VERSION = "1.0.0";

/** Quality dimensions used for benchmark comparison. */
export type BenchmarkDimensionId =
  | "hero_quality"
  | "trust_progression"
  | "visual_hierarchy"
  | "narrative_flow"
  | "section_rhythm"
  | "spacing_discipline"
  | "typography"
  | "cta_confidence"
  | "imagery_quality"
  | "polish"
  | "professionalism";

export type BenchmarkDimensionTarget = {
  id: BenchmarkDimensionId;
  /** Reference quality level 0–100 (not a layout score). */
  target: number;
  /** Relative importance within this benchmark profile. */
  weight: number;
  /** Quality characteristic description — never a layout or brand instruction. */
  characteristic: string;
};

export type BenchmarkProfile = {
  id: string;
  name: string;
  /** Short advisory label for planners / CD. */
  summary: string;
  /** Industry / business-type affinity keywords (matching only). */
  industryAffinity: string[];
  /** Quality characteristics this benchmark stands for. */
  qualities: string[];
  dimensions: BenchmarkDimensionTarget[];
};

export type BenchmarkDimensionMatch = {
  dimension: BenchmarkDimensionId;
  siteScore: number;
  targetScore: number;
  /** How close the site is to the target (0–100). */
  matchPercentage: number;
  gap: number;
  characteristic: string;
};

export type BenchmarkComparison = {
  version: string;
  benchmarkId: string;
  benchmarkName: string;
  matchPercentage: number;
  dimensionMatches: BenchmarkDimensionMatch[];
  dimensionGaps: BenchmarkDimensionMatch[];
  highestGap: BenchmarkDimensionMatch | null;
  strongestMatch: BenchmarkDimensionMatch | null;
  recommendedFocus: string;
  /** Advisory explanation — quality language only. */
  explanation: string;
};
