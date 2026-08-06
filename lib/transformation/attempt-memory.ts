/**
 * Bounded memory of recent transformation attempts — prevents immediate identical no-gain reruns.
 */

import { createHash } from "node:crypto";
import type { AtlasActionMemory } from "@/lib/ai/atlas-action-memory";
import type { TransformationCapabilityGap } from "@/lib/transformation/capability-gaps";
import type { TransformationGoalId } from "@/lib/transformation/types";
import type { BusinessProject } from "@/types/business-project";

export type TransformationAttemptRecord = {
  fingerprint: string;
  goalIds: TransformationGoalId[];
  overallDelta: number;
  baselineScore: number;
  at: string;
  capabilityGaps: TransformationCapabilityGap[];
};

export function buildTransformationFingerprint(input: {
  project: BusinessProject;
  goalIds: TransformationGoalId[];
}): string {
  const p = input.project;
  const payload = {
    goals: [...input.goalIds].sort(),
    order: p.sectionOrder ?? [],
    enabled: p.designSections?.enabled ?? [],
    testimonials: p.designSections?.testimonials?.length ?? 0,
    gallery: (p.galleryImageIds ?? []).filter(Boolean).length,
    heroImage: p.heroImageId ?? null,
    pattern: p.heroComposition?.patternId ?? null,
    cta: p.primaryCta ?? "",
    spacing: p.creativePolish?.spacing ?? "default",
    hierarchy: Boolean(p.creativePolish?.visualHierarchy),
    lightbox: p.galleryInteraction?.mode ?? "none",
  };
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

export function readLastTransformationAttempt(
  memory: AtlasActionMemory | null | undefined,
): TransformationAttemptRecord | null {
  const raw = (
    memory as AtlasActionMemory & {
      lastTransformationAttempt?: TransformationAttemptRecord | null;
    }
  )?.lastTransformationAttempt;
  if (!raw || typeof raw.fingerprint !== "string") return null;
  return raw;
}

export function shouldSkipRepeatedNoGainAttempt(input: {
  memory: AtlasActionMemory | null | undefined;
  fingerprint: string;
}): TransformationAttemptRecord | null {
  const last = readLastTransformationAttempt(input.memory);
  if (!last) return null;
  if (last.fingerprint !== input.fingerprint) return null;
  if (Math.abs(last.overallDelta) > 2) return null;
  // Only skip immediate repeats within a reasonable window (2 hours)
  const age = Date.now() - Date.parse(last.at);
  if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) return null;
  return last;
}

export function storeTransformationAttempt(
  memory: AtlasActionMemory,
  attempt: TransformationAttemptRecord,
): AtlasActionMemory {
  return {
    ...memory,
    updatedAt: new Date().toISOString(),
    lastTransformationAttempt: attempt,
  } as AtlasActionMemory;
}
