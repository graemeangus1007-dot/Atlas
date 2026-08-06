/**
 * Pattern compatibility graph — what works together (and what does not).
 */

import {
  getDesignPatternById,
  listAllDesignPatterns,
} from "@/lib/ai/design-patterns/registry";
import type { DesignPattern } from "@/lib/ai/design-patterns/types";

/** Hard anti-pairs — never compose these together. */
const HARD_INCOMPATIBLE: ReadonlyArray<readonly [string, string]> = [
  ["hero.luxury_center", "services.comparison"],
  ["hero.luxury_center", "cta.emergency_service"],
  ["hero.premium_minimal", "cta.emergency_service"],
  ["hero.premium_minimal", "services.comparison"],
  ["cta.luxury_contact", "services.comparison"],
  ["cta.minimal_cta", "cta.emergency_service"],
  ["hero.bold_statement", "trust.certifications"],
  ["gallery.pinterest", "hero.contractor_left"],
];

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

const HARD_SET = new Set(HARD_INCOMPATIBLE.map(([a, b]) => pairKey(a, b)));

export function arePatternsHardIncompatible(a: string, b: string): boolean {
  if (a === b) return false;
  return HARD_SET.has(pairKey(a, b));
}

/**
 * Soft compatibility: declared edges, shared brand affinity, and avoidWhen.
 * Returns 0–1.
 */
export function scorePatternPairCompatibility(
  a: DesignPattern,
  b: DesignPattern,
): number {
  if (a.id === b.id) return 1;
  if (arePatternsHardIncompatible(a.id, b.id)) return 0;

  let score = 0.35;
  if (a.compatiblePatterns.includes(b.id) || b.compatiblePatterns.includes(a.id)) {
    score += 0.4;
  }

  const sharedTone = a.brandAffinity.filter((t) => b.brandAffinity.includes(t));
  score += Math.min(0.2, sharedTone.length * 0.07);

  if (
    (a.avoidWhen.some((x) => /luxury|colorful_card|hard_sell/.test(x)) &&
      b.brandAffinity.includes("luxury")) ||
    (b.avoidWhen.some((x) => /luxury|colorful_card|hard_sell/.test(x)) &&
      a.brandAffinity.includes("luxury"))
  ) {
    score -= 0.25;
  }

  if (
    a.avoidWhen.includes("colorful_card_grids") ||
    b.avoidWhen.includes("colorful_card_grids")
  ) {
    if (
      a.id.includes("comparison") ||
      b.id.includes("comparison") ||
      a.id.includes("icon_grid") ||
      b.id.includes("icon_grid")
    ) {
      score -= 0.2;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function isCompatiblePatternSet(ids: string[]): boolean {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = getDesignPatternById(ids[i]!);
      const b = getDesignPatternById(ids[j]!);
      if (!a || !b) return false;
      if (arePatternsHardIncompatible(a.id, b.id)) return false;
      if (scorePatternPairCompatibility(a, b) < 0.25) return false;
    }
  }
  return true;
}

/** Adjacency list for diagnostics / tests. */
export function buildCompatibilityGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const all = listAllDesignPatterns();
  for (const p of all) {
    const neighbors = new Set<string>(p.compatiblePatterns);
    for (const other of all) {
      if (other.id === p.id) continue;
      if (scorePatternPairCompatibility(p, other) >= 0.55) {
        neighbors.add(other.id);
      }
    }
    graph.set(p.id, [...neighbors].sort());
  }
  return graph;
}
