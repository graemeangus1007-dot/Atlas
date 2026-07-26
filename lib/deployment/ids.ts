import type { PreviousDeploymentRef } from "@/lib/deployment/types";

const ATLAS_PREVIEW_HOST = "preview.atlas.site";

/**
 * Deterministic deployment id for a slug + artifact fingerprint.
 * Same inputs → same id (stable across retries / duplicate checks).
 */
export function buildDeploymentId(slug: string, fingerprint: string): string {
  const safeSlug = slug.trim().toLowerCase() || "site";
  const safeFingerprint = fingerprint.trim().toLowerCase() || "unknown";
  return `dep_${safeSlug}_${safeFingerprint}`;
}

/**
 * Fake preview URL for the mock provider only.
 * Do not use for Supabase (or any real) hosting — those must return Storage URLs.
 */
export function buildDeploymentPreviewUrl(slug: string): string {
  const safe = slug.trim().toLowerCase() || "site";
  return `https://${safe}.${ATLAS_PREVIEW_HOST}`;
}

export function toPreviousDeploymentRef(input: {
  id: string;
  previewUrl: string;
  artifactFingerprint: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
}): PreviousDeploymentRef {
  return {
    id: input.id,
    previewUrl: input.previewUrl,
    artifactFingerprint: input.artifactFingerprint,
    provider: input.provider,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    readyAt: input.readyAt,
  };
}
