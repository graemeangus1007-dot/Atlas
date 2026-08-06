/**
 * Safe content zones — where text and CTAs naturally belong.
 */

import type { ImageAnalysisEstimate } from "@/lib/composition/image-analysis";
import {
  estimateNegativeSpaceZones,
  pickQuietestZone,
} from "@/lib/composition/negative-space";
import type {
  CompositionAnalysisInput,
  ContentZoneId,
  ContentZoneRecommendation,
  NegativeSpaceZone,
} from "@/lib/composition/types";

function zoneToAlignment(zone: ContentZoneId): "left" | "center" | "right" {
  if (zone === "left" || zone === "split_left") return "left";
  if (zone === "right" || zone === "split_right") return "right";
  return "center";
}

function zoneToVertical(
  zone: ContentZoneId,
): "top" | "center" | "bottom" {
  if (zone === "upper_third") return "top";
  if (zone === "lower_third") return "bottom";
  return "center";
}

function reasonForZone(zone: NegativeSpaceZone): string {
  if (zone.avoidReasons.length === 0) {
    return `The ${zone.id.replace(/_/g, " ")} offers the quietest reading space in this photo.`;
  }
  return `The ${zone.id.replace(/_/g, " ")} avoids ${zone.avoidReasons.join(" and ")}.`;
}

/**
 * Choose recommended content + CTA safe zones from negative space.
 */
export function determineSafeZones(input: {
  analysis: ImageAnalysisEstimate;
  compositionInput: CompositionAnalysisInput;
}): {
  negativeSpaceZones: NegativeSpaceZone[];
  contentZone: ContentZoneRecommendation;
  ctaZone: ContentZoneRecommendation;
} {
  const negativeSpaceZones = estimateNegativeSpaceZones(input);
  const preferContent: ContentZoneId[] =
    input.compositionInput.patternId === "hero.contractor_left" ||
    input.compositionInput.legacyLayoutKey === "split"
      ? ["split_left", "left", "lower_third"]
      : input.analysis.busyLikely
        ? ["lower_third", "left", "right", "upper_third"]
        : ["lower_third", "center", "left", "right"];

  const content = pickQuietestZone(negativeSpaceZones, preferContent);

  // CTA usually shares the content column, slightly lower when possible.
  let cta = content;
  if (content.id === "upper_third") {
    const lower = negativeSpaceZones.find((z) => z.id === "lower_third");
    if (lower && lower.quietness >= 45) cta = lower;
  } else if (content.id === "center") {
    const lower = negativeSpaceZones.find((z) => z.id === "lower_third");
    if (lower && lower.quietness >= content.quietness - 8) cta = lower;
  }

  return {
    negativeSpaceZones,
    contentZone: {
      zone: content.id,
      alignment: zoneToAlignment(content.id),
      verticalBias: zoneToVertical(content.id),
      reason: reasonForZone(content),
    },
    ctaZone: {
      zone: cta.id,
      alignment: zoneToAlignment(cta.id),
      verticalBias: zoneToVertical(cta.id),
      reason: reasonForZone(cta),
    },
  };
}
