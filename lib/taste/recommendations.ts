/**
 * Taste recommendations — professional narrative, measurable dimensions.
 * Every recommendation declares owner + domain; out-of-lane advice is rejected.
 */

import { filterRecommendationsByScope } from "@/lib/scope";
import type { RecommendationDomain } from "@/lib/scope/types";
import { tasteDimensionLabel } from "@/lib/taste/registry";
import type {
  TasteDimensionId,
  TasteDimensionScore,
  TasteRecommendation,
  TasteSignals,
} from "@/lib/taste/types";
import type { BusinessProject } from "@/types/business-project";

function domainForImproves(
  improves: TasteDimensionId[],
): RecommendationDomain {
  if (improves.includes("spacingHarmony")) return "spacing";
  if (
    improves.includes("typographyHarmony") ||
    improves.includes("visualWeight") ||
    improves.includes("scanability")
  ) {
    return "typography_hierarchy";
  }
  if (improves.includes("visualRhythm") || improves.includes("proportion")) {
    return "rhythm";
  }
  if (improves.includes("restraint")) return "restraint";
  if (improves.includes("ctaPresence")) return "cta_proportion";
  if (improves.includes("componentConsistency")) return "button_consistency";
  if (improves.includes("alignmentQuality")) return "alignment";
  return "visual_polish";
}

export function buildTasteRecommendations(input: {
  dimensions: TasteDimensionScore[];
  highestPriorityImprovement: TasteDimensionId | null;
  signals: TasteSignals;
}): TasteRecommendation[] {
  const byId = Object.fromEntries(
    input.dimensions.map((d) => [d.id, d]),
  ) as Record<TasteDimensionId, TasteDimensionScore>;
  const recs: TasteRecommendation[] = [];

  const typography = byId.typographyHarmony;
  const weight = byId.visualWeight;
  const restraint = byId.restraint;
  const spacing = byId.spacingHarmony;
  const rhythm = byId.visualRhythm;
  const cta = byId.ctaPresence;
  const craft = byId.craftsmanship;

  if (typography && typography.score < 75) {
    const improves: TasteDimensionId[] = [
      "typographyHarmony",
      "visualWeight",
      "ctaPresence",
      "scanability",
    ];
    recs.push({
      owner: "taste",
      domain: domainForImproves(improves),
      title: "Strengthen headline dominance",
      explanation:
        "The hero heading, CTA, and supporting copy compete equally for attention. Increasing the headline's dominance while simplifying the CTA cluster would create a stronger first impression.",
      improves,
      priority: typography.score < 60 ? "high" : "medium",
      estimatedImpact: Math.min(28, 12 + Math.round((75 - typography.score) * 0.5)),
      theme: "hierarchy",
    });
  }

  if (weight && weight.score < 72 && input.signals.hasSecondaryCta) {
    const improves: TasteDimensionId[] = [
      "visualWeight",
      "ctaPresence",
      "restraint",
    ];
    recs.push({
      owner: "taste",
      domain: domainForImproves(improves),
      title: "Quiet the competing hero cluster",
      explanation:
        "Secondary actions and supporting copy currently pull as hard as the primary promise. Softening the secondary cluster would restore a single visual lead.",
      improves,
      priority: "high",
      estimatedImpact: 16,
      theme: "hierarchy",
    });
  }

  if (spacing && spacing.score < 74) {
    const improves: TasteDimensionId[] = [
      "spacingHarmony",
      "visualRhythm",
      "polish",
      "scanability",
    ];
    recs.push({
      owner: "taste",
      domain: "spacing",
      title: "Open the spacing scale",
      explanation:
        "Sections sit closer than a finished page usually allows. Moving to a more comfortable spacing scale would improve breathing room without changing the structure.",
      improves,
      priority: spacing.score < 58 ? "high" : "medium",
      estimatedImpact: 14,
      theme: "rhythm",
    });
  }

  if (rhythm && rhythm.score < 72) {
    const improves: TasteDimensionId[] = [
      "visualRhythm",
      "proportion",
      "scanability",
    ];
    recs.push({
      owner: "taste",
      domain: "rhythm",
      title: "Vary section pacing",
      explanation:
        "Heavy blocks stack without lighter interludes. Alternating visual density would make the vertical journey feel intentional rather than relentless.",
      improves,
      priority: "medium",
      estimatedImpact: 12,
      theme: "rhythm",
    });
  }

  if (restraint && restraint.score < 70) {
    const improves: TasteDimensionId[] = [
      "restraint",
      "craftsmanship",
      "polish",
    ];
    recs.push({
      owner: "taste",
      domain: "restraint",
      title: "Reduce competing effects",
      explanation:
        "Accents and treatments are stacking. Removing one or two effects would make the remaining craft feel more premium.",
      improves,
      priority: restraint.score < 55 ? "high" : "medium",
      estimatedImpact: 18,
      theme: "messaging",
    });
  }

  if (craft && craft.score < 70 && input.signals.heroOverlay >= 60) {
    const improves: TasteDimensionId[] = [
      "craftsmanship",
      "visualWeight",
      "polish",
    ];
    recs.push({
      owner: "taste",
      domain: "restraint",
      title: "Replace broad washes with local contrast",
      explanation:
        "A full-frame wash is doing readability work. Localized contrast behind the copy would preserve photography and read as higher craft.",
      improves,
      priority: "medium",
      estimatedImpact: 14,
      theme: "hierarchy",
    });
  }

  if (cta && cta.score < 68) {
    const improves: TasteDimensionId[] = [
      "ctaPresence",
      "visualWeight",
      "scanability",
    ];
    recs.push({
      owner: "taste",
      domain: "cta_proportion",
      title: "Clarify the primary action",
      explanation:
        "The primary call-to-action does not yet own a clear visual role. A shorter, more specific CTA with quieter supporting actions would improve visual proportion.",
      improves,
      priority: "medium",
      estimatedImpact: 12,
      theme: "hierarchy",
    });
  }

  // Ensure highest-priority dimension has at least one recommendation.
  const top = input.highestPriorityImprovement;
  if (top && !recs.some((r) => r.improves.includes(top))) {
    const improves: TasteDimensionId[] = [top, "polish"];
    recs.unshift({
      owner: "taste",
      domain: domainForImproves(improves),
      title: `Improve ${tasteDimensionLabel(top).toLowerCase()}`,
      explanation: byId[top]?.explanation
        ? `${byId[top].explanation} Addressing this first would raise overall professional taste without redesigning the site.`
        : `Raising ${tasteDimensionLabel(top).toLowerCase()} would improve how finished the site feels.`,
      improves,
      priority: "high",
      estimatedImpact: 12,
      theme:
        top === "ctaPresence" ||
        top === "typographyHarmony" ||
        top === "visualWeight"
          ? "hierarchy"
          : "rhythm",
    });
  }

  const scoped = filterRecommendationsByScope(recs);
  return (scoped.allowed as TasteRecommendation[])
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority] || b.estimatedImpact - a.estimatedImpact;
    })
    .slice(0, 5);
}

