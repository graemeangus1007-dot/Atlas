"use client";

import {
  AI_QUESTIONNAIRE_STEPS,
  AI_STEP_LABELS,
  type AiQuestionnaireStepId,
} from "@/components/ai/ai-types";

type AiProgressProps = {
  stepIndex: number;
};

/**
 * Named step progress for the AI questionnaire wizard.
 */
export default function AiProgress({ stepIndex }: AiProgressProps) {
  const clamped = Math.min(
    Math.max(stepIndex, 0),
    AI_QUESTIONNAIRE_STEPS.length - 1,
  );
  const current = AI_QUESTIONNAIRE_STEPS[clamped] as AiQuestionnaireStepId;
  const percent = Math.round(
    ((clamped + 1) / AI_QUESTIONNAIRE_STEPS.length) * 100,
  );

  return (
    <div className="w-full space-y-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-foreground">
          Step {clamped + 1} of {AI_QUESTIONNAIRE_STEPS.length}:{" "}
          {AI_STEP_LABELS[current]}
        </span>
        <span className="text-muted">{percent}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="hidden gap-2 sm:flex" aria-label="Questionnaire steps">
        {AI_QUESTIONNAIRE_STEPS.map((id, index) => {
          const done = index < clamped;
          const active = index === clamped;
          return (
            <li
              key={id}
              className={`rounded-lg px-2 py-1 text-xs ${
                active
                  ? "bg-accent-soft font-medium text-foreground"
                  : done
                    ? "text-accent"
                    : "text-muted"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {AI_STEP_LABELS[id]}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
