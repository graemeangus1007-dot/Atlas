/**
 * Benchmark Library — advisory quality comparison (not templates).
 */

import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { evaluateWebsiteAsCreativeDirector } from "@/lib/creative-director";
import {
  BENCHMARK_LIBRARY_VERSION,
  benchmarkGapToThemes,
  benchmarkTextExposesForbiddenCopy,
  compareAgainstBenchmark,
  deriveSiteBenchmarkScores,
  evaluateBenchmarkComparison,
  formatBenchmarkComparisonReport,
  getBenchmarkProfile,
  listBenchmarkProfiles,
  selectBenchmarkProfile,
  SEED_BENCHMARK_PROFILES,
} from "@/lib/benchmarks";
import { prioritizeTransformationGoals } from "@/lib/transformation/prioritizer";
import type { TransformationGoal } from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string, title: string): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
  };
}

describe("Benchmark Library registry", () => {
  it("seeds the six required benchmark profiles", () => {
    const profiles = listBenchmarkProfiles();
    expect(profiles).toHaveLength(6);
    expect(profiles.map((p) => p.id)).toEqual([
      "premium_modern_service",
      "premium_landscaping",
      "luxury_home_builder",
      "modern_law_firm",
      "modern_dental",
      "high_end_restaurant",
    ]);
    expect(getBenchmarkProfile("premium_modern_service")?.name).toBe(
      "Premium Modern Service Business",
    );
  });

  it("selects landscaping benchmark for contractor/landscaping businesses", () => {
    const selected = selectBenchmarkProfile({
      industry: "Landscaping",
      businessType: "Contractor",
    });
    expect(selected.id).toBe("premium_landscaping");
  });

  it("selects law firm benchmark for legal businesses", () => {
    expect(
      selectBenchmarkProfile({ industry: "Law Firm", businessType: "Legal" })
        .id,
    ).toBe("modern_law_firm");
  });

  it("defaults to premium modern service when affinity is unclear", () => {
    expect(selectBenchmarkProfile({ industry: "Widget Corp" }).id).toBe(
      "premium_modern_service",
    );
  });

  it("encodes quality characteristics, not layouts or branding", () => {
    for (const profile of SEED_BENCHMARK_PROFILES) {
      const blob = JSON.stringify(profile).toLowerCase();
      expect(blob).not.toMatch(/grid-cols|flex-row|#([0-9a-f]{6})/);
      expect(blob).not.toMatch(/lorem ipsum|copy this headline/);
      expect(profile.qualities.length).toBeGreaterThan(0);
      expect(profile.dimensions.length).toBe(13);
    }
    // First profile captures the required quality set
    const premium = getBenchmarkProfile("premium_modern_service")!;
    expect(premium.qualities.join(" ")).toMatch(/first impression/i);
    expect(premium.qualities.join(" ")).toMatch(/spacing/i);
    expect(premium.qualities.join(" ")).toMatch(/trust/i);
    expect(premium.qualities.join(" ")).toMatch(/cta/i);
  });
});

describe("Benchmark comparison", () => {
  it("returns BenchmarkComparison with required fields", () => {
    const project: BusinessProject = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Harborview Landscaping",
      businessType: "Contractor",
      description: "Coastal landscaping and outdoor design.",
      heroHeadline: "Outdoor spaces that feel finished",
      heroSubheadline: "Design, build, and care for yards.",
      primaryCta: "Get a quote",
      heroImageId: "hero-1",
      mediaLibrary: [asset("hero-1", "Yard")],
      galleryImageIds: [],
      designSections: { enabled: [] },
      sectionOrder: ["hero", "about", "services", "contact"],
    };
    const evaluation = evaluateWebsiteAsCreativeDirector({ project });
    expect(evaluation.benchmarkComparison).toBeTruthy();
    const cmp = evaluation.benchmarkComparison!;
    expect(cmp.version).toBe(BENCHMARK_LIBRARY_VERSION);
    expect(cmp.benchmarkId).toBe("premium_landscaping");
    expect(typeof cmp.matchPercentage).toBe("number");
    expect(cmp.dimensionMatches.length).toBe(13);
    expect(cmp.highestGap).toBeTruthy();
    expect(cmp.strongestMatch).toBeTruthy();
    expect(cmp.recommendedFocus.length).toBeGreaterThan(10);
    expect(cmp.explanation).toMatch(/quality/i);
    expect(cmp.explanation).not.toMatch(/copy.*(layout|brand|color)/i);
  });

  it("does not instruct copying layouts or brands in presentation", () => {
    const profile = getBenchmarkProfile("premium_modern_service")!;
    const siteScores = Object.fromEntries(
      profile.dimensions.map((d) => [d.id, 60]),
    ) as ReturnType<typeof deriveSiteBenchmarkScores>;
    const cmp = compareAgainstBenchmark({ profile, siteScores });
    const report = formatBenchmarkComparisonReport(cmp);
    expect(benchmarkTextExposesForbiddenCopy(report)).toBe(false);
    expect(report).toMatch(/Premium Modern Service Business/);
    expect(report).toMatch(/Recommended focus/i);
  });

  it("maps gaps to planner themes without layout copying", () => {
    expect(benchmarkGapToThemes("trust_progression")).toEqual(
      expect.arrayContaining(["trust", "proof"]),
    );
    expect(benchmarkGapToThemes("hero_quality")).toEqual(
      expect.arrayContaining(["hero"]),
    );
  });
});

