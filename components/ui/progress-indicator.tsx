type ProgressIndicatorProps = {
  currentStep: number;
  totalSteps: number;
  label?: string;
};

/**
 * Top-of-flow progress bar for multi-step experiences.
 * Visually communicates position without requiring step labels yet.
 */
export default function ProgressIndicator({
  currentStep,
  totalSteps,
  label,
}: ProgressIndicatorProps) {
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const percent = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className="w-full" role="status" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-foreground">
          {label ?? `Step ${clampedStep} of ${totalSteps}`}
        </span>
        <span className="text-muted">{percent}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
