"use client";

import { SITE_WIDTHS, type SiteWidthId } from "@/data/design-options";

type SiteWidthSelectorProps = {
  value: SiteWidthId;
  onChange: (value: SiteWidthId) => void;
};

/**
 * Website content width — boxed, wide, or full.
 */
export default function SiteWidthSelector({
  value,
  onChange,
}: SiteWidthSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Website Width</p>
      <div className="grid grid-cols-3 gap-2">
        {SITE_WIDTHS.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={selected}
              className={`rounded-xl border px-2 py-3 text-center text-xs font-medium transition-all duration-200 ${
                selected
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-background/40 text-muted hover:border-white/15 hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
