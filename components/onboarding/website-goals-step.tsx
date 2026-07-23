import SelectCard from "@/components/onboarding/select-card";
import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import {
  WEBSITE_GOALS,
  type WebsiteGoal,
} from "@/components/onboarding/types";

type WebsiteGoalsStepProps = {
  values: WebsiteGoal[];
  onChange: (values: WebsiteGoal[]) => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * Step 4 — Website Goals (multi-select cards)
 */
export default function WebsiteGoalsStep({
  values,
  onChange,
  onBack,
  onNext,
}: WebsiteGoalsStepProps) {
  function toggleGoal(goal: WebsiteGoal) {
    if (values.includes(goal)) {
      onChange(values.filter((item) => item !== goal));
      return;
    }
    onChange([...values, goal]);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepHeader
        title="What should your website help you do?"
        description="Select all that apply. Atlas will prioritize features that match your goals."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {WEBSITE_GOALS.map((goal) => (
          <SelectCard
            key={goal}
            label={goal}
            selected={values.includes(goal)}
            onSelect={() => toggleGoal(goal)}
            multi
          />
        ))}
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={values.length === 0}
      />
    </div>
  );
}
