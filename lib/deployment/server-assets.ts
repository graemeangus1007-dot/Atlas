import type { SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_MEDIA_BUCKET } from "@/lib/supabase/storage";
import type { ArtifactAssetResolver } from "@/lib/deployment/vercel-files";
import {
  SITE_PREVIEWS_BUCKET,
  type PreviewStorageGateway,
} from "@/lib/deployment/preview-paths";
import { getSupabaseEnv } from "@/lib/supabase/types";

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Server-side asset resolver using the authenticated Supabase session.
 * Downloads private project-media for Vercel (and similar) deploys.
 */
export function createServerArtifactAssetResolver(
  supabase: SupabaseClient,
): ArtifactAssetResolver {
  return {
    async downloadProjectMedia(storagePath) {
      const { data, error } = await supabase.storage
        .from(PROJECT_MEDIA_BUCKET)
        .download(storagePath);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Could not download project media.");
      return blobToUint8Array(data);
    },

    async fetchExternal(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch external asset (${response.status})`);
      }
      return blobToUint8Array(await response.blob());
    },
  };
}

/**
 * Server-side Supabase Storage gateway for legacy preview hosting.
 */
export function createServerSupabasePreviewGateway(
  supabase: SupabaseClient,
  userId: string,
): PreviewStorageGateway {
  const { url } = getSupabaseEnv();

  return {
    async getUserId() {
      return userId;
    },

    async uploadPreviewObject(objectPath, body, contentType) {
      const payload =
        typeof body === "string"
          ? new Blob([body], { type: contentType })
          : body;

      const { error } = await supabase.storage
        .from(SITE_PREVIEWS_BUCKET)
        .upload(objectPath, payload, {
          upsert: true,
          contentType,
          cacheControl: "60",
        });

      if (error) {
        const err = new Error(error.message) as Error & { statusCode?: number };
        const status = Number(
          (error as { statusCode?: string | number }).statusCode,
        );
        if (Number.isFinite(status)) err.statusCode = status;
        throw err;
      }
    },

    async downloadProjectMedia(storagePath) {
      const { data, error } = await supabase.storage
        .from(PROJECT_MEDIA_BUCKET)
        .download(storagePath);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Could not download project media.");
      return data;
    },

    async fetchExternal(targetUrl) {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        const err = new Error(
          `Failed to fetch external asset (${response.status})`,
        ) as Error & { status: number };
        err.status = response.status;
        throw err;
      }
      return response.blob();
    },

    getPublicUrl(objectPath) {
      const base = url.replace(/\/+$/, "");
      return `${base}/storage/v1/object/public/${SITE_PREVIEWS_BUCKET}/${objectPath}`;
    },

    async probePublicUrl(targetUrl) {
      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          cache: "no-store",
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
