"use client";

type FontOption = {
  id: string;
  label: string;
  cssVar: string;
};

type FontSelectorProps = {
  label: string;
  value: string;
  options: readonly FontOption[];
  onChange: (value: string) => void;
};

/**
 * Font family selector for heading or body typography.
 */
export default function FontSelector({
  label,
  value,
  options,
  onChange,
}: FontSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="grid gap-2">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                selected
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-background/40 text-muted hover:border-white/15 hover:text-foreground"
              }`}
              style={{ fontFamily: option.cssVar }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
