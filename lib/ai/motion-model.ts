/**
 * Canonical motion model (Sprint 28.3).
 * One persisted shape drives editor / preview / publish rendering.
 */

import type { BusinessProject } from "@/types/business-project";

export const MOTION_PRESETS = ["none", "subtle", "polished"] as const;
export type MotionPreset = (typeof MOTION_PRESETS)[number];

export type ProjectMotionState = {
  preset: MotionPreset;
  sectionReveal: boolean;
  hoverEffects: boolean;
  respectReducedMotion: true;
  /** Legacy compatibility flag mirrored from preset !== "none". */
  motion: boolean;
};

export type CreativePolishMotionFields = {
  motion?: boolean;
  motionPreset?: MotionPreset;
  sectionReveal?: boolean;
  hoverEffects?: boolean;
  respectReducedMotion?: boolean;
};

export function readMotionState(
  project: BusinessProject | null | undefined,
): ProjectMotionState {
  const polish = project?.creativePolish;
  const legacyOn = Boolean(polish?.motion);
  const preset: MotionPreset =
    polish?.motionPreset ?? (legacyOn ? "subtle" : "none");
  const enabled = preset !== "none";
  return {
    preset,
    sectionReveal:
      polish?.sectionReveal !== undefined
        ? Boolean(polish.sectionReveal)
        : enabled,
    hoverEffects:
      polish?.hoverEffects !== undefined
        ? Boolean(polish.hoverEffects)
        : enabled,
    respectReducedMotion: true,
    motion: enabled,
  };
}

export function motionFieldsForPreset(
  preset: MotionPreset,
): CreativePolishMotionFields {
  if (preset === "none") {
    return {
      motion: false,
      motionPreset: "none",
      sectionReveal: false,
      hoverEffects: false,
      respectReducedMotion: true,
    };
  }
  return {
    motion: true,
    motionPreset: preset,
    sectionReveal: true,
    hoverEffects: true,
    respectReducedMotion: true,
  };
}

export function isMotionStateActive(
  project: BusinessProject,
  desired: MotionPreset,
): boolean {
  const current = readMotionState(project);
  if (desired === "none") {
    return current.preset === "none" && !current.motion;
  }
  return (
    current.preset === desired &&
    current.motion &&
    current.sectionReveal &&
    current.hoverEffects
  );
}

/** Infer desired motion preset from a user request. */
export function desiredMotionPresetFromRequest(
  request: string,
): MotionPreset | null {
  const text = request.trim();
  if (!text) return null;

  if (
    /\b(remove|disable|turn\s+off|no)\s+(all\s+)?(animations?|motion|scroll\s+animations?)\b/i.test(
      text,
    ) ||
    /\b(animations?|motion)\s+off\b/i.test(text)
  ) {
    return "none";
  }

  if (
    /\b(more\s+alive|polished\s+animations?|cinematic|dramatic)\b/i.test(text)
  ) {
    return "polished";
  }

  if (
    /\b(smooth\s+scroll\s+animations?|scroll\s+animations?|subtle\s+animations?|micro[- ]?interactions?|animations?|motion)\b/i.test(
      text,
    ) ||
    /\b(add|enable|implement|turn\s+on)\b[\s\S]{0,40}\b(animations?|motion)\b/i.test(
      text,
    )
  ) {
    return "subtle";
  }

  return null;
}

export function motionAlreadyActiveMessage(preset: MotionPreset): string {
  if (preset === "none") {
    return "Animations are already off. Reduced-motion preferences stay respected.";
  }
  return "That motion style is already active.";
}

export function motionAppliedMessage(preset: MotionPreset): string {
  if (preset === "none") {
    return "Animations are disabled. Reduced-motion preferences stay respected.";
  }
  if (preset === "polished") {
    return "Polished scroll and hover motion is now active across eligible sections.";
  }
  return "Subtle scroll animations and restrained hover motion are now enabled.";
}
