/**
 * Visual rhythm / pacing across sections.
 */

import type {
  PageSectionInventory,
  RhythmEvaluation,
  SectionEvaluation,
} from "@/lib/creative-director/types";

export function evaluateVisualRhythm(input: {
  inventory: PageSectionInventory;
  sections: SectionEvaluation[];
}): RhythmEvaluation {
  const present = input.sections.filter((s) => s.present);
  const cadence = present.map((s) => s.visualWeight);
  const densityNotes: string[] = [];
  let score = 76;

  let streak = 1;
  for (let i = 1; i < cadence.length; i++) {
    if (cadence[i] === cadence[i - 1] && cadence[i] === "heavy") {
      streak += 1;
      if (streak >= 3) {
        densityNotes.push(
          "Several heavy sections stack without a lighter breathing beat.",
        );
        score -= 14;
        break;
      }
    } else {
      streak = 1;
    }
  }

  const heavyCount = cadence.filter((c) => c === "heavy").length;
  const lightCount = cadence.filter((c) => c === "light").length;
  if (heavyCount >= 4 && lightCount === 0) {
    densityNotes.push("The page lacks light sections to reset attention.");
    score -= 10;
  }

  if (input.inventory.spacing === "airy") {
    densityNotes.push("Airy spacing supports a calmer reading rhythm.");
    score += 6;
  } else if (input.inventory.spacing === "default" && heavyCount >= 3) {
    densityNotes.push("Default spacing with dense blocks can feel compressed.");
    score -= 4;
  }

  if (input.inventory.gallerySlots > 0 && input.inventory.gallerySlots < 3) {
    densityNotes.push("Sparse gallery cadence weakens visual proof rhythm.");
    score -= 6;
  }

  // Alternating heavy/light is ideal
  let alternations = 0;
  for (let i = 1; i < cadence.length; i++) {
    if (cadence[i] !== cadence[i - 1]) alternations += 1;
  }
  if (alternations >= Math.max(1, cadence.length - 2)) {
    score += 8;
    densityNotes.push("Section weight alternates in a readable cadence.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    cadence,
    densityNotes,
    explanation:
      densityNotes[0] ||
      "Visual rhythm balances heavy proof moments with lighter supporting sections.",
  };
}
