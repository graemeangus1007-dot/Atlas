import { GENERATION_STEPS } from "@/data/generation-steps";

type GenerationStepsListProps = {
  /** Number of fully completed steps (0 … GENERATION_STEPS.length). */
  completedCount: number;
};

/**
 * Animated checklist of generation milestones.
 */
export default function GenerationStepsList({
  completedCount,
}: GenerationStepsListProps) {
  return (
    <ol className="mx-auto mt-10 w-full max-w-md space-y-3 text-left">
      {GENERATION_STEPS.map((label, index) => {
        const isComplete = index < completedCount;
        const isActive =
          index === completedCount && completedCount < GENERATION_STEPS.length;

        return (
          <li
            key={label}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
              isComplete
                ? "border-accent/40 bg-accent-soft text-foreground"
                : isActive
                  ? "border-border bg-surface text-foreground shadow-[0_0_0_1px_rgba(61,184,168,0.2)]"
                  : "border-transparent bg-transparent text-muted/50"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-all duration-300 ${
                isComplete
                  ? "bg-accent text-background"
                  : isActive
                    ? "border border-accent/50 text-accent atlas-pulse"
                    : "border border-white/10 text-transparent"
              }`}
              aria-hidden="true"
            >
              {isComplete ? "✓" : isActive ? "…" : ""}
            </span>
            <span
              className={`text-sm font-medium sm:text-base ${
                isComplete || isActive ? "text-foreground" : ""
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
