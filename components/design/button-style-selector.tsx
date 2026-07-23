"use client";

import { BUTTON_STYLES, type ButtonStyleId } from "@/data/design-options";

type ButtonStyleOption = {
  id: string;
  label: string;
  radius?: string;
};

type ButtonStyleSelectorProps = {
  value: string;
  options?: readonly ButtonStyleOption[];
  onChange: (value: string) => void;
};

/**
 * Button corner-radius style selector for the generated site.
 */
export default function ButtonStyleSelector({
  value,
  options = BUTTON_STYLES,
  onChange,
}: ButtonStyleSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Button Styles</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = option.id === value;
          const radius =
            option.radius ??
            BUTTON_STYLES.find((item) => item.id === option.id)?.radius ??
            "0.75rem";

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id as ButtonStyleId)}
              aria-pressed={selected}
              className={`border px-2 py-3 text-center text-xs font-medium transition-all duration-200 sm:text-sm ${
                selected
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-background/40 text-muted hover:border-white/15 hover:text-foreground"
              }`}
              style={{ borderRadius: radius }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
