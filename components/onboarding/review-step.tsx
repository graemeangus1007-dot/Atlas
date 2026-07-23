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
 * Final review — persist project then trigger website generation.
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
    <div className="mx-auto w-full max-w-xl">
      <StepHeader
        title="Review your details"
        description="Make sure everything looks right. You can go back to edit any step before generating."
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

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <StepNav
        onBack={onBack}
        onNext={onGenerate}
        nextLabel={isSubmitting ? "Saving…" : "Generate My Website"}
        nextDisabled={isSubmitting}
      />
    </div>
  );
}
