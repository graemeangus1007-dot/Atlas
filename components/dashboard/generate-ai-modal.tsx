"use client";

import { useEffect, useState } from "react";
import AiSuggestionCard from "@/components/editor/ai-suggestion-card";
import Button from "@/components/ui/button";
import { generateSuggestions } from "@/lib/ai";
import {
  applyAiFieldValue,
  createAiHistoryEntry,
  readAiFieldValue,
} from "@/lib/ai/apply-ai-field";
import { useProject } from "@/context/project-context";
import type { AiContentField, AiHistoryEntry } from "@/types/ai";

const FIELD_OPTIONS: { field: AiContentField; label: string }[] = [
  { field: "heroHeadline", label: "Hero Headline" },
  { field: "heroSubheadline", label: "Hero Subheadline" },
  { field: "description", label: "About Section" },
  { field: "primaryCta", label: "Call-to-Action" },
];

type GenerateAiModalProps = {
  open: boolean;
  onClose: () => void;
  /** Content field to target when the modal opens (from dashboard cards / quick actions). */
  initialField?: AiContentField;
};

/**
 * Dashboard Atlas AI modal — mock suggestions that write into BusinessProject.
 */
export default function GenerateAiModal({
  open,
  onClose,
  initialField = "heroHeadline",
}: GenerateAiModalProps) {
  const { project, setProject } = useProject();
  const [field, setField] = useState<AiContentField>(initialField);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const [aiHistory, setAiHistory] = useState<AiHistoryEntry | null>(null);

  const originalValue = readAiFieldValue(project, field);
  const displayValue = previewValue ?? originalValue;
  const fieldLabel =
    FIELD_OPTIONS.find((option) => option.field === field)?.label ?? "Content";

  // Sync the selected field whenever the modal is opened from a dashboard action.
  useEffect(() => {
    if (open) {
      setField(initialField);
    }
  }, [open, initialField]);

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setPreviewIndex(null);
      setPreviewValue(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setPreviewIndex(null);
    setPreviewValue(null);

    const currentValue = readAiFieldValue(project, field);

    // ~1s mock “thinking” delay before suggestions appear.
    const timer = window.setTimeout(() => {
      generateSuggestions({
        field,
        currentValue,
        businessName: project.businessName,
        businessType: project.businessType || "Other",
      })
        .then((result) => {
          if (!cancelled) setSuggestions([...result.suggestions]);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load suggestions. Try again.");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally re-run when the modal opens or the target field changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field]);

  function handlePreview(index: number, value: string) {
    setPreviewIndex(index);
    setPreviewValue(value);
  }

  function handleApply(value: string) {
    setAiHistory(createAiHistoryEntry(project, field));
    setProject(applyAiFieldValue(project, field, value));
    setPreviewIndex(null);
    setPreviewValue(null);
    // Stay open so Undo AI Change is available immediately after apply.
  }

  function handleKeepOriginal() {
    setPreviewIndex(null);
    setPreviewValue(null);
    onClose();
  }

  function handleUndo() {
    if (!aiHistory) return;
    setProject(
      applyAiFieldValue(
        project,
        aiHistory.field,
        aiHistory.previousValue,
        aiHistory.serviceIndex,
      ),
    );
    setAiHistory(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close AI panel"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-ai-title"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2
              id="generate-ai-title"
              className="font-[family-name:var(--font-atlas-display)] text-base font-semibold text-foreground"
            >
              Atlas AI Copywriter
            </h2>
            <p className="text-xs text-muted">Mock suggestions · updates live</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Improve
            </p>
            <div className="flex flex-wrap gap-2">
              {FIELD_OPTIONS.map((option) => {
                const selected = option.field === field;
                return (
                  <button
                    key={option.field}
                    type="button"
                    onClick={() => setField(option.field)}
                    aria-pressed={selected}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft text-foreground"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/50 p-3">
            <p className="text-xs text-muted">Current text — {fieldLabel}</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">
              {displayValue || "—"}
            </p>
            {previewValue !== null ? (
              <p className="mt-2 text-[11px] text-accent">
                Previewing on site content (Apply to save)
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Three AI Suggestions
            </p>

            {isLoading ? (
              <div
                className="mt-4 flex flex-col items-center gap-3 py-8"
                role="status"
                aria-live="polite"
              >
                <div
                  className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted">Generating AI content…</p>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            {!isLoading && !error ? (
              <ul className="mt-3 space-y-3">
                {suggestions.map((suggestion, index) => (
                  <AiSuggestionCard
                    key={`${index}-${suggestion}`}
                    index={index}
                    suggestion={suggestion}
                    isPreviewing={previewIndex === index}
                    onPreview={() => handlePreview(index, suggestion)}
                    onApply={() => handleApply(suggestion)}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {aiHistory ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleUndo}
            >
              Undo AI Change
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleKeepOriginal}
          >
            Keep Original
          </Button>
        </div>
      </div>
    </div>
  );
}
