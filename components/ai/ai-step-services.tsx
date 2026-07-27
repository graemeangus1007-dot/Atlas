"use client";

import TextArea from "@/components/ui/text-area";
import TextInput from "@/components/ui/text-input";
import type {
  AiQuestionnaireAnswers,
  AiQuestionnaireFieldErrors,
} from "@/components/ai/ai-types";

type Props = {
  answers: AiQuestionnaireAnswers;
  errors: AiQuestionnaireFieldErrors;
  onChange: <K extends keyof AiQuestionnaireAnswers>(
    key: K,
    value: AiQuestionnaireAnswers[K],
  ) => void;
};

export default function AiStepServices({ answers, errors, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Services & audience
        </h2>
        <p className="mt-2 text-sm text-muted">
          List what you offer and who you serve. One service per line is best.
        </p>
      </div>

      <TextArea
        id="ai-primary-services"
        label="Primary services"
        hint="One per line — these become your main service cards."
        value={answers.primaryServices}
        onChange={(e) => onChange("primaryServices", e.target.value)}
        required
        rows={4}
        aria-invalid={Boolean(errors.primaryServices)}
        aria-describedby={
          errors.primaryServices ? "ai-primary-services-error" : undefined
        }
      />
      {errors.primaryServices ? (
        <p
          id="ai-primary-services-error"
          className="text-sm text-red-300"
          role="alert"
        >
          {errors.primaryServices}
        </p>
      ) : null}

      <TextArea
        id="ai-secondary-services"
        label="Secondary services"
        hint="Optional extras or add-ons."
        value={answers.secondaryServices}
        onChange={(e) => onChange("secondaryServices", e.target.value)}
        rows={3}
      />

      <TextInput
        id="ai-target-customer"
        label="Target customer"
        hint="e.g. Homeowners in town, Busy professionals, Local restaurants"
        value={answers.targetCustomer}
        onChange={(e) => onChange("targetCustomer", e.target.value)}
        required
        aria-invalid={Boolean(errors.targetCustomer)}
        aria-describedby={
          errors.targetCustomer ? "ai-target-customer-error" : undefined
        }
      />
      {errors.targetCustomer ? (
        <p
          id="ai-target-customer-error"
          className="text-sm text-red-300"
          role="alert"
        >
          {errors.targetCustomer}
        </p>
      ) : null}

      <TextInput
        id="ai-service-area"
        label="Service area"
        hint="e.g. Austin metro, Nationwide, Downtown Seattle"
        value={answers.serviceArea}
        onChange={(e) => onChange("serviceArea", e.target.value)}
        required
        aria-invalid={Boolean(errors.serviceArea)}
        aria-describedby={
          errors.serviceArea ? "ai-service-area-error" : undefined
        }
      />
      {errors.serviceArea ? (
        <p
          id="ai-service-area-error"
          className="text-sm text-red-300"
          role="alert"
        >
          {errors.serviceArea}
        </p>
      ) : null}
    </div>
  );
}
