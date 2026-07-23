import SelectCard from "@/components/onboarding/select-card";
import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import {
  BUSINESS_TYPES,
  type BusinessType,
} from "@/components/onboarding/types";

type BusinessTypeStepProps = {
  value: BusinessType | "";
  onChange: (value: BusinessType) => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * Step 2 — Business Type (single-select cards)
 */
export default function BusinessTypeStep({
  value,
  onChange,
  onBack,
  onNext,
}: BusinessTypeStepProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepHeader
        title="What type of business is this?"
        description="Pick the closest match. We’ll tailor layouts, sections, and suggestions to your industry."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {BUSINESS_TYPES.map((type) => (
          <SelectCard
            key={type}
            label={type}
            selected={value === type}
            onSelect={() => onChange(type)}
          />
        ))}
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!value}
      />
    </div>
  );
}
