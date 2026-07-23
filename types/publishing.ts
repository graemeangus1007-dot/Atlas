import type { BusinessProject } from "@/types/business-project";

/**
 * Frozen project state captured at publish time.
 * Stored with `publish: null` to avoid recursive publish records.
 */
export type PublishSnapshot = BusinessProject;

/** Mock deploy pipeline stages shown in the publish modal. */
export type PublishStepId =
  | "preparing"
  | "optimizing"
  | "building"
  | "deploying";

export type PublishStep = {
  id: PublishStepId;
  label: string;
};

/** Progress event emitted by the Publisher during a deploy. */
export type PublishProgressEvent = {
  step: PublishStepId;
  label: string;
  /** Overall progress 0–100. */
  progress: number;
};

/**
 * Result of a successful publish.
 * UI stores this on BusinessProject; a future provider can return a real URL.
 */
export type PublishResult = {
  slug: string;
  url: string;
  publishedAt: string;
  snapshot: PublishSnapshot;
};

/** Last successful publish attached to the project. */
export type PublishRecord = PublishResult;

/** Ordered mock pipeline steps. */
export const PUBLISH_STEPS: PublishStep[] = [
  { id: "preparing", label: "Preparing website..." },
  { id: "optimizing", label: "Optimizing assets..." },
  { id: "building", label: "Building pages..." },
  { id: "deploying", label: "Deploying..." },
];
