import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import TextArea from "@/components/ui/text-area";

type BusinessDescriptionStepProps = {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * Step 3 — Business Description
 */
export default function BusinessDescriptionStep({
  value,
  onChange,
  onBack,
  onNext,
}: BusinessDescriptionStepProps) {
  const canContinue = value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-xl">
      <StepHeader
        title="Tell us about your business"
        description="A short description helps Atlas write better homepage copy and choose the right sections."
      />

      <TextArea
        id="business-description"
        label="Business description"
        placeholder="Describe your business in a few sentences..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus
      />

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canContinue}
      />
    </div>
  );
}
