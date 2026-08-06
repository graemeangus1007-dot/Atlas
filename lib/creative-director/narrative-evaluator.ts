/**
 * Story progression — beginning, middle, end, visitor questions.
 */

import type {
  NarrativeEvaluation,
  PageSectionInventory,
  SectionEvaluation,
} from "@/lib/creative-director/types";

export function evaluateWebsiteNarrative(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
  flowScore: number;
}): NarrativeEvaluation {
  const inv = input.inventory;
  const present = inv.present;

  const beginning = inv.heroHeadline.trim()
    ? `Opens with “${inv.heroHeadline.trim().slice(0, 72)}”`
    : "Opening promise is unclear";

  const middleParts: string[] = [];
  if (present.has("services")) middleParts.push("services");
  if (present.has("gallery") && inv.gallerySlots > 0) middleParts.push("visual proof");
  if (present.has("about") && inv.hasAboutCopy) middleParts.push("story");
  const middle =
    middleParts.length > 0
      ? `Develops through ${middleParts.join(", ")}`
      : "Middle of the page lacks a clear development arc";

  const end =
    present.has("contact")
      ? "Closes toward contact / next step"
      : "Ending conversion path is incomplete";

  const questionsAnswered: string[] = [];
  const questionsOpen: string[] = [];

  if (inv.heroHeadline.trim()) questionsAnswered.push("What do you do?");
  else questionsOpen.push("What do you do?");

  if (inv.servicesCount > 0) questionsAnswered.push("What can I buy?");
  else questionsOpen.push("What can I buy?");

  if (inv.testimonialCount > 0 || inv.gallerySlots >= 3) {
    questionsAnswered.push("Can I trust this company?");
  } else {
    questionsOpen.push("Can I trust this company?");
  }

  if (inv.contactPhone || inv.contactEmail) {
    questionsAnswered.push("How do I reach you?");
  } else {
    questionsOpen.push("How do I reach you?");
  }

  if (inv.faqCount > 0) questionsAnswered.push("What are the practical details?");
  else if (/dental|law|medical|clinic/i.test(inv.industry)) {
    questionsOpen.push("What are the practical details?");
  }

  let momentum = 62;
  if (inv.hasHeroImage) momentum += 8;
  if (inv.testimonialCount > 0) momentum += 10;
  if (inv.gallerySlots >= 3) momentum += 8;
  if (questionsOpen.length >= 2) momentum -= 14;
  momentum = Math.round(momentum * 0.7 + input.flowScore * 0.3);
  momentum = Math.max(0, Math.min(100, momentum));

  const score = Math.round(
    momentum * 0.45 +
      (questionsAnswered.length / Math.max(1, questionsAnswered.length + questionsOpen.length)) *
        100 *
        0.35 +
      input.flowScore * 0.2,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    beginning,
    middle,
    end,
    momentum,
    questionsAnswered,
    questionsOpen,
    explanation:
      questionsOpen.length === 0
        ? "The page walks visitors from promise to proof to action with few open questions."
        : `The story still leaves visitors asking: ${questionsOpen[0]}`,
  };
}
