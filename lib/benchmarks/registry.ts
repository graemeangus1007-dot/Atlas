/**
 * Benchmark registry — lookup and industry affinity selection.
 */

import { SEED_BENCHMARK_PROFILES } from "@/lib/benchmarks/profiles/seed";
import type { BenchmarkProfile } from "@/lib/benchmarks/types";

const byId = new Map(
  SEED_BENCHMARK_PROFILES.map((p) => [p.id, p] as const),
);

export function listBenchmarkProfiles(): BenchmarkProfile[] {
  return [...SEED_BENCHMARK_PROFILES];
}

export function getBenchmarkProfile(
  id: string,
): BenchmarkProfile | null {
  return byId.get(id) ?? null;
}

function affinityScore(profile: BenchmarkProfile, haystack: string): {
  score: number;
  bestKeywordLength: number;
} {
  let score = 0;
  let bestKeywordLength = 0;
  for (const keyword of profile.industryAffinity) {
    const key = keyword.toLowerCase();
    if (!haystack.includes(key)) continue;
    // Prefer specific industry terms over generic ones like "service"
    const weight =
      key === "service" || key === "studio" || key === "firm"
        ? 1
        : key.length >= 8
          ? 5
          : key.length >= 5
            ? 3
            : 2;
    score += weight;
    bestKeywordLength = Math.max(bestKeywordLength, key.length);
  }
  return { score, bestKeywordLength };
}

/**
 * Select the best benchmark for an industry / business type.
 * Falls back to Premium Modern Service Business when affinity is unclear.
 */
export function selectBenchmarkProfile(input: {
  industry?: string | null;
  businessType?: string | null;
  businessDescription?: string | null;
  preferredBenchmarkId?: string | null;
}): BenchmarkProfile {
  if (input.preferredBenchmarkId) {
    const preferred = getBenchmarkProfile(input.preferredBenchmarkId);
    if (preferred) return preferred;
  }

  const haystack = [
    input.industry,
    input.businessType,
    input.businessDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) {
    return SEED_BENCHMARK_PROFILES[0]!;
  }

  let best = SEED_BENCHMARK_PROFILES[0]!;
  let bestScore = -1;
  let bestLen = 0;
  for (const profile of SEED_BENCHMARK_PROFILES) {
    const { score, bestKeywordLength } = affinityScore(profile, haystack);
    if (
      score > bestScore ||
      (score === bestScore && bestKeywordLength > bestLen)
    ) {
      best = profile;
      bestScore = score;
      bestLen = bestKeywordLength;
    }
  }

  // Weak affinity → default premium modern service quality bar
  if (bestScore <= 0) {
    return SEED_BENCHMARK_PROFILES[0]!;
  }
  return best;
}
