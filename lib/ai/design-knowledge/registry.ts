/**
 * Canonical Design Knowledge registry — single source of all principles.
 */

import { ACCESSIBILITY_PRINCIPLES } from "@/lib/ai/design-knowledge/accessibility";
import { BRANDING_PRINCIPLES } from "@/lib/ai/design-knowledge/branding";
import { COLOR_PRINCIPLES } from "@/lib/ai/design-knowledge/color";
import { CONVERSION_PRINCIPLES } from "@/lib/ai/design-knowledge/conversion";
import { HIERARCHY_PRINCIPLES } from "@/lib/ai/design-knowledge/hierarchy";
import { HOMEPAGE_PRINCIPLES } from "@/lib/ai/design-knowledge/homepage";
import { IMAGERY_PRINCIPLES } from "@/lib/ai/design-knowledge/imagery";
import { LAYOUT_PRINCIPLES } from "@/lib/ai/design-knowledge/layout";
import { SPACING_PRINCIPLES } from "@/lib/ai/design-knowledge/spacing";
import { TRUST_PRINCIPLES } from "@/lib/ai/design-knowledge/trust";
import { TYPOGRAPHY_PRINCIPLES } from "@/lib/ai/design-knowledge/typography";
import type {
  DesignKnowledgeCategory,
  DesignPrinciple,
} from "@/lib/ai/design-knowledge/types";
import { DESIGN_KNOWLEDGE_CATEGORIES } from "@/lib/ai/design-knowledge/types";

const ALL_PRINCIPLES_UNCHECKED: DesignPrinciple[] = [
  ...HOMEPAGE_PRINCIPLES,
  ...TYPOGRAPHY_PRINCIPLES,
  ...SPACING_PRINCIPLES,
  ...LAYOUT_PRINCIPLES,
  ...HIERARCHY_PRINCIPLES,
  ...TRUST_PRINCIPLES,
  ...COLOR_PRINCIPLES,
  ...IMAGERY_PRINCIPLES,
  ...CONVERSION_PRINCIPLES,
  ...ACCESSIBILITY_PRINCIPLES,
  ...BRANDING_PRINCIPLES,
];

function assertValidRegistry(principles: DesignPrinciple[]): DesignPrinciple[] {
  const seen = new Set<string>();
  const byId = new Map<string, DesignPrinciple>();

  for (const p of principles) {
    if (!p.id || !p.id.includes(".")) {
      throw new Error(`Invalid principle id: ${p.id}`);
    }
    if (seen.has(p.id)) {
      throw new Error(`Duplicate design principle id: ${p.id}`);
    }
    seen.add(p.id);
    if (!DESIGN_KNOWLEDGE_CATEGORIES.includes(p.category)) {
      throw new Error(`Unknown category on ${p.id}: ${p.category}`);
    }
    if (!p.title?.trim() || !p.principle?.trim() || !p.reasoning?.trim()) {
      throw new Error(`Missing required fields on ${p.id}`);
    }
    if (!p.signals?.length || !p.recommendedActions?.length || !p.appliesTo?.length) {
      throw new Error(`Incomplete arrays on ${p.id}`);
    }
    byId.set(p.id, p);
  }

  for (const p of principles) {
    for (const related of p.relatedPrincipleIds) {
      if (!byId.has(related)) {
        throw new Error(
          `Broken relatedPrincipleIds on ${p.id}: missing ${related}`,
        );
      }
    }
  }

  return principles;
}

/** Frozen canonical list — validated once at module load. */
export const DESIGN_KNOWLEDGE_REGISTRY: readonly DesignPrinciple[] =
  Object.freeze(assertValidRegistry(ALL_PRINCIPLES_UNCHECKED));

const BY_ID: ReadonlyMap<string, DesignPrinciple> = new Map(
  DESIGN_KNOWLEDGE_REGISTRY.map((p) => [p.id, p]),
);

const BY_CATEGORY: ReadonlyMap<DesignKnowledgeCategory, DesignPrinciple[]> =
  (() => {
    const map = new Map<DesignKnowledgeCategory, DesignPrinciple[]>();
    for (const category of DESIGN_KNOWLEDGE_CATEGORIES) {
      map.set(
        category,
        DESIGN_KNOWLEDGE_REGISTRY.filter((p) => p.category === category),
      );
    }
    return map;
  })();

export function getDesignPrincipleById(id: string): DesignPrinciple | null {
  return BY_ID.get(id) ?? null;
}

export function getDesignPrinciplesByCategory(
  category: DesignKnowledgeCategory,
): DesignPrinciple[] {
  return [...(BY_CATEGORY.get(category) ?? [])];
}

export function listAllDesignPrinciples(): DesignPrinciple[] {
  return [...DESIGN_KNOWLEDGE_REGISTRY];
}

export function countDesignPrinciplesByCategory(): Record<
  DesignKnowledgeCategory,
  number
> {
  const counts = {} as Record<DesignKnowledgeCategory, number>;
  for (const category of DESIGN_KNOWLEDGE_CATEGORIES) {
    counts[category] = BY_CATEGORY.get(category)?.length ?? 0;
  }
  return counts;
}

/** Test helper — re-run validation on an arbitrary list. */
export function validateDesignPrincipleRegistry(
  principles: DesignPrinciple[],
): string[] {
  try {
    assertValidRegistry(principles);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}
