/**
 * Optional AI website sections (Sprint 20.1).
 */

export const AI_OPTIONAL_SECTION_IDS = [
  "testimonials",
  "faq",
  "team",
  "gallery",
  "pricing",
  "bookingCta",
  "newsletter",
] as const;

export type AiOptionalSectionId = (typeof AI_OPTIONAL_SECTION_IDS)[number];

export const AI_OPTIONAL_SECTION_LABELS: Record<AiOptionalSectionId, string> = {
  testimonials: "Testimonials",
  faq: "FAQ",
  team: "Team",
  gallery: "Gallery",
  pricing: "Pricing",
  bookingCta: "Booking CTA",
  newsletter: "Newsletter",
};

export type AiOptionalSectionsState = Record<AiOptionalSectionId, boolean>;

export const DEFAULT_OPTIONAL_SECTIONS: AiOptionalSectionsState = {
  testimonials: false,
  faq: false,
  team: false,
  gallery: true,
  pricing: false,
  bookingCta: false,
  newsletter: false,
};

export function normalizeOptionalSections(
  raw: unknown,
): AiOptionalSectionsState {
  const base = { ...DEFAULT_OPTIONAL_SECTIONS };
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  for (const id of AI_OPTIONAL_SECTION_IDS) {
    if (typeof row[id] === "boolean") base[id] = row[id];
  }
  return base;
}

export function enabledOptionalSections(
  state: AiOptionalSectionsState,
): AiOptionalSectionId[] {
  return AI_OPTIONAL_SECTION_IDS.filter((id) => state[id]);
}
