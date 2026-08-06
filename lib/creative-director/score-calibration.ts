/**
 * Deterministic quality bands and score caps for unresolved major weaknesses.
 * Caps require evidence — they never arbitrarily lower every site.
 */

import type {
  FlowEvaluation,
  PageSectionInventory,
  WebsiteDimensionScores,
} from "@/lib/creative-director/types";

export type DesignQualityBand =
  | "poor"
  | "developing"
  | "solid"
  | "strong"
  | "exceptional";

export const DESIGN_QUALITY_BANDS: Array<{
  band: DesignQualityBand;
  min: number;
  max: number;
  label: string;
}> = [
  { band: "poor", min: 0, max: 49, label: "Poor" },
  { band: "developing", min: 50, max: 64, label: "Developing" },
  { band: "solid", min: 65, max: 79, label: "Solid" },
  { band: "strong", min: 80, max: 89, label: "Strong" },
  { band: "exceptional", min: 90, max: 100, label: "Exceptional" },
];

export type MajorWeaknessKind =
  | "major_hero_composition_defect"
  | "weak_proof_before_conversion"
  | "critical_missing_imagery"
  | "broken_section_flow"
  | "placeholder_or_generic_filler"
  | "weak_brand_contrast"
  | "weak_mobile_hero";

export type MajorWeakness = {
  kind: MajorWeaknessKind;
  severity: "critical" | "major" | "moderate";
  explanation: string;
  /** Hard ceiling for overallDesignScore when this weakness is active. */
  overallCap: number;
  dimensionCaps: Partial<WebsiteDimensionScores>;
};

export function classifyDesignQualityBand(score: number): DesignQualityBand {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 90) return "exceptional";
  if (s >= 80) return "strong";
  if (s >= 65) return "solid";
  if (s >= 50) return "developing";
  return "poor";
}

export function designQualityBandLabel(score: number): string {
  const band = classifyDesignQualityBand(score);
  return DESIGN_QUALITY_BANDS.find((b) => b.band === band)!.label;
}

function isImageLedBusiness(industry: string): boolean {
  return /contractor|landscap|roof|plumb|electric|builder|gym|restaurant|salon|real\s*estate|photo/i.test(
    industry,
  );
}

function looksPlaceholder(text: string): boolean {
  return (
    /lorem ipsum|your (business|headline|tagline)|placeholder|sample text|coming soon/i.test(
      text,
    ) || text.trim().length < 8
  );
}

/**
 * Detect major unresolved weaknesses from render-aware inventory + flow.
 */
