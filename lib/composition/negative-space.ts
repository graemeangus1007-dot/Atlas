/**
 * Estimate natural negative-space zones for text/CTA placement.
 */

import type { ImageAnalysisEstimate } from "@/lib/composition/image-analysis";
import { focalConflictsWithZone } from "@/lib/composition/focal-point";
import type {
  CompositionAnalysisInput,
  ContentZoneId,
  NegativeSpaceZone,
} from "@/lib/composition/types";

const ALL_ZONES: ContentZoneId[] = [
  "upper_third",
  "lower_third",
  "left",
  "right",
  "center",
  "split_left",
  "split_right",
];

/**
 * Rank zones by quietness. Higher = safer for content.
 * Avoids placing text over estimated subject / focal areas.
 */
export function estimateNegativeSpaceZones(input: {
  analysis: ImageAnalysisEstimate;
  compositionInput: CompositionAnalysisInput;
}): NegativeSpaceZone[] {
  const { analysis, compositionInput } = input;
  const focal = analysis.focalPoint;
  const subject = analysis.subjectLocation;

  const zones: NegativeSpaceZone[] = ALL_ZONES.map((id) => {
    let quietness = 55;
    const avoidReasons: string[] = [];

    if (focalConflictsWithZone(focal, id)) {
      quietness -= 28;
      avoidReasons.push("critical focal area");
    }

    // Subject-side penalties
    if (
      (subject === "left" && (id === "left" || id === "split_left")) ||
      (subject === "right" && (id === "right" || id === "split_right")) ||
      (subject === "upper" && id === "upper_third") ||
      (subject === "lower" && id === "lower_third") ||
      (subject === "center" && id === "center") ||
      (subject === "full" && id === "center")
    ) {
      quietness -= 22;
      avoidReasons.push("likely subject region");
    }

    // Opposite of subject is quieter
    if (subject === "left" && (id === "right" || id === "split_right")) {
      quietness += 22;
    }
    if (subject === "right" && (id === "left" || id === "split_left")) {
      quietness += 22;
    }
    if (subject === "upper" && id === "lower_third") quietness += 18;
    if (subject === "lower" && id === "upper_third") quietness += 18;
    if (subject === "center" && id === "lower_third") quietness += 12;
    if (subject === "center" && id === "upper_third") quietness += 8;

    // Landscape photos often have quieter lower thirds (sky/ground structure)
    if (analysis.aspectClass === "landscape" || analysis.aspectClass === "panoramic") {
      if (id === "lower_third") quietness += 10;
      if (id === "upper_third") quietness += 4;
    }
    if (analysis.aspectClass === "portrait") {
      if (id === "lower_third") quietness += 8;
      if (id === "center") quietness -= 6;
    }

    // Split layouts: content belongs on the copy side
    if (
      compositionInput.layout === "split" ||
      compositionInput.legacyLayoutKey === "split" ||
      compositionInput.patternId === "hero.contractor_left"
    ) {
      if (id === "split_left" || id === "left") quietness += 24;
      if (id === "split_right" || id === "right") quietness -= 16;
    }

    // Busy imagery: prefer edges over center
    if (analysis.busyLikely && id === "center") {
      quietness -= 14;
      avoidReasons.push("high-detail center risk");
    }

    // Pixel quiet-region boosts
    for (const q of compositionInput.pixelAnalysis?.quietRegions ?? []) {
      if (q.zone === id) quietness = Math.max(quietness, q.quietness);
    }

    // Face regions → avoid overlapping zones
    for (const face of compositionInput.pixelAnalysis?.faceRegions ?? []) {
      const fx = face.x + face.width / 2;
      const fy = face.y + face.height / 2;
      if (focalConflictsWithZone({ x: fx, y: fy }, id)) {
        quietness -= 30;
        avoidReasons.push("faces");
      }
    }

    return {
      id,
      quietness: Math.max(0, Math.min(100, Math.round(quietness))),
      avoidReasons: [...new Set(avoidReasons)],
    };
  });

  return zones.sort((a, b) => b.quietness - a.quietness);
}

export function pickQuietestZone(
  zones: NegativeSpaceZone[],
  prefer?: ContentZoneId[],
): NegativeSpaceZone {
  if (prefer?.length) {
    for (const id of prefer) {
      const hit = zones.find((z) => z.id === id && z.quietness >= 48);
      if (hit) return hit;
    }
  }
  return zones[0] ?? {
    id: "lower_third",
    quietness: 50,
    avoidReasons: [],
  };
}
