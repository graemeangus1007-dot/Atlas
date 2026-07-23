"use client";

type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
};

/**
 * Reusable HTML color picker with hex readout for brand colors.
 */
export default function ColorPicker({
  label,
  value,
  onChange,
  description,
}: ColorPickerProps) {
  return (
    <label className="block rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase text-muted">
            {value}
          </span>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-1"
            aria-label={label}
          />
        </div>
      </div>
    </label>
  );
}
