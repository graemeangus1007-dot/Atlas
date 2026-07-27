"use client";

import type {
  AiQuestionnaireAnswers,
  AiQuestionnaireFieldErrors,
} from "@/components/ai/ai-types";
import {
  AI_OPTIONAL_SECTION_IDS,
  AI_OPTIONAL_SECTION_LABELS,
  type AiOptionalSectionId,
} from "@/lib/ai/optional-sections";

type Props = {
  answers: AiQuestionnaireAnswers;
  errors: AiQuestionnaireFieldErrors;
  onChange: <K extends keyof AiQuestionnaireAnswers>(
    key: K,
    value: AiQuestionnaireAnswers[K],
  ) => void;
};

/**
 * Toggle optional website sections included in the AI draft.
 */
export default function AiStepSections({ answers, onChange }: Props) {
  function toggle(id: AiOptionalSectionId) {
    onChange("optionalSections", {
      ...answers.optionalSections,
      [id]: !answers.optionalSections[id],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Optional sections
        </h2>
        <p className="mt-2 text-sm text-muted">
          Choose which extra sections to include. Only selected sections appear
          in your generated website draft.
        </p>
      </div>

      <ul className="space-y-2">
        {AI_OPTIONAL_SECTION_IDS.map((id) => {
          const checked = Boolean(answers.optionalSections[id]);
          return (
            <li key={id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  checked
                    ? "border-accent bg-accent-soft text-foreground"
                    : "border-border text-muted hover:border-accent/40 hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                  className="accent-[var(--accent)]"
                />
                {AI_OPTIONAL_SECTION_LABELS[id]}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
