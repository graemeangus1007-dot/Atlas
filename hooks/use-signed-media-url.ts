"use client";

import { useEffect, useState } from "react";
import {
  getProjectMediaUrl,
  PROJECT_MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS,
  PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS,
} from "@/lib/supabase/storage";

type UseSignedMediaUrlOptions = {
  storagePath?: string | null;
  url?: string | null;
  urlExpiresAt?: number | null;
};

function needsRefresh(
  storagePath: string | null,
  url: string | null,
  urlExpiresAt: number | null,
): boolean {
  if (!storagePath) return false;
  if (!url) return true;
  if (urlExpiresAt == null) return true;
  return Date.now() >= urlExpiresAt;
}

/**
 * Keep a private project-media display URL fresh via createSignedUrl.
 * storagePath is durable; url is ephemeral and refreshed before expiry.
 */
export function useSignedMediaUrl({
  storagePath = null,
  url = null,
  urlExpiresAt = null,
}: UseSignedMediaUrlOptions): string | null {
  const [displayUrl, setDisplayUrl] = useState<string | null>(url);

  useEffect(() => {
    setDisplayUrl(url);
  }, [url, storagePath]);

  useEffect(() => {
    const path = storagePath?.trim() || null;
    if (!path) return;

    let cancelled = false;
    let timer: number | null = null;

    async function refresh() {
      const result = await getProjectMediaUrl(path!);
      if (cancelled || !result.ok) return;
      setDisplayUrl(result.data);
      const nextInMs =
        (PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS -
          PROJECT_MEDIA_SIGNED_URL_REFRESH_BUFFER_SECONDS) *
        1000;
      timer = window.setTimeout(() => {
        void refresh();
      }, Math.max(30_000, nextInMs));
    }

    if (needsRefresh(path, url, urlExpiresAt)) {
      void refresh();
    } else if (urlExpiresAt != null) {
      const delay = Math.max(0, urlExpiresAt - Date.now());
      timer = window.setTimeout(() => {
        void refresh();
      }, delay);
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [storagePath, url, urlExpiresAt]);

  return displayUrl;
}
