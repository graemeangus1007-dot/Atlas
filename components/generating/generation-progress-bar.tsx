type GenerationProgressBarProps = {
  progress: number;
};

/**
 * Large percentage + fill bar for the website generation experience.
 */
export default function GenerationProgressBar({
  progress,
}: GenerationProgressBarProps) {
  const display = Math.round(Math.min(100, Math.max(0, progress)));

  return (
    <div className="w-full" role="progressbar" aria-valuenow={display} aria-valuemin={0} aria-valuemax={100}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <span className="text-sm font-medium text-muted">Progress</span>
        <span className="font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {display}%
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="atlas-progress-glow h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
          style={{ width: `${display}%` }}
        />
      </div>
    </div>
  );
}
