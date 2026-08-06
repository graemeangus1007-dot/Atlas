/**
 * Focal-point helpers for Visual Composition.
 */

import type { CompositionAnalysisInput } from "@/lib/composition/types";
import { analyzeImageComposition } from "@/lib/composition/image-analysis";

export function resolveCompositionFocalPoint(
  input: CompositionAnalysisInput,
): { x: number; y: number } {
  return analyzeImageComposition(input).focalPoint;
}

export function focalConflictsWithZone(
  focal: { x: number; y: number },
  zone:
    | "upper_third"
    | "lower_third"
    | "left"
    | "right"
    | "center"
    | "split_left"
    | "split_right",
): boolean {
  switch (zone) {
    case "left":
    case "split_left":
      return focal.x < 0.42;
    case "right":
    case "split_right":
      return focal.x > 0.58;
    case "upper_third":
      return focal.y < 0.38;
    case "lower_third":
      return focal.y > 0.62;
    case "center":
      return focal.x > 0.35 && focal.x < 0.65 && focal.y > 0.35 && focal.y < 0.65;
    default:
      return false;
  }
}
