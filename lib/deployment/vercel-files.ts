import { createHash } from "node:crypto";
import type {
  PublishArtifact,
  PublishAssetEntry,
  PublishFile,
} from "@/lib/publishing/types";
import {
  assertNoAppSourceFiles,
  buildStaticSiteVercelJson,
} from "@/lib/deployment/vercel-static-deployment";

/** Vercel create-deployment JSON body hard limit. */
export const VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * Practical per-file cap for POST /v2/files.
 * Keeps individual uploads well within Vercel’s file endpoint constraints.
 */
export const VERCEL_FILE_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

/** Resolves binary (or external) asset bytes at deploy time. */
export type ArtifactAssetResolver = {
  downloadProjectMedia(storagePath: string): Promise<Uint8Array>;
  fetchExternal(url: string): Promise<Uint8Array>;
};

/**
 * Prepared file ready for Vercel’s upload-file → create-deployment flow.
 * Bytes are uploaded separately; create-deployment only gets { file, sha, size }.
 */
export type VercelPreparedFile = {
  /** Nested path relative to site root, e.g. `assets/hero.jpg`. */
  file: string;
  bytes: Uint8Array;
  /** SHA-1 hex digest (Vercel `x-vercel-digest`). */
  sha: string;
  size: number;
};

/** Lightweight reference used in the create-deployment JSON body. */
export type VercelFileReference = {
  file: string;
  sha: string;
  size: number;
};

export function sha1Hex(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

export function utf8Bytes(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

export function toVercelFileReference(
  prepared: VercelPreparedFile,
): VercelFileReference {
  return {
    file: prepared.file,
    sha: prepared.sha,
    size: prepared.size,
  };
}

export function measureCreateDeploymentBodyBytes(body: unknown): number {
  return Buffer.byteLength(JSON.stringify(body), "utf8");
}

/**
 * Validate prepared files before upload.
 * Throws Error with a safe, user-facing message (no secrets).
 */
export function validatePreparedFilesForUpload(
  files: VercelPreparedFile[],
): void {
  if (files.length === 0) {
    throw new Error("Deployment artifact produced no uploadable files.");
  }

  for (const file of files) {
    if (!file.file || file.file.includes("..")) {
      throw new Error(`Invalid deployment file path: ${file.file || "(empty)"}`);
    }
    if (file.size > VERCEL_FILE_UPLOAD_LIMIT_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const limitMb = VERCEL_FILE_UPLOAD_LIMIT_BYTES / (1024 * 1024);
      throw new Error(
        `File "${file.file}" is ${mb} MB and exceeds the ${limitMb} MB per-file upload limit.`,
      );
    }
    if (file.size <= 0 || file.bytes.byteLength !== file.size) {
      throw new Error(`Invalid file size for ${file.file}.`);
    }
    if (file.sha.length !== 40) {
      throw new Error(`Invalid SHA digest for ${file.file}.`);
    }
  }
}

/**
 * Ensure the create-deployment JSON (file refs only) stays under Vercel’s 10 MB limit.
 */
export function assertCreateDeploymentBodyWithinLimit(body: unknown): number {
  const bytes = measureCreateDeploymentBodyBytes(body);
  if (bytes > VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES) {
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Vercel create-deployment request is ${mb} MB and exceeds the 10 MB limit. ` +
        "Files must be uploaded separately and referenced by SHA.",
    );
  }
  return bytes;
}

function prepareFromBytes(path: string, bytes: Uint8Array): VercelPreparedFile {
  const file = path.replace(/^\/+/, "");
  return {
    file,
    bytes,
    sha: sha1Hex(bytes),
    size: bytes.byteLength,
  };
}

function prepareTextFile(path: string, content: string): VercelPreparedFile {
  return prepareFromBytes(path, utf8Bytes(content));
}

function fileToPrepared(file: PublishFile): VercelPreparedFile {
  return prepareTextFile(file.path, file.content);
}

async function assetToPrepared(
  asset: PublishAssetEntry,
  resolver: ArtifactAssetResolver,
): Promise<VercelPreparedFile | null> {
  const { source } = asset;
  if (source.type === "inline") {
    return null;
  }

  if (source.type === "storage") {
    const bytes = await resolver.downloadProjectMedia(source.storagePath);
    return prepareFromBytes(asset.path, bytes);
  }

  if (source.type === "external" && source.url) {
    const bytes = await resolver.fetchExternal(source.url);
    return prepareFromBytes(asset.path, bytes);
  }

  return null;
}

/**
 * Convert a PublishArtifact into prepared files (bytes + SHA).
 * Includes index.html, styles.css, assets/*, manifest, and vercel.json.
 */
export async function artifactToVercelPreparedFiles(
  artifact: PublishArtifact,
  resolver: ArtifactAssetResolver,
): Promise<VercelPreparedFile[]> {
  const byPath = new Map<string, VercelPreparedFile>();

  for (const file of artifact.files) {
    const entry = fileToPrepared(file);
    byPath.set(entry.file, entry);
  }

  for (const asset of artifact.assets) {
    const path = asset.path.replace(/^\/+/, "");
    if (byPath.has(path)) continue;
    const entry = await assetToPrepared(asset, resolver);
    if (entry) byPath.set(entry.file, entry);
  }

  // Always overwrite with static-site settings (never inherit Next.js).
  byPath.set(
    "vercel.json",
    prepareTextFile("vercel.json", buildStaticSiteVercelJson()),
  );

  const prepared = [...byPath.values()].sort((a, b) =>
    a.file.localeCompare(b.file),
  );
  assertNoAppSourceFiles(prepared.map((f) => f.file));
  validatePreparedFilesForUpload(prepared);
  return prepared;
}

/**
 * @deprecated Use {@link artifactToVercelPreparedFiles}. Kept name alias for imports.
 */
export async function artifactToVercelFiles(
  artifact: PublishArtifact,
  resolver: ArtifactAssetResolver,
): Promise<VercelPreparedFile[]> {
  return artifactToVercelPreparedFiles(artifact, resolver);
}
