"use client";

import StepHeader from "@/components/onboarding/step-header";
import StepNav from "@/components/onboarding/step-nav";
import { listTemplates } from "@/lib/templates";
import type { TemplateId } from "@/lib/templates";

type ChooseStyleStepProps = {
  value: TemplateId | "";
  onChange: (value: TemplateId) => void;
  onBack: () => void;
  onNext: () => void;
};

/**
 * Onboarding — Choose Your Style (layout template).
 */
export default function ChooseStyleStep({
  value,
  onChange,
  onBack,
  onNext,
}: ChooseStyleStepProps) {
  const templates = listTemplates();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepHeader
        title="Choose Your Style"
        description="Pick a layout template. You can refine colors and details later in Design."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => {
          const selected = value === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              aria-pressed={selected}
              className={`overflow-hidden rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selected
                  ? "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_rgba(61,184,168,0.35)]"
                  : "border-border bg-surface/50 hover:border-white/20"
              }`}
            >
              <div
                className="flex h-28 items-end bg-gradient-to-br from-[color:var(--accent)]/25 via-surface to-background px-4 py-3"
                aria-hidden="true"
              >
                <span className="rounded-md border border-white/10 bg-background/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted backdrop-blur">
                  {template.thumbnailLabel}
                </span>
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  {template.label}
                </p>
                <p className="text-xs leading-relaxed text-muted">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!value} />
    </div>
  );
}
