/**
 * User-facing benchmark presentation — quality language only.
 * Never exposes brand imitation, layout copying, or internal IDs as instructions.
 */

import { labelDimension } from "@/lib/benchmarks/comparison";
import type { BenchmarkComparison } from "@/lib/benchmarks/types";

export function explainBenchmarkComparison(
  comparison: BenchmarkComparison,
): string {
  return comparison.explanation;
}

export function formatBenchmarkComparisonReport(
  comparison: BenchmarkComparison,
): string {
  const lines = [
    `Quality benchmark: ${comparison.benchmarkName}`,
    `Match: ${comparison.matchPercentage}%`,
    "",
    comparison.explanation,
  ];

  if (comparison.strongestMatch) {
    lines.push(
      "",
      `Strongest match: ${labelDimension(comparison.strongestMatch.dimension)} (${comparison.strongestMatch.matchPercentage}% of reference quality)`,
    );
  }

  if (comparison.highestGap && comparison.highestGap.gap >= 4) {
    lines.push(
      "",
      `Highest gap: ${labelDimension(comparison.highestGap.dimension)}`,
      comparison.highestGap.characteristic,
      "",
      `Recommended focus: ${comparison.recommendedFocus}`,
    );
  }

  return lines.join("\n");
}

/** Short advisory line for Creative Director summaries. */
export function benchmarkAdvisoryLine(
  comparison: BenchmarkComparison | null | undefined,
): string | null {
  if (!comparison) return null;
  if (comparison.matchPercentage >= 92) {
    return `Already near the ${comparison.benchmarkName} quality bar (${comparison.matchPercentage}% match).`;
  }
  if (comparison.highestGap && comparison.highestGap.gap >= 6) {
    return `Against the ${comparison.benchmarkName} quality bar (${comparison.matchPercentage}% match), prioritize ${labelDimension(comparison.highestGap.dimension)}.`;
  }
  return `Tracking at ${comparison.matchPercentage}% of the ${comparison.benchmarkName} quality bar.`;
}

export function benchmarkTextExposesForbiddenCopy(text: string): boolean {
  // Guardrails: presentation must not instruct copying a named competitor brand.
  return /\b(copy|clone|imitate|steal)\b.{0,40}\b(layout|brand|color|wording|logo)\b/i.test(
    text,
  );
}
