"use client";

import type { MediaAssetMeta } from "@/types/media";

type MediaMetadataFieldsProps = {
  value: MediaAssetMeta;
  onChange: (meta: Partial<MediaAssetMeta>) => void;
};

/**
 * Reusable title / description / alt editors for a media asset.
 */
export default function MediaMetadataFields({
  value,
  onChange,
}: MediaMetadataFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
          Title
        </span>
        <input
          type="text"
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          onBlur={(event) => onChange({ title: event.target.value.trim() })}
          aria-label="Image title"
          className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
          Description
        </span>
        <textarea
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          onBlur={(event) =>
            onChange({ description: event.target.value.trim() })
          }
          rows={2}
          aria-label="Image description"
          className="w-full resize-y rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
          Alt text
        </span>
        <input
          type="text"
          value={value.alt}
          onChange={(event) => onChange({ alt: event.target.value })}
          onBlur={(event) => onChange({ alt: event.target.value.trim() })}
          aria-label="Image alt text"
          className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
    </div>
  );
}
