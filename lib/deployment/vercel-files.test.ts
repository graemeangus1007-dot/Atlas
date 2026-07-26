import { describe, expect, it } from "vitest";
import {
  artifactToVercelPreparedFiles,
  assertCreateDeploymentBodyWithinLimit,
  measureCreateDeploymentBodyBytes,
  sha1Hex,
  toVercelFileReference,
  utf8Bytes,
  validatePreparedFilesForUpload,
  VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES,
  VERCEL_FILE_UPLOAD_LIMIT_BYTES,
  type ArtifactAssetResolver,
} from "@/lib/deployment/vercel-files";
import type { PublishArtifact } from "@/lib/publishing/types";

describe("vercel-files (SHA upload preparation)", () => {
  it("preserves nested asset paths and computes SHA-1 digests", async () => {
    const image = utf8Bytes("fake-image-bytes");
    const resolver: ArtifactAssetResolver = {
      downloadProjectMedia: async () => image,
      fetchExternal: async () => new Uint8Array(),
    };

    const artifact: PublishArtifact = {
      version: 1,
      slug: "demo",
      templateId: "modern",
      fingerprint: "fp",
      files: [
        {
          path: "index.html",
          content: "<html></html>",
          contentType: "text/html",
        },
      ],
      assets: [
        {
          path: "assets/gallery/0.jpg",
          role: "gallery",
          slot: 0,
          contentType: "image/jpeg",
          alt: "Gallery",
          source: {
            type: "storage",
            storagePath: "u/p/g0.jpg",
            mimeType: "image/jpeg",
          },
        },
      ],
    };

    const prepared = await artifactToVercelPreparedFiles(artifact, resolver);
    const gallery = prepared.find((f) => f.file === "assets/gallery/0.jpg");
    expect(gallery).toBeDefined();
    expect(gallery?.sha).toBe(sha1Hex(image));
    expect(gallery?.size).toBe(image.byteLength);
    expect(prepared.some((f) => f.file === "vercel.json")).toBe(true);

    const refs = prepared.map(toVercelFileReference);
    for (const ref of refs) {
      expect(Object.keys(ref).sort()).toEqual(["file", "sha", "size"]);
    }
  });

  it("rejects oversized individual files with a clear message", () => {
    expect(() =>
      validatePreparedFilesForUpload([
        {
          file: "assets/huge.bin",
          bytes: new Uint8Array(0),
          sha: "a".repeat(40),
          size: VERCEL_FILE_UPLOAD_LIMIT_BYTES + 1,
        },
      ]),
    ).toThrow(/per-file upload limit/i);
  });

  it("guards create-deployment body size at 10 MB", () => {
    const hugeRefs = Array.from({ length: 200_000 }, (_, i) => ({
      file: `assets/file-${i}.txt`,
      sha: "b".repeat(40),
      size: 1,
    }));
    const body = {
      name: "atlas-demo",
      project: "prj_test",
      files: hugeRefs,
    };
    expect(measureCreateDeploymentBodyBytes(body)).toBeGreaterThan(
      VERCEL_CREATE_DEPLOYMENT_BODY_LIMIT_BYTES,
    );
    expect(() => assertCreateDeploymentBodyWithinLimit(body)).toThrow(
      /exceeds the 10 MB limit/i,
    );
  });
});
