/**
 * Benchmark evaluation orchestrator — advisory only.
 */

import {
  compareAgainstBenchmark,
  deriveSiteBenchmarkScores,
} from "@/lib/benchmarks/comparison";
import { selectBenchmarkProfile } from "@/lib/benchmarks/registry";
import type { BenchmarkComparison } from "@/lib/benchmarks/types";
import type {
  CreativeDirectorEvaluation,
  PageSectionInventory,
} from "@/lib/creative-director/types";

export function evaluateBenchmarkComparison(input: {
  evaluation: CreativeDirectorEvaluation;
  inventory?: PageSectionInventory | null;
  industry?: string | null;
  businessType?: string | null;
  businessDescription?: string | null;
  preferredBenchmarkId?: string | null;
}): BenchmarkComparison {
  const profile = selectBenchmarkProfile({
    industry: input.industry ?? input.inventory?.industry,
    businessType: input.businessType,
    businessDescription:
      input.businessDescription ?? input.inventory?.description,
    preferredBenchmarkId: input.preferredBenchmarkId,
  });

  const siteScores = deriveSiteBenchmarkScores({
    evaluation: input.evaluation,
    inventory: input.inventory,
  });

  return compareAgainstBenchmark({
    profile,
    siteScores,
  });
}
