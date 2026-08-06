/**
 * Canonical Design Pattern registry — single source of all patterns.
 */

import { CTA_PATTERNS } from "@/lib/ai/design-patterns/patterns-cta";
import { GALLERY_PATTERNS } from "@/lib/ai/design-patterns/patterns-gallery";
import { HERO_PATTERNS } from "@/lib/ai/design-patterns/patterns-hero";
import { SERVICES_PATTERNS } from "@/lib/ai/design-patterns/patterns-services";
import { TRUST_PATTERNS } from "@/lib/ai/design-patterns/patterns-trust";
import {
  DESIGN_PATTERN_CATEGORIES,
  type DesignPattern,
  type DesignPatternCategory,
} from "@/lib/ai/design-patterns/types";
import { DESIGN_AGENCIES_TONES } from "@/lib/ai/design-strategy-types";

const ALL_UNCHECKED: DesignPattern[] = [
  ...HERO_PATTERNS,
  ...TRUST_PATTERNS,
  ...SERVICES_PATTERNS,
  ...GALLERY_PATTERNS,
  ...CTA_PATTERNS,
];

function assertValidRegistry(patterns: DesignPattern[]): DesignPattern[] {
  const seen = new Set<string>();
  const byId = new Map<string, DesignPattern>();

  for (const p of patterns) {
    if (!p.id || !p.id.includes(".")) {
      throw new Error(`Invalid pattern id: ${p.id}`);
    }
    const [prefix] = p.id.split(".");
    if (prefix !== p.category) {
      throw new Error(`Pattern id prefix mismatch on ${p.id}`);
    }
    if (seen.has(p.id)) {
      throw new Error(`Duplicate design pattern id: ${p.id}`);
    }
    seen.add(p.id);
    if (!DESIGN_PATTERN_CATEGORIES.includes(p.category)) {
      throw new Error(`Unknown category on ${p.id}: ${p.category}`);
    }
    if (!p.name?.trim()) {
      throw new Error(`Missing name on ${p.id}`);
    }
    if (
      p.conversionStrength < 0 ||
      p.conversionStrength > 1 ||
      p.visualWeight < 0 ||
      p.visualWeight > 1
    ) {
      throw new Error(`Out-of-range strength/weight on ${p.id}`);
    }
    for (const tone of [...p.brandAffinity, ...p.tone]) {
      if (!(DESIGN_AGENCIES_TONES as readonly string[]).includes(tone)) {
        throw new Error(`Unknown tone on ${p.id}: ${tone}`);
      }
    }
    byId.set(p.id, p);
  }

  for (const p of patterns) {
    for (const ref of p.compatiblePatterns) {
      if (!byId.has(ref)) {
        throw new Error(`Unknown compatiblePatterns ref on ${p.id}: ${ref}`);
      }
    }
  }

  return patterns;
}

export const DESIGN_PATTERN_REGISTRY: readonly DesignPattern[] =
  assertValidRegistry(ALL_UNCHECKED);

const BY_ID = new Map(DESIGN_PATTERN_REGISTRY.map((p) => [p.id, p]));

export function listAllDesignPatterns(): DesignPattern[] {
  return [...DESIGN_PATTERN_REGISTRY];
}

export function getDesignPatternById(id: string): DesignPattern | null {
  return BY_ID.get(id) ?? null;
}

export function getDesignPatternsByCategory(
  category: DesignPatternCategory,
): DesignPattern[] {
  return DESIGN_PATTERN_REGISTRY.filter((p) => p.category === category);
}

export function countDesignPatternsByCategory(): Record<
  DesignPatternCategory,
  number
> {
  const counts = {
    hero: 0,
    trust: 0,
    services: 0,
    gallery: 0,
    cta: 0,
  } satisfies Record<DesignPatternCategory, number>;
  for (const p of DESIGN_PATTERN_REGISTRY) {
    counts[p.category] += 1;
  }
  return counts;
}

/** True when user-facing text accidentally includes pattern ids. */
export function textExposesDesignPatternIds(text: string): boolean {
  if (!text) return false;
  return DESIGN_PATTERN_REGISTRY.some(
    (p) =>
      text.includes(p.id) ||
      new RegExp(`\\b${p.category}\\.[a-z0-9_]+\\b`, "i").test(text),
  );
}
