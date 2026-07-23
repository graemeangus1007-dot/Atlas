import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import TextInput from "@/components/ui/text-input";

type BusinessNameStepProps = {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
};

/**
 * Step 1 — Business Name
 */
export default function BusinessNameStep({
  value,
  onChange,
  onNext,
}: BusinessNameStepProps) {
  const canContinue = value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-xl">
      <StepHeader
        title="What is the name of your business?"
        description="Atlas will use this to personalize your website — from the header to the tone of your copy."
      />

      <TextInput
        id="business-name"
        label="Business Name"
        placeholder="e.g. Riverview Bakery"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && canContinue) {
            event.preventDefault();
            onNext();
          }
        }}
        autoFocus
        autoComplete="organization"
      />

      <StepNav showBack={false} onNext={onNext} nextDisabled={!canContinue} />
    </div>
  );
}
