"use client";

import { HERO_OVERLAY_STEPS } from "@/data/design-options";

type OverlaySliderProps = {
  value: number;
  onChange: (value: number) => void;
};

/**
 * Hero overlay darkness control — snaps to Brand Studio steps.
 */
export default function OverlaySlider({ value, onChange }: OverlaySliderProps) {
  const nearest = HERO_OVERLAY_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Overlay Darkness</p>
        <span className="font-mono text-xs text-muted" aria-live="polite">
          {nearest}%
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={25}
        value={nearest}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Hero overlay darkness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={nearest}
        aria-valuetext={`${nearest} percent`}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-[color:var(--accent,#3db8a8)]"
      />

      <div className="mt-2 flex justify-between text-[10px] text-muted">
        {HERO_OVERLAY_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            className={`rounded px-1 py-0.5 transition-colors ${
              nearest === step
                ? "text-foreground"
                : "hover:text-foreground"
            }`}
            aria-label={`Set overlay to ${step}%`}
          >
            {step}%
          </button>
        ))}
      </div>
    </div>
  );
}
