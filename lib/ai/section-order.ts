/**
 * Canonical section ordering for layout commands (Sprint 28.3).
 * Hero stays first; footer is outside normal section ordering.
 */

import { getTemplate } from "@/lib/templates";
import type { BusinessProject } from "@/types/business-project";

export const SECTION_ORDER_ALIASES: Record<string, string> = {
  hero: "hero",
  about: "about",
  services: "services",
  service: "services",
  features: "features",
  feature: "features",
  gallery: "gallery",
  photos: "gallery",
  images: "gallery",
  contact: "contact",
  contacts: "contact",
  testimonials: "testimonials",
  testimonial: "testimonials",
  reviews: "testimonials",
  faq: "faq",
  faqs: "faq",
  "frequently asked questions": "faq",
  team: "team",
  pricing: "pricing",
  prices: "pricing",
  booking: "bookingCta",
  bookingcta: "bookingCta",
  newsletter: "newsletter",
};

/** Sections that participate in homepage ordering (not chrome). */
export const ORDERABLE_SECTION_IDS = [
  "hero",
  "about",
  "services",
  "features",
  "gallery",
  "contact",
  "testimonials",
  "faq",
  "team",
  "pricing",
  "bookingCta",
  "newsletter",
] as const;

export type OrderableSectionId = (typeof ORDERABLE_SECTION_IDS)[number];

export type SectionMovePosition = "first" | "last" | "before" | "after";

export type SectionMoveIntent = {
  section: string;
  position: SectionMovePosition;
  relativeTo?: string;
};

export type ParseSectionMoveResult =
  | { ok: true; intent: SectionMoveIntent }
  | { ok: false; reason?: string };

export function resolveSectionAlias(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, " ");
  const withoutSection = key.replace(/\s+sections?$/, "").trim();
  const candidates = [withoutSection, withoutSection.replace(/\s+/g, "")];
  for (const candidate of candidates) {
    if (SECTION_ORDER_ALIASES[candidate]) {
      return SECTION_ORDER_ALIASES[candidate]!;
    }
  }
  return null;
}

export function defaultProjectSectionOrder(project: BusinessProject): string[] {
  const template = getTemplate(project.templateId || "modern");
  const design = project.designSections?.enabled ?? [];
  const core = [...template.sectionOrder];
  const extras = design.filter((id) => !core.includes(id as never));
  return [...core, ...extras];
}

export function getEffectiveSectionOrder(project: BusinessProject): string[] {
  if (project.sectionOrder?.length) return [...project.sectionOrder];
  return defaultProjectSectionOrder(project);
}

/** Keep required hero first; drop footer from order lists. */
export function normalizeSectionOrder(order: string[]): string[] {
  const cleaned = order.filter(
    (id) => id && id !== "footer" && id !== "header" && id !== "nav",
  );
  if (!cleaned.includes("hero")) return cleaned;
  return ["hero", ...cleaned.filter((id) => id !== "hero")];
}

export function moveSectionInOrder(
  order: string[],
  section: string,
  position: string,
  relativeTo?: string,
): string[] {
  const without = order.filter((id) => id !== section);
  const pos = position.toLowerCase();

  if (pos === "top" || pos === "first") {
    return normalizeSectionOrder([section, ...without]);
  }
  if (pos === "bottom" || pos === "last" || pos === "end") {
    return normalizeSectionOrder([...without, section]);
  }
  if (!relativeTo) {
    return normalizeSectionOrder([...without, section]);
  }

  const anchor = without.indexOf(relativeTo);
  if (anchor < 0) {
    return normalizeSectionOrder([...without, section]);
  }

  if (pos === "above" || pos === "before") {
    const next = [...without];
    next.splice(anchor, 0, section);
    return normalizeSectionOrder(next);
  }
  if (pos === "below" || pos === "after" || pos === "next_to") {
    const next = [...without];
    next.splice(anchor + 1, 0, section);
    return normalizeSectionOrder(next);
  }
  return normalizeSectionOrder([...without, section]);
}

export function applySectionMove(
  project: BusinessProject,
  intent: SectionMoveIntent,
): { project: BusinessProject; order: string[] } {
  const current = getEffectiveSectionOrder(project);
  if (!current.includes(intent.section)) {
    // Allow moving optional sections that exist in designSections even if not in order yet
    const enabled = project.designSections?.enabled ?? [];
    if (!enabled.includes(intent.section as never) && intent.section !== "hero") {
      // Still append if it's a known core/optional id — insert into order
    }
  }
  const base = current.includes(intent.section)
    ? current
    : [...current, intent.section];

  const position =
    intent.position === "first"
      ? "first"
      : intent.position === "last"
        ? "last"
        : intent.position === "before"
          ? "before"
          : "after";

  const order = moveSectionInOrder(
    base,
    intent.section,
    position,
    intent.relativeTo,
  );

  return {
    project: { ...project, sectionOrder: order },
    order,
  };
}