describe("Creative Director + planner integration", () => {
  it("exposes benchmark comparison on Creative Director evaluation", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      project: {
        ...MOCK_BUSINESS_PROJECT,
        businessType: "Dental",
        businessName: "Bright Dental",
        description: "A modern dental practice for families and cosmetic care.",
      },
    });
    expect(evaluation.benchmarkComparison?.benchmarkId).toBe("modern_dental");
  });

  it("prioritizer boosts goals that close the highest benchmark gap", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      project: {
        ...MOCK_BUSINESS_PROJECT,
        businessType: "Landscaping",
        designSections: { enabled: [] },
        galleryImageIds: [],
        sectionOrder: ["hero", "services", "contact"],
      },
    });
    expect(evaluation.benchmarkComparison?.highestGap).toBeTruthy();

    const goals: TransformationGoal[] = [
      {
        id: "strengthen_proof",
        objective: "Strengthen proof",
        reason: "proof",
        priority: "medium",
        phase: "proof",
        dependencies: [],
        affectedSections: ["gallery"],
        expectedImprovement: 10,
        verificationCriteria: [],
        visitorImpact: 70,
        visualImpact: 70,
        risk: "low",
        effort: "medium",
        requiredAssets: [],
        theme: "proof",
      },
      {
        id: "improve_rhythm",
        objective: "Improve rhythm",
        reason: "rhythm",
        priority: "medium",
        phase: "polish",
        dependencies: [],
        affectedSections: ["about"],
        expectedImprovement: 6,
        verificationCriteria: [],
        visitorImpact: 40,
        visualImpact: 50,
        risk: "low",
        effort: "low",
        requiredAssets: [],
        theme: "rhythm",
      },
    ];

    const ordered = prioritizeTransformationGoals(goals, evaluation);
    const gapThemes = benchmarkGapToThemes(
      evaluation.benchmarkComparison!.highestGap!.dimension,
    );
    if (gapThemes.includes("proof") || gapThemes.includes("imagery")) {
      expect(ordered[0]!.id).toBe("strengthen_proof");
    } else {
      // Still a stable sort — both goals remain present
      expect(ordered.map((g) => g.id).sort()).toEqual([
        "improve_rhythm",
        "strengthen_proof",
      ]);
    }
  });

  it("evaluateBenchmarkComparison is available as a standalone advisory API", () => {
    const evaluation = evaluateWebsiteAsCreativeDirector({
      project: MOCK_BUSINESS_PROJECT,
    });
    const cmp = evaluateBenchmarkComparison({
      evaluation,
      industry: "Restaurant",
    });
    expect(cmp.benchmarkId).toBe("high_end_restaurant");
    expect(cmp.matchPercentage).toBeGreaterThanOrEqual(0);
    expect(cmp.matchPercentage).toBeLessThanOrEqual(100);
  });
});
