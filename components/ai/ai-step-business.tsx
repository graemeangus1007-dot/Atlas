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

export default function AiStepBusiness({ answers, errors, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          About your business
        </h2>
        <p className="mt-2 text-sm text-muted">
          Tell Atlas who you are so we can write accurate website copy.
        </p>
      </div>

      <TextInput
        id="ai-business-name"
        label="Business name"
        value={answers.businessName}
        onChange={(e) => onChange("businessName", e.target.value)}
        required
        aria-invalid={Boolean(errors.businessName)}
        aria-describedby={
          errors.businessName ? "ai-business-name-error" : undefined
        }
        autoComplete="organization"
      />
      {errors.businessName ? (
        <p id="ai-business-name-error" className="text-sm text-red-300" role="alert">
          {errors.businessName}
        </p>
      ) : null}

      <TextInput
        id="ai-industry"
        label="Industry"
        hint="e.g. Coffee Shop, Landscaping, Dental Clinic"
        value={answers.industry}
        onChange={(e) => onChange("industry", e.target.value)}
        required
        aria-invalid={Boolean(errors.industry)}
        aria-describedby={errors.industry ? "ai-industry-error" : undefined}
      />
      {errors.industry ? (
        <p id="ai-industry-error" className="text-sm text-red-300" role="alert">
          {errors.industry}
        </p>
      ) : null}

      <TextArea
        id="ai-one-sentence"
        label="One-sentence description"
        hint="What do you do, for whom, and why it matters?"
        value={answers.oneSentenceDescription}
        onChange={(e) => onChange("oneSentenceDescription", e.target.value)}
        required
        rows={3}
        aria-invalid={Boolean(errors.oneSentenceDescription)}
        aria-describedby={
          errors.oneSentenceDescription ? "ai-one-sentence-error" : undefined
        }
      />
      {errors.oneSentenceDescription ? (
        <p
          id="ai-one-sentence-error"
          className="text-sm text-red-300"
          role="alert"
        >
          {errors.oneSentenceDescription}
        </p>
      ) : null}

      <TextInput
        id="ai-years"
        label="Years in business"
        hint="e.g. 5 years, Since 2018, New this year"
        value={answers.yearsInBusiness}
        onChange={(e) => onChange("yearsInBusiness", e.target.value)}
        required
        aria-invalid={Boolean(errors.yearsInBusiness)}
        aria-describedby={
          errors.yearsInBusiness ? "ai-years-error" : undefined
        }
      />
      {errors.yearsInBusiness ? (
        <p id="ai-years-error" className="text-sm text-red-300" role="alert">
          {errors.yearsInBusiness}
        </p>
      ) : null}
    </div>
  );
}