export function detectMajorWeaknesses(input: {
  inventory: PageSectionInventory;
  flow: FlowEvaluation;
}): MajorWeakness[] {
  const inv = input.inventory;
  const weaknesses: MajorWeakness[] = [];

  if (inv.heroMajorDefect || (inv.heroCompositionScore != null && inv.heroCompositionScore < 68)) {
    weaknesses.push({
      kind: "major_hero_composition_defect",
      severity: inv.heroCompositionScore != null && inv.heroCompositionScore < 55
        ? "critical"
        : "major",
      explanation:
        inv.heroProblems[0] ||
        "The hero composition has a major visual defect that blocks an exceptional first impression.",
      overallCap: inv.heroCompositionScore != null && inv.heroCompositionScore < 55 ? 79 : 84,
      dimensionCaps: {
        firstImpression: inv.heroCompositionScore != null && inv.heroCompositionScore < 55 ? 72 : 78,
        professionalism: 82,
        mobileExperience: inv.heroMobileWeak ? 74 : 85,
      },
    });
  }

  const missingProof =
    inv.testimonialCount === 0 &&
    (inv.gallerySlots < 3 || !inv.proofBeforeAsk);
  const askBeforeTrust = input.flow.issues.some(
    (i) =>
      (i.kind === "ask_before_trust" || i.kind === "contact_before_proof") &&
      i.severity === "high",
  );
  if (missingProof || askBeforeTrust || !inv.proofBeforeAsk) {
    if (inv.testimonialCount === 0 || askBeforeTrust || !inv.proofBeforeAsk) {
      weaknesses.push({
        kind: "weak_proof_before_conversion",
        severity: inv.testimonialCount === 0 ? "major" : "moderate",
        explanation:
          inv.testimonialCount === 0
            ? "Visitors are asked to convert before enough proof of completed work."
            : "Proof exists but is weakly positioned before the conversion ask.",
        overallCap: inv.testimonialCount === 0 ? 84 : 88,
        dimensionCaps: {
          trust: inv.testimonialCount === 0 ? 68 : 78,
          narrativeFlow: 78,
          conversion: 82,
          professionalism: 84,
        },
      });
    }
  }

  if (
    isImageLedBusiness(inv.industry) &&
    (!inv.hasHeroImage || inv.gallerySlots === 0)
  ) {
    weaknesses.push({
      kind: "critical_missing_imagery",
      severity: !inv.hasHeroImage ? "critical" : "major",
      explanation: !inv.hasHeroImage
        ? "An image-led business is missing a hero photograph."
        : "Project proof imagery is missing for an image-led offer.",
      overallCap: !inv.hasHeroImage ? 74 : 82,
      dimensionCaps: {
        firstImpression: !inv.hasHeroImage ? 62 : 78,
        professionalism: 76,
        trust: 70,
      },
    });
  }

  const highFlowIssues = input.flow.issues.filter((i) => i.severity === "high");
  if (highFlowIssues.length >= 2 || input.flow.score < 55) {
    weaknesses.push({
      kind: "broken_section_flow",
      severity: "major",
      explanation:
        highFlowIssues[0]?.explanation ||
        "Section order breaks the visitor journey before trust is earned.",
      overallCap: 84,
      dimensionCaps: {
        narrativeFlow: 72,
        informationArchitecture: 74,
      },
    });
  }

  const filler = [
    inv.heroHeadline,
    inv.heroSubheadline,
    inv.description.slice(0, 200),
  ].filter(looksPlaceholder);
  if (filler.length > 0) {
    weaknesses.push({
      kind: "placeholder_or_generic_filler",
      severity: "major",
      explanation: "Visible placeholder or generic filler undermines professionalism.",
      overallCap: 78,
      dimensionCaps: {
        professionalism: 68,
        firstImpression: 72,
      },
    });
  }

  if (inv.brandContrastWeak) {
    weaknesses.push({
      kind: "weak_brand_contrast",
      severity: "moderate",
      explanation: "Hero text contrast is weak against the image surface.",
      overallCap: 88,
      dimensionCaps: {
        accessibility: 72,
        firstImpression: 80,
      },
    });
  }

  if (inv.heroMobileWeak) {
    weaknesses.push({
      kind: "weak_mobile_hero",
      severity: "moderate",
      explanation: "Hero mobile composition is below a strong/exceptional bar.",
      overallCap: 88,
      dimensionCaps: {
        mobileExperience: 74,
      },
    });
  }

  return weaknesses;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Apply deterministic caps. Returns capped dimensions + active cap reasons.
 */
export function applyScoreCaps(
  dimensions: WebsiteDimensionScores,
  weaknesses: MajorWeakness[],
): {
  dimensions: WebsiteDimensionScores;
  appliedCaps: string[];
  qualityBand: DesignQualityBand;
} {
  const next = { ...dimensions };
  const appliedCaps: string[] = [];
  let overallCap = 100;

  for (const w of weaknesses) {
    overallCap = Math.min(overallCap, w.overallCap);
    for (const [key, cap] of Object.entries(w.dimensionCaps) as Array<
      [keyof WebsiteDimensionScores, number]
    >) {
      if (typeof cap !== "number") continue;
      if (next[key] > cap) {
        next[key] = cap;
        appliedCaps.push(`${String(key)} capped at ${cap} (${w.kind})`);
      }
    }
    appliedCaps.push(`overall capped at ${w.overallCap} (${w.kind})`);
  }

  if (next.overallDesignScore > overallCap) {
    next.overallDesignScore = overallCap;
  }

  // Exceptional band requires no major/critical weakness
  const blocksExceptional = weaknesses.some(
    (w) => w.severity === "critical" || w.severity === "major",
  );
  if (blocksExceptional && next.overallDesignScore >= 90) {
    next.overallDesignScore = Math.min(next.overallDesignScore, 89);
    appliedCaps.push("exceptional band blocked by unresolved major weakness");
  }

  // Re-clamp
  for (const key of Object.keys(next) as Array<keyof WebsiteDimensionScores>) {
    next[key] = clamp(next[key]);
  }

  return {
    dimensions: next,
    appliedCaps: [...new Set(appliedCaps)],
    qualityBand: classifyDesignQualityBand(next.overallDesignScore),
  };
}