/**
 * Parse natural-language section position commands.
 */
export function parseSectionMoveRequest(request: string): ParseSectionMoveResult {
  const text = request.trim();
  if (!text) return { ok: false };

  const makeFirst = text.match(
    /\b(?:make|put|move)\s+(?:the\s+)?([a-z][\w\s-]{1,24}?)\s+(?:section\s+)?(?:first|to\s+the\s+top|at\s+the\s+top)\b/i,
  );
  if (makeFirst?.[1]) {
    const section = resolveSectionAlias(makeFirst[1]);
    if (!section) {
      return {
        ok: false,
        reason: `I don’t recognize the “${makeFirst[1].trim()}” section. Which section should move?`,
      };
    }
    if (section === "footer") {
      return {
        ok: false,
        reason: "The footer stays outside the main section order.",
      };
    }
    return { ok: true, intent: { section, position: "first" } };
  }

  const toEnd = text.match(
    /\b(?:move|put|place)\s+(?:the\s+)?([a-z][\w\s-]{1,24}?)\s+(?:section\s+)?(?:to\s+)?(?:the\s+)?(bottom|end|last)\b/i,
  );
  if (toEnd?.[1]) {
    const section = resolveSectionAlias(toEnd[1]);
    if (!section) {
      return {
        ok: false,
        reason: `I don’t recognize the “${toEnd[1].trim()}” section. Which section should move?`,
      };
    }
    if (section === "hero") {
      return {
        ok: false,
        reason:
          "The hero stays at the top of the page. Which other section should I move?",
      };
    }
    if (section === "footer") {
      return {
        ok: false,
        reason: "The footer stays outside the main section order.",
      };
    }
    return { ok: true, intent: { section, position: "last" } };
  }

  const relative = text.match(
    /\b(?:move|put|place)\s+(?:the\s+)?([a-z][\w\s-]{1,24}?)\s+(?:section\s+)?(above|below|before|after)\s+(?:the\s+)?([a-z][\w\s-]{1,24}?)\b/i,
  );
  if (relative?.[1] && relative[2] && relative[3]) {
    const section = resolveSectionAlias(relative[1]);
    const relativeTo = resolveSectionAlias(relative[3]);
    if (!section) {
      return {
        ok: false,
        reason: `I don’t recognize the “${relative[1].trim()}” section. Which section should move?`,
      };
    }
    if (!relativeTo) {
      return {
        ok: false,
        reason: `I don’t recognize the “${relative[3].trim()}” section as an anchor. Where should ${relative[1].trim()} go?`,
      };
    }
    if (section === "footer" || relativeTo === "footer") {
      return {
        ok: false,
        reason: "The footer stays outside the main section order.",
      };
    }
    const word = relative[2].toLowerCase();
    const position: SectionMovePosition =
      word === "above" || word === "before" ? "before" : "after";
    return {
      ok: true,
      intent: { section, position, relativeTo },
    };
  }

  // “move the contact section to the bottom of the site”
  const bottomOfSite = text.match(
    /\b(?:move|put|place)\s+(?:the\s+)?([a-z][\w\s-]{1,24}?)\s+(?:section\s+)?to\s+the\s+bottom\b/i,
  );
  if (bottomOfSite?.[1]) {
    const section = resolveSectionAlias(bottomOfSite[1]);
    if (!section) {
      return {
        ok: false,
        reason: `I don’t recognize the “${bottomOfSite[1].trim()}” section. Which section should move?`,
      };
    }
    if (section === "hero") {
      return {
        ok: false,
        reason:
          "The hero stays at the top of the page. Which other section should I move?",
      };
    }
    return { ok: true, intent: { section, position: "last" } };
  }

  return { ok: false };
}

export function isSectionOrderRequest(request: string): boolean {
  const parsed = parseSectionMoveRequest(request);
  if (parsed.ok) return true;
  return (
    /\b(move|put|place)\s+(?:the\s+)?[a-z][\w\s-]{1,24}?\s+(?:section\s+)?(above|below|before|after|to\s+the\s+bottom|to\s+the\s+top|first|last)\b/i.test(
      request,
    ) ||
    /\b(?:make|put|move)\s+(?:the\s+)?[a-z][\w\s-]{1,24}?\s+(?:section\s+)?first\b/i.test(
      request,
    )
  );
}
