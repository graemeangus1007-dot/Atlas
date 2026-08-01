import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import type { OnboardingData } from "@/components/onboarding/types";

type ReviewStepProps = {
  data: OnboardingData;
  onBack: () => void;
  onGenerate: () => void;
  isSubmitting?: boolean;
  error?: string | null;
};

type ReviewRowProps = {
  label: string;
  value: string;
};

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-base leading-relaxed text-foreground whitespace-pre-wrap">
        {value}
      </dd>
    </div>
  );
}

/**
 * Final review — create the site, then open the editor with Atlas.
 */
export default function ReviewStep({
  data,
  onBack,
  onGenerate,
  isSubmitting = false,
  error = null,
}: ReviewStepProps) {
  const styleLabel = data.templateId
    ? data.templateId.charAt(0).toUpperCase() + data.templateId.slice(1)
    : "—";

  return (
    <div className="mx-auto w-full max-w-xl" aria-busy={isSubmitting}>
      <StepHeader
        title="Review your details"
        description="Make sure everything looks right. We’ll open your site in the editor with Atlas ready."
      />

      <dl className="rounded-2xl border border-border bg-surface/60 px-5 sm:px-6">
        <ReviewRow label="Business Name" value={data.businessName} />
        <ReviewRow label="Business Type" value={data.businessType || "—"} />
        <ReviewRow label="Description" value={data.description} />
        <ReviewRow
          label="Website Goals"
          value={data.goals.length > 0 ? data.goals.join(" · ") : "—"}
        />
        <ReviewRow label="Style" value={styleLabel} />
      </dl>

      {isSubmitting ? (
        <div
          className="mt-4 flex items-center gap-3 rounded-xl border border-border/80 bg-surface/40 px-4 py-3 text-sm text-muted"
          role="status"
        >
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
            aria-hidden="true"
          />
          Creating your site…
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <StepNav
        onBack={isSubmitting ? undefined : onBack}
        showBack={!isSubmitting}
        onNext={onGenerate}
        nextLabel={isSubmitting ? "Creating your site…" : "Open in Editor"}
        nextDisabled={isSubmitting}
      />
    </div>
  );
}
