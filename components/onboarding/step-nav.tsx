import Button from "@/components/ui/button";

type StepNavProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
};

/**
 * Shared Previous / Next footer for onboarding steps.
 */
export default function StepNav({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  showBack = true,
}: StepNavProps) {
  return (
    <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {showBack && onBack ? (
        <Button type="button" variant="secondary" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}

      {onNext ? (
        <Button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="w-full px-8 sm:w-auto"
        >
          {nextLabel}
        </Button>
      ) : null}
    </div>
  );
}
