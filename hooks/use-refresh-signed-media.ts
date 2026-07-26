"use client";

import { useEffect, useRef } from "react";
import {
  hydrateMediaLibrary,
  mediaAssetNeedsSignedUrlRefresh,
} from "@/lib/supabase/storage";
import type { MediaAsset } from "@/types/media";

/**
 * Periodically re-sign private media URLs in the active project library.
 * Calls onRefresh only when signed URLs actually change.
 * Does not mark the project dirty for autosave — caller should patch quietly.
 */
export function useRefreshSignedMediaLibrary(
  mediaLibrary: MediaAsset[],
  onRefresh: (next: MediaAsset[]) => void,
): void {
  const onRefreshRef = useRef(onRefresh);
  const libraryRef = useRef(mediaLibrary);
  const pathsKey = mediaLibrary
    .map((asset) => `${asset.id}:${asset.storagePath ?? ""}`)
    .join("|");

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    libraryRef.current = mediaLibrary;
  }, [mediaLibrary]);

  useEffect(() => {
    if (!pathsKey) return;

    let cancelled = false;
    let timer: number | null = null;

    async function refreshNow() {
      const current = libraryRef.current;
      const next = await hydrateMediaLibrary(current);
      if (cancelled) return;

      const changed = next.some((asset, index) => {
        const prev = current[index];
        return (
          !prev ||
          prev.id !== asset.id ||
          prev.url !== asset.url ||
          prev.urlExpiresAt !== asset.urlExpiresAt ||
          prev.unavailable !== asset.unavailable
        );
      });

      if (changed) {
        onRefreshRef.current(next);
      }

      schedule(next);
    }

    function schedule(assets: MediaAsset[]) {
      if (timer !== null) window.clearTimeout(timer);

      const refreshable = assets.filter((asset) => asset.storagePath);
      if (refreshable.length === 0) return;

      if (refreshable.some(mediaAssetNeedsSignedUrlRefresh)) {
        timer = window.setTimeout(() => {
          void refreshNow();
        }, 250);
        return;
      }

      const soonest = Math.min(
        ...refreshable.map((asset) => asset.urlExpiresAt ?? Date.now()),
      );
      const delay = Math.max(5_000, soonest - Date.now());
      timer = window.setTimeout(() => {
        void refreshNow();
      }, delay);
    }

    schedule(libraryRef.current);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
    // Re-arm when durable media identity changes (upload / replace / delete).
  }, [pathsKey]);
}
