/**
 * Composition engine — assemble Hero → Trust → Services → Gallery → CTA → Contact → Footer.
 */

import {
  isCompatiblePatternSet,
  scorePatternPairCompatibility,
} from "@/lib/ai/design-patterns/compatibility";
import { getDesignPatternById } from "@/lib/ai/design-patterns/registry";
import { scoreComposition } from "@/lib/ai/design-patterns/scoring";
import { selectCandidatePatterns } from "@/lib/ai/design-patterns/selectors";
import type {
  DesignPattern,
  DesignPatternComposition,
  DesignPatternSelectionContext,
} from "@/lib/ai/design-patterns/types";

const SECTION_FLOW = [
  "hero",
  "trust",
  "services",
  "gallery",
  "cta",
  "contact",
  "footer",
] as const;

function pickBestCompatible(
  candidates: DesignPattern[],
  anchor: DesignPattern,
  already: DesignPattern[],
): DesignPattern | null {
  let best: DesignPattern | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    if (already.some((a) => a.id === c.id)) continue;
    const withSet = [...already, c].map((p) => p.id);
    if (!isCompatiblePatternSet(withSet)) continue;
    const pair = scorePatternPairCompatibility(anchor, c);
    const avg =
      already.reduce((s, a) => s + scorePatternPairCompatibility(a, c), pair) /
      (already.length + 1);
    if (avg > bestScore) {
      bestScore = avg;
      best = c;
    }
  }
  return best;
}

function buildOneComposition(
  hero: DesignPattern,
  ctx: DesignPatternSelectionContext,
): DesignPatternComposition | null {
  const trustCandidates = selectCandidatePatterns("trust", ctx, 6);
  const serviceCandidates = selectCandidatePatterns("services", ctx, 6);
  const galleryCandidates = selectCandidatePatterns("gallery", ctx, 6);
  const ctaCandidates = selectCandidatePatterns("cta", ctx, 6);

  const trust = pickBestCompatible(trustCandidates, hero, [hero]);
  const chosen: DesignPattern[] = [hero];
  if (trust) chosen.push(trust);

  const services = pickBestCompatible(serviceCandidates, hero, chosen);
  if (services) chosen.push(services);

  const gallery = pickBestCompatible(galleryCandidates, hero, chosen);
  if (gallery) chosen.push(gallery);

  const cta = pickBestCompatible(ctaCandidates, hero, chosen);
  if (cta) chosen.push(cta);

  if (!cta) return null;

  const patternIds = chosen.map((p) => p.id);
  if (!isCompatiblePatternSet(patternIds)) return null;

  const { score, dimensions } = scoreComposition({ patternIds }, ctx);
  const byCat = new Map(chosen.map((p) => [p.category, p.id]));

  return {
    slots: SECTION_FLOW.map((section) => ({
      section,
      patternId:
        section === "contact" || section === "footer"
          ? null
          : (byCat.get(section) ?? null),
    })),
    patternIds,
    score,
    dimensions,
    rationaleTags: [
      hero.name,
      trust?.name,
      services?.name,
      gallery?.name,
      cta.name,
    ].filter(Boolean) as string[],
  };
}

/**
 * Compose the highest-scoring compatible homepage pattern set.
 * Does not mutate the website — advisory selection only.
 */
export function composeDesignPatterns(
  ctx: DesignPatternSelectionContext,
): DesignPatternComposition {
  const heroes = selectCandidatePatterns("hero", ctx, 8);
  const compositions: DesignPatternComposition[] = [];

  for (const hero of heroes) {
    const built = buildOneComposition(hero, ctx);
    if (built) compositions.push(built);
  }

  compositions.sort(
    (a, b) =>
      b.score - a.score || a.patternIds.join(",").localeCompare(b.patternIds.join(",")),
  );

  if (compositions[0]) return compositions[0];

  // Deterministic fallback — contractor conversion baseline
  const fallbackIds = [
    "hero.contractor_left",
    "trust.google_reviews",
    "services.large_cards",
    "gallery.grid",
    "cta.request_quote",
  ];
  const validFallback = fallbackIds.filter((id) => getDesignPatternById(id));
  const { score, dimensions } = scoreComposition(
    { patternIds: validFallback },
    ctx,
  );
  return {
    slots: SECTION_FLOW.map((section) => {
      const match = validFallback.find((id) => id.startsWith(`${section}.`));
      return { section, patternId: match ?? null };
    }),
    patternIds: validFallback,
    score,
    dimensions,
    rationaleTags: ["Fallback service homepage"],
  };
}

export function compositionSectionFlowLabels(
  composition: DesignPatternComposition,
): string[] {
  return composition.slots
    .filter((s) => s.section !== "footer")
    .map((s) => {
      if (!s.patternId) {
        return s.section === "contact" ? "Contact" : s.section;
      }
      const p = getDesignPatternById(s.patternId);
      return p?.name ?? s.section;
    });
}
