"use client";

type ThemeOption = {
  id: string;
  label: string;
};

type ThemeSelectorProps = {
  value: string;
  options: readonly ThemeOption[];
  onChange: (value: string) => void;
};

/**
 * Light / Dark / Auto theme selector for the generated site canvas.
 */
export default function ThemeSelector({
  value,
  options,
  onChange,
}: ThemeSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Theme</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition-all duration-200 sm:text-sm ${
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
