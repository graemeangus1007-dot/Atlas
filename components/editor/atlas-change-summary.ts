/**
 * Compact, deduplicated website change summaries for the Atlas AI panel.
 */

import type { EditChangeSummary } from "@/lib/ai/edit-operations";

const AREA_RULES: Array<{ area: string; match: RegExp }> = [
  { area: "Hero", match: /\bhero\b/i },
  { area: "Typography", match: /\btypography|font\b/i },
  { area: "Colors", match: /\bcolor|palette|theme\b/i },
  { area: "Buttons", match: /\bbuttons?\b/i },
  { area: "Spacing", match: /\bwhitespace|spacing\b/i },
  { area: "Layout", match: /\blayout|template|section\b/i },
  { area: "Motion", match: /\bmotion|animation\b/i },
  { area: "SEO", match: /\bseo\b/i },
  { area: "Services", match: /\bservices?\b/i },
  { area: "Contact", match: /\bcontact\b/i },
  { area: "Navigation", match: /\bnav|navigation\b/i },
  { area: "FAQ", match: /\bfaq\b/i },
  { area: "Images", match: /\bimage|gallery|photo\b/i },
  { area: "Icons", match: /\bicon\b/i },
];

export type CompactChangeSummary = {
  count: number;
  areas: string[];
  items: EditChangeSummary[];
};

export function areaForChangeLabel(label: string): string {
  for (const rule of AREA_RULES) {
    if (rule.match.test(label)) return rule.area;
  }
  return "Site";
}

/** Deduplicate by label meaning; collect unique affected areas. */
export function summarizeWebsiteChanges(
  changes: EditChangeSummary[] | null | undefined,
): CompactChangeSummary {
  if (!changes?.length) {
    return { count: 0, areas: [], items: [] };
  }

  const seenLabels = new Set<string>();
  const items: EditChangeSummary[] = [];
  const areaSet = new Set<string>();

  for (const change of changes) {
    const key = change.label.trim().toLowerCase();
    if (!key || seenLabels.has(key)) continue;
    seenLabels.add(key);
    items.push(change);
    areaSet.add(areaForChangeLabel(change.label));
  }

  return {
    count: items.length,
    areas: [...areaSet],
    items,
  };
}
