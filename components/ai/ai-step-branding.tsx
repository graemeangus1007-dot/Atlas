"use client";

import { useMemo } from "react";
import {
  AI_BRAND_TONES,
  AI_TONE_LABELS,
  type AiBrandTone,
  type AiQuestionnaireAnswers,
  type AiQuestionnaireFieldErrors,
} from "@/components/ai/ai-types";
import TextInput from "@/components/ui/text-input";
import { validateBrandContrast } from "@/lib/ai/contrast";
import { layoutPresetFromTone } from "@/lib/ai/layout-presets";

type Props = {
  answers: AiQuestionnaireAnswers;
  errors: AiQuestionnaireFieldErrors;
  onChange: <K extends keyof AiQuestionnaireAnswers>(
    key: K,
    value: AiQuestionnaireAnswers[K],
  ) => void;
};

export default function AiStepBranding({ answers, errors, onChange }: Props) {
  const contrastWarnings = useMemo(() => {
    if (
      !/^#([0-9a-fA-F]{6})$/.test(answers.primaryColor) ||
      !/^#([0-9a-fA-F]{6})$/.test(answers.accentColor)
    ) {
      return [];
    }
    const preset = layoutPresetFromTone(answers.tone || "professional");
    return validateBrandContrast({
      primaryColor: answers.primaryColor,
      accentColor: answers.accentColor,
      backgroundColor: preset.backgroundColor,
    });
  }, [answers.accentColor, answers.primaryColor, answers.tone]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Branding
        </h2>
        <p className="mt-2 text-sm text-muted">
          Choose a tone and colors. Logo upload comes in a later sprint.
        </p>
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-medium text-muted">Tone</legend>
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
          aria-required="true"
          aria-invalid={Boolean(errors.tone)}
          aria-describedby={errors.tone ? "ai-tone-error" : undefined}
        >
          {AI_BRAND_TONES.map((tone) => {
            const selected = answers.tone === tone;
            return (
              <label
                key={tone}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft text-foreground"
                    : "border-border text-muted hover:border-accent/40 hover:text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="ai-brand-tone"
                  value={tone}
                  checked={selected}
                  onChange={() => onChange("tone", tone as AiBrandTone)}
                  className="accent-[var(--accent)]"
                />
                {AI_TONE_LABELS[tone]}
              </label>
            );
          })}
        </div>
        {errors.tone ? (
          <p id="ai-tone-error" className="mt-2 text-sm text-red-300" role="alert">
            {errors.tone}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <TextInput
            id="ai-primary-color"
            label="Primary color"
            type="text"
            value={answers.primaryColor}
            onChange={(e) => onChange("primaryColor", e.target.value)}
            required
            aria-invalid={Boolean(errors.primaryColor)}
            aria-describedby={
              errors.primaryColor ? "ai-primary-color-error" : undefined
            }
          />
          <input
            type="color"
            aria-label="Pick primary color"
            className="mt-3 h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent"
            value={
              /^#([0-9a-fA-F]{6})$/.test(answers.primaryColor)
                ? answers.primaryColor
                : "#3db8a8"
            }
            onChange={(e) => onChange("primaryColor", e.target.value)}
          />
          {errors.primaryColor ? (
            <p
              id="ai-primary-color-error"
              className="mt-2 text-sm text-red-300"
              role="alert"
            >
              {errors.primaryColor}
            </p>
          ) : null}
        </div>

        <div>
          <TextInput
            id="ai-accent-color"
            label="Accent color"
            type="text"
            value={answers.accentColor}
            onChange={(e) => onChange("accentColor", e.target.value)}
            required
            aria-invalid={Boolean(errors.accentColor)}
            aria-describedby={
              errors.accentColor ? "ai-accent-color-error" : undefined
            }
          />
          <input
            type="color"
            aria-label="Pick accent color"
            className="mt-3 h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent"
            value={
              /^#([0-9a-fA-F]{6})$/.test(answers.accentColor)
                ? answers.accentColor
                : "#0e1218"
            }
            onChange={(e) => onChange("accentColor", e.target.value)}
          />
          {errors.accentColor ? (
            <p
              id="ai-accent-color-error"
              className="mt-2 text-sm text-red-300"
              role="alert"
            >
              {errors.accentColor}
            </p>
          ) : null}
        </div>
      </div>

      {contrastWarnings.length > 0 ? (
        <div
          className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
          role="status"
        >
          <p className="text-sm font-medium text-amber-100">
            Accessibility contrast warnings
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100/90">
            {contrastWarnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.message} (ratio {warning.ratio}:1, need{" "}
                {warning.minimum}:1)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-5 py-6">
        <p className="text-sm font-medium text-foreground">Logo upload</p>
        <p className="mt-1 text-sm text-muted">
          Placeholder for now — logo upload arrives in a later sprint. You can
          continue without a logo.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm text-muted opacity-60"
          aria-disabled="true"
        >
          Upload logo (coming soon)
        </button>
      </div>
    </div>
  );
}
