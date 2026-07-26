import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/types";
import {
  PROJECT_MEDIA_BUCKET,
  SITE_PREVIEWS_BUCKET,
  type PreviewStorageGateway,
} from "@/lib/deployment/preview-paths";

/**
 * Browser Supabase gateway for preview uploads.
 * Uses the publishable/anon client only (never the service-role key).
 */
export function createSupabasePreviewGateway(): PreviewStorageGateway {
  return {
    async getUserId() {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user?.id ?? null;
    },

    async uploadPreviewObject(objectPath, body, contentType) {
      const supabase = createClient();
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
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(PROJECT_MEDIA_BUCKET)
        .download(storagePath);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Could not download project media.");
      return data;
    },

    async fetchExternal(url) {
      const response = await fetch(url);
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
      const { url } = getSupabaseEnv();
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
