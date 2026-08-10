import type {
  BenchmarkDimensionId,
  BenchmarkDimensionTarget,
  BenchmarkProfile,
} from "@/lib/benchmarks/types";

const DEFAULT_WEIGHTS: Record<BenchmarkDimensionId, number> = {
  hero_quality: 1.2,
  trust_progression: 1.15,
  visual_hierarchy: 1.05,
  narrative_flow: 1.05,
  section_rhythm: 1,
  spacing_discipline: 1.1,
  typography: 1.05,
  cta_confidence: 1.05,
  imagery_quality: 1.1,
  polish: 1.1,
  professionalism: 1.15,
  taste: 1.15,
  restraint: 1.1,
};

const CHARACTERISTICS: Record<BenchmarkDimensionId, string> = {
  hero_quality:
    "A decisive first impression that carries the offer with clarity and visual confidence",
  trust_progression:
    "Evidence and credibility appear before the visitor is asked to convert",
  visual_hierarchy:
    "One clear lead element with supporting content that never competes for attention",
  narrative_flow:
    "A coherent beginning → proof → decision journey without stalled momentum",
  section_rhythm:
    "Balanced heavy/light pacing so the page feels intentional rather than stacked",
  spacing_discipline:
    "Consistent breathing room and restrained density across sections",
  typography:
    "Clean, readable type with clear hierarchy and professional restraint",
  cta_confidence:
    "Primary actions feel specific, calm, and easy to take at the right moment",
  imagery_quality:
    "Photography and visual proof support the promise instead of decorating it",
  polish:
    "Coordinated craft — spacing, hierarchy, and detail that read as finished work",
  professionalism:
    "An overall sense of competence visitors associate with a premium operator",
  taste:
    "Professional design taste — rhythm, hierarchy, balance, and finishing beyond mere correctness",
  restraint:
    "Fewer competing accents, effects, and signals so the page feels curated",
};

export function dimensionTargets(
  targets: Partial<Record<BenchmarkDimensionId, number>>,
  weightOverrides: Partial<Record<BenchmarkDimensionId, number>> = {},
): BenchmarkDimensionTarget[] {
  return (Object.keys(DEFAULT_WEIGHTS) as BenchmarkDimensionId[]).map((id) => ({
    id,
    target: targets[id] ?? 86,
    weight: weightOverrides[id] ?? DEFAULT_WEIGHTS[id],
    characteristic: CHARACTERISTICS[id],
  }));
}

export function profile(
  partial: Omit<BenchmarkProfile, "dimensions"> & {
    targets: Partial<Record<BenchmarkDimensionId, number>>;
    weightOverrides?: Partial<Record<BenchmarkDimensionId, number>>;
  },
): BenchmarkProfile {
  const { targets, weightOverrides, ...rest } = partial;
  return {
    ...rest,
    dimensions: dimensionTargets(targets, weightOverrides),
  };
}
