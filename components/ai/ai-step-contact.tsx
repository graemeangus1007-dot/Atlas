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

export default function AiStepContact({ answers, errors, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Contact details
        </h2>
        <p className="mt-2 text-sm text-muted">
          Visitors will use these details on your published site.
        </p>
      </div>

      <TextInput
        id="ai-phone"
        label="Phone"
        type="tel"
        value={answers.phone}
        onChange={(e) => onChange("phone", e.target.value)}
        required
        autoComplete="tel"
        aria-invalid={Boolean(errors.phone)}
        aria-describedby={errors.phone ? "ai-phone-error" : undefined}
      />
      {errors.phone ? (
        <p id="ai-phone-error" className="text-sm text-red-300" role="alert">
          {errors.phone}
        </p>
      ) : null}

      <TextInput
        id="ai-email"
        label="Email"
        type="email"
        value={answers.email}
        onChange={(e) => onChange("email", e.target.value)}
        required
        autoComplete="email"
        aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? "ai-email-error" : undefined}
      />
      {errors.email ? (
        <p id="ai-email-error" className="text-sm text-red-300" role="alert">
          {errors.email}
        </p>
      ) : null}

      <TextArea
        id="ai-address"
        label="Address"
        value={answers.address}
        onChange={(e) => onChange("address", e.target.value)}
        required
        rows={3}
        autoComplete="street-address"
        aria-invalid={Boolean(errors.address)}
        aria-describedby={errors.address ? "ai-address-error" : undefined}
      />
      {errors.address ? (
        <p id="ai-address-error" className="text-sm text-red-300" role="alert">
          {errors.address}
        </p>
      ) : null}

      <TextInput
        id="ai-website"
        label="Website (optional)"
        type="url"
        placeholder="https://"
        value={answers.website}
        onChange={(e) => onChange("website", e.target.value)}
        autoComplete="url"
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextInput
          id="ai-facebook"
          label="Facebook"
          hint="Page URL or handle"
          value={answers.facebook}
          onChange={(e) => onChange("facebook", e.target.value)}
        />
        <TextInput
          id="ai-instagram"
          label="Instagram"
          hint="Profile URL or @handle"
          value={answers.instagram}
          onChange={(e) => onChange("instagram", e.target.value)}
        />
      </div>
    </div>
  );
}