/**
 * Apply a deterministic taste refinement for verification tests.
 * Hero-local / polish-only — never copies benchmarks or redesigns structure.
 */
export function applyTasteRefinement(
  project: BusinessProject,
  recommendation?: TasteRecommendation | null,
): BusinessProject {
  const improves = new Set(recommendation?.improves ?? []);
  const next: BusinessProject = {
    ...project,
    creativePolish: {
      spacing: project.creativePolish?.spacing ?? "default",
      visualHierarchy: project.creativePolish?.visualHierarchy ?? false,
      serviceIcons: project.creativePolish?.serviceIcons ?? false,
      motion: project.creativePolish?.motion ?? false,
      ...(project.creativePolish ?? {}),
    },
  };

  const polish = { ...next.creativePolish! };

  if (
    improves.has("spacingHarmony") ||
    improves.has("visualRhythm") ||
    improves.has("polish") ||
    !recommendation
  ) {
    polish.spacing =
      polish.spacing === "airy"
        ? "airy"
        : polish.spacing === "comfortable"
          ? "airy"
          : "comfortable";
  }

  if (
    improves.has("typographyHarmony") ||
    improves.has("visualWeight") ||
    improves.has("scanability") ||
    improves.has("ctaPresence") ||
    !recommendation
  ) {
    polish.visualHierarchy = true;
  }

  if (improves.has("restraint") || improves.has("craftsmanship")) {
    polish.motion = false;
    polish.hoverEffects = false;
    polish.sectionReveal = false;
    polish.motionPreset = "none";
    if ((next.heroOverlay ?? 50) > 40) {
      next.heroOverlay = 35;
    }
    if (next.heroTreatment?.textScrim?.blur) {
      next.heroTreatment = {
        ...next.heroTreatment,
        textScrim: {
          ...next.heroTreatment.textScrim,
          blur: 0,
        },
      };
    }
  }

  if (improves.has("craftsmanship") && (next.heroOverlay ?? 50) >= 55) {
    next.heroOverlay = 35;
  }

  // Distinct type pairing when typography is the focus
  if (
    (improves.has("typographyHarmony") || !recommendation) &&
    next.headingFont === next.bodyFont
  ) {
    next.headingFont =
      next.headingFont === "inter" ? "playfair" : next.headingFont;
  }

  if (
    (improves.has("ctaPresence") || improves.has("visualWeight")) &&
    (next.primaryCta?.length ?? 0) > 28
  ) {
    next.primaryCta = "Get a quote";
  }

  if (improves.has("visualWeight") && next.secondaryCta) {
    next.secondaryCta = undefined;
  }

  next.creativePolish = polish;
  return next;
}

/** Verify a refinement improved overall taste or resolved the top weakness. */
export function verifyTasteImprovement(input: {
  before: import("@/lib/taste/types").TasteEvaluation;
  after: import("@/lib/taste/types").TasteEvaluation;
}): { ok: boolean; reason: string } {
  const { before, after } = input;
  if (after.overallTaste > before.overallTaste) {
    return { ok: true, reason: "overallTaste_improved" };
  }
  const dim = before.highestPriorityImprovement;
  if (
    dim &&
    after[dim] > before[dim] &&
    (after.highestPriorityImprovement !== dim || after[dim] >= 78)
  ) {
    return { ok: true, reason: "highestPriorityImprovement_resolved" };
  }
  if (dim && after[dim] > before[dim] + 2) {
    return { ok: true, reason: "priority_dimension_improved" };
  }
  return { ok: false, reason: "no_measurable_taste_gain" };
}
