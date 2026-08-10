/**
 * Conflict detection between specialist recommendations.
 * Resolutions favor dependency order and leadership rules — never overwrite domains.
 */

import type {
  StrategicConflict,
  StrategicGatheredInputs,
  StrategicOpportunity,
} from "@/lib/strategy/types";

/**
 * Detect known cross-director conflicts from gathered specialist outputs.
 */
export function detectStrategicConflicts(input: {
  gathered: StrategicGatheredInputs;
  opportunities: StrategicOpportunity[];
}): StrategicConflict[] {
  const conflicts: StrategicConflict[] = [];
  const { gathered, opportunities } = input;
  const has = (id: string) => opportunities.some((o) => o.id === id);

  const cd = gathered.creativeDirector;
  const taste = gathered.taste;
  const conversion = gathered.conversionDirector;
  const visual = gathered.visualComposition;

  // Creative vs Taste — taller/impactful hero vs restrained shorter treatment.
  const cdWantsHeroImpact =
    (cd.dimensions.firstImpression ?? 100) < 72 ||
    (cd.narrative?.score ?? 100) < 70 ||
    cd.recommendations.some((r) =>
      /\b(taller|hero\s+height|more\s+dramatic|larger\s+hero)\b/i.test(
        `${r.title} ${r.creativeDirectorExplanation ?? ""}`,
      ),
    );
  const tasteWantsRestraint =
    Boolean(taste) &&
    ((taste!.restraint ?? 100) < 70 ||
      (taste!.spacingHarmony ?? 100) < 72 ||
      taste!.recommendations.some((r) =>
        /\b(shorter|restraint|quieter|reduce\s+competing)\b/i.test(
          `${r.title} ${r.explanation}`,
        ),
      ));

  if (cdWantsHeroImpact && tasteWantsRestraint && has("hero_composition")) {
    conflicts.push({
      ownerA: "creative_director",
      ownerB: "taste",
      reason:
        "Creative Director is pushing for stronger hero impact while Taste wants a quieter, more restrained treatment.",
      recommendedResolution:
        "Let Visual Composition set hero image height and copy placement first; Taste polish waits until composition and readability are sound.",
    });
  }

  // Conversion vs Taste — proof/CTA urgency vs spacing polish.
  const conversionNeedsProof =
    Boolean(conversion) &&
    ((conversion!.proof ?? 100) < 72 ||
      (conversion!.trust ?? 100) < 70 ||
      conversion!.recommendations.some((r) =>
        /\b(proof|trust|cta)\b/i.test(r.domain),
      ));
  const tasteWantsPolish =
    Boolean(taste) &&
    taste!.eligibleToJudge &&
    ((taste!.spacingHarmony ?? 100) < 74 ||
      (taste!.polish ?? 100) < 74);

  if (conversionNeedsProof && tasteWantsPolish) {
    conflicts.push({
      ownerA: "conversion_director",
      ownerB: "taste",
      reason:
        "Conversion Director needs proof and CTA clarity before the ask, while Taste is ready to polish spacing and rhythm.",
      recommendedResolution:
        "Conversion Director leads on trust and proof sequencing; Taste spacing polish runs after the conversion path is clear.",
    });
  }

  // Visual Composition vs Creative — image height / clear photo vs redesign hero.
  const visualNeedsRoom =
    Boolean(visual) &&
    ((visual!.overall ?? 100) < 72 ||
      (visual!.photographyPreservation?.overall ?? 100) < 70 ||
      (visual!.negativeSpaceUse ?? 100) < 68);
  const cdWantsHeroRedesign = cd.recommendations.some((r) =>
    /\bhero\b/i.test(`${r.title} ${r.relatedSections?.join(" ") ?? ""}`),
  );

  if (visualNeedsRoom && cdWantsHeroRedesign) {
    conflicts.push({
      ownerA: "visual_composition",
      ownerB: "creative_director",
      reason:
        "Visual Composition needs clearer photography and image height for readable copy, while Creative Director is recommending broader hero redesign.",
      recommendedResolution:
        "Visual Composition leads on hero image/composition; Creative Director narrative and section sequencing follow without mutating brand identity.",
    });
  }

  // Deduplicate by owner pair + reason prefix.
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = `${c.ownerA}|${c.ownerB}|${c.reason.slice(0, 48)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Apply conflict resolutions by demoting the losing lane when both are open. */
export function applyConflictResolutions(
  opportunities: StrategicOpportunity[],
  conflicts: StrategicConflict[],
): StrategicOpportunity[] {
  if (!conflicts.length) return opportunities;

  const demote = new Set<string>();
  for (const c of conflicts) {
    if (
      c.recommendedResolution.toLowerCase().includes("visual composition leads")
    ) {
      demote.add("creative_director");
    }
    if (
      c.recommendedResolution.toLowerCase().includes("conversion director leads")
    ) {
      demote.add("taste");
    }
    if (
      c.recommendedResolution
        .toLowerCase()
        .includes("taste polish waits") ||
      c.recommendedResolution.toLowerCase().includes("taste spacing polish runs after")
    ) {
      demote.add("taste");
    }
  }

  return opportunities.map((op) => {
    if (!demote.has(op.leader) && !demote.has(op.owner)) return op;
    if (op.leader === "visual_composition" || op.leader === "conversion_director") {
      return op;
    }
    if (op.leader === "taste" && demote.has("taste")) {
      return {
        ...op,
        businessImpact: Math.max(20, op.businessImpact - 18),
        expectedImprovement: Math.max(10, op.expectedImprovement - 12),
        explanation: `${op.explanation} Deferred until higher-priority specialist work lands.`,
      };
    }
    if (op.leader === "creative_director" && demote.has("creative_director")) {
      return {
        ...op,
        businessImpact: Math.max(24, op.businessImpact - 14),
        explanation: `${op.explanation} Hero composition owns the first pass.`,
      };
    }
    return op;
  });
}
