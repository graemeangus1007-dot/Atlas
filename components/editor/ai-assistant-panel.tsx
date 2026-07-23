"use client";

import { useEffect, useState } from "react";
import AiSuggestionCard from "@/components/editor/ai-suggestion-card";
import Button from "@/components/ui/button";
import { generateSuggestions } from "@/lib/ai";
import type { AiFieldTarget } from "@/types/ai";

type AiAssistantPanelProps = {
  open: boolean;
  onClose: () => void;
  target: AiFieldTarget | null;
  businessName: string;
  businessType: string;
  previewIndex: number | null;
  canUndo: boolean;
  onPreview: (index: number, value: string) => void;
  onApply: (value: string) => void;
  onKeepOriginal: () => void;
  onUndoLastAiChange: () => void;
};

/**
 * Atlas AI Copywriter drawer — current text + mock suggestions.
 * Suggestions come from `lib/ai` generators only.
 */
export default function AiAssistantPanel({
  open,
  onClose,
  target,
  businessName,
  businessType,
  previewIndex,
  canUndo,
  onPreview,
  onApply,
  onKeepOriginal,
  onUndoLastAiChange,
}: AiAssistantPanelProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !target) {
      setSuggestions([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    generateSuggestions({
      field: target.field,
      currentValue: target.originalValue,
      businessName,
      businessType,
      serviceIndex: target.serviceIndex,
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

    return () => {
      cancelled = true;
    };
  }, [open, target, businessName, businessType]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 xl:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(100%,22rem)] flex-col border-l border-border bg-surface/95 backdrop-blur-xl transition-transform duration-300 xl:static xl:z-auto xl:w-80 xl:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full xl:hidden"
        }`}
        aria-label="Atlas AI Copywriter"
        aria-busy={isLoading || undefined}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div>
            <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
              AI Copywriter
            </p>
            <p className="text-xs text-muted">Mock suggestions · live preview</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-white/[0.03] hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!target ? (
            <p className="text-sm leading-relaxed text-muted">
              Select a field on the canvas and click{" "}
              <span className="text-foreground">✨ Improve with AI</span> to get
              three suggestions.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Improving
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {target.label}
              </p>

              <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
                <p className="text-xs text-muted">Current Text</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {target.originalValue}
                </p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Three AI Suggestions
                </p>

                {isLoading ? (
                  <p className="mt-3 text-sm text-muted" role="status">
                    Generating ideas…
                  </p>
                ) : null}

                {error ? (
                  <p className="mt-3 text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}

                <ul className="mt-3 space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <AiSuggestionCard
                      key={`${index}-${suggestion}`}
                      index={index}
                      suggestion={suggestion}
                      isPreviewing={previewIndex === index}
                      onPreview={() => onPreview(index, suggestion)}
                      onApply={() => onApply(suggestion)}
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {canUndo ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onUndoLastAiChange}
            >
              Undo Last AI Change
            </Button>
          ) : null}
          {target ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onKeepOriginal}
            >
              Keep original
            </Button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
