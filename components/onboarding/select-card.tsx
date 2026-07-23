type SelectCardProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** When true, selection uses checkbox semantics (multi-select). */
  multi?: boolean;
};

/**
 * Selectable option card for single- or multi-select onboarding choices.
 */
export default function SelectCard({
  label,
  selected,
  onSelect,
  multi = false,
}: SelectCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
        selected
          ? "border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]"
          : "border-border bg-surface/60 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors duration-200 ${
          multi ? "rounded-md" : "rounded-full"
        } ${
          selected
            ? "border-accent bg-accent text-background"
            : "border-white/20 bg-transparent"
        }`}
        aria-hidden="true"
      >
        {selected ? (
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span
        className={`text-sm font-medium transition-colors sm:text-base ${
          selected ? "text-foreground" : "text-muted group-hover:text-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
