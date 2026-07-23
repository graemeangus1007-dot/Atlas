type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

/**
 * Metric tile for dashboard overview stats.
 */
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface/60 p-5 transition-colors duration-200 hover:border-white/15 hover:bg-surface">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}
