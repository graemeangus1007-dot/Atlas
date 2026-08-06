export {
  BENCHMARK_LIBRARY_VERSION,
  type BenchmarkComparison,
  type BenchmarkDimensionId,
  type BenchmarkDimensionMatch,
  type BenchmarkDimensionTarget,
  type BenchmarkProfile,
} from "@/lib/benchmarks/types";

export {
  getBenchmarkProfile,
  listBenchmarkProfiles,
  selectBenchmarkProfile,
} from "@/lib/benchmarks/registry";

export {
  compareAgainstBenchmark,
  deriveSiteBenchmarkScores,
  labelDimension,
  benchmarkGapToThemes,
} from "@/lib/benchmarks/comparison";

export { evaluateBenchmarkComparison } from "@/lib/benchmarks/evaluator";

export {
  explainBenchmarkComparison,
  formatBenchmarkComparisonReport,
  benchmarkAdvisoryLine,
  benchmarkTextExposesForbiddenCopy,
} from "@/lib/benchmarks/presentation";

export { SEED_BENCHMARK_PROFILES } from "@/lib/benchmarks/profiles/seed";
