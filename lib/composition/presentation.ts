/**
 * User-facing composition explanations — prefer placement language over overlay language.
 */

import type {
  CompositionEvaluation,
  VisualComposition,
} from "@/lib/composition/types";

/**
 * Agency-style explanation of a composition decision.
 * Avoids “I increased the overlay.” as the primary story.
 */
export function explainCompositionDecision(
  visual: VisualComposition,
): string {
  return visual.decisionReason;
}

export function explainCompositionEvaluation(
  evaluation: CompositionEvaluation,
): string {
  const parts: string[] = [];
  if (evaluation.strengths[0]) {
    parts.push(evaluation.strengths[0]);
  }
  if (evaluation.recommendedImprovements[0]) {
    parts.push(evaluation.recommendedImprovements[0]);
  } else if (evaluation.weaknesses[0]) {
    parts.push(evaluation.weaknesses[0]);
  }
  return parts.join(" ") || evaluation.photographyPreservation.explanation;
}

/**
 * True when a message still frames overlay increase as the primary fix.
 */
export function compositionTextSoundsLikeOverlayDefault(text: string): boolean {
  return /^\s*i (increased|raised|strengthened) the (hero )?overlay\b/i.test(
    text,
  );
}

export function formatCompositionSummary(input: {
  visual: VisualComposition;
  evaluation?: CompositionEvaluation | null;
}): string {
  const lines = [
    explainCompositionDecision(input.visual),
    "",
    `Content zone: ${input.visual.recommendedContentZone.zone.replace(/_/g, " ")}`,
    `CTA zone: ${input.visual.recommendedCTAZone.zone.replace(/_/g, " ")}`,
    `Overlay strength: ${input.visual.overlayStrength}`,
    `Preserve photography: ${input.visual.preservePhotography ? "yes" : "limited"}`,
  ];
  if (input.evaluation) {
    lines.push(
      "",
      `Composition score: ${input.evaluation.overall}`,
      `Photography preservation: ${input.evaluation.photographyPreservation.overall}`,
    );
  }
  return lines.join("\n");
}
