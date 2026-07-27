"use client";

import {
  AI_TONE_LABELS,
  type AiQuestionnaireAnswers,
} from "@/components/ai/ai-types";

type Props = {
  answers: AiQuestionnaireAnswers;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-sm text-foreground">
        {value.trim() || "—"}
      </dd>
    </div>
  );
}

/**
 * Read-only summary of all questionnaire answers before generation.
 */
export default function AiStepReview({ answers }: Props) {
  const toneLabel =
    answers.tone && answers.tone in AI_TONE_LABELS
      ? AI_TONE_LABELS[answers.tone]
      : answers.tone;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Review
        </h2>
        <p className="mt-2 text-sm text-muted">
          Confirm everything looks right. You can go back to edit any step.
        </p>
      </div>

      <section aria-labelledby="ai-review-business">
        <h3
          id="ai-review-business"
          className="text-sm font-semibold text-foreground"
        >
          Business
        </h3>
        <dl>
          <Row label="Name" value={answers.businessName} />
          <Row label="Industry" value={answers.industry} />
          <Row label="Description" value={answers.oneSentenceDescription} />
          <Row label="Years" value={answers.yearsInBusiness} />
        </dl>
      </section>

      <section aria-labelledby="ai-review-services">
        <h3
          id="ai-review-services"
          className="text-sm font-semibold text-foreground"
        >
          Services
        </h3>
        <dl>
          <Row label="Primary" value={answers.primaryServices} />
          <Row label="Secondary" value={answers.secondaryServices} />
          <Row label="Customer" value={answers.targetCustomer} />
          <Row label="Area" value={answers.serviceArea} />
        </dl>
      </section>

      <section aria-labelledby="ai-review-branding">
        <h3
          id="ai-review-branding"
          className="text-sm font-semibold text-foreground"
        >
          Branding
        </h3>
        <dl>
          <Row label="Tone" value={toneLabel || ""} />
          <Row label="Primary" value={answers.primaryColor} />
          <Row label="Accent" value={answers.accentColor} />
          <Row label="Logo" value="Upload later" />
        </dl>
      </section>

      <section aria-labelledby="ai-review-contact">
        <h3
          id="ai-review-contact"
          className="text-sm font-semibold text-foreground"
        >
          Contact
        </h3>
        <dl>
          <Row label="Phone" value={answers.phone} />
          <Row label="Email" value={answers.email} />
          <Row label="Address" value={answers.address} />
          <Row label="Website" value={answers.website} />
          <Row label="Facebook" value={answers.facebook} />
          <Row label="Instagram" value={answers.instagram} />
        </dl>
      </section>
    </div>
  );
}
