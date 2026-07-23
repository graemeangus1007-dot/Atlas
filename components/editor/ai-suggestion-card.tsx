"use client";

import { useState } from "react";
import Button from "@/components/ui/button";

type AiSuggestionCardProps = {
  index: number;
  suggestion: string;
  isPreviewing: boolean;
  onPreview: () => void;
  onApply: () => void;
};

/**
 * Single AI suggestion card — Preview / Apply / Copy.
 */
export default function AiSuggestionCard({
  index,
  suggestion,
  isPreviewing,
  onPreview,
  onApply,
}: AiSuggestionCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li
      className={`rounded-xl border p-3 transition-all duration-200 ${
        isPreviewing
          ? "border-accent bg-accent-soft"
          : "border-border bg-background/40 hover:border-white/15"
      }`}
    >
      <p className="text-xs text-muted">Suggestion {index + 1}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        {suggestion}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1.5 text-xs"
          onClick={onPreview}
          aria-pressed={isPreviewing}
        >
          {isPreviewing ? "Previewing" : "Preview"}
        </Button>
        <Button
          type="button"
          className="px-3 py-1.5 text-xs"
          onClick={onApply}
        >
          Apply
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={() => {
            void handleCopy();
          }}
          aria-label={`Copy suggestion ${index + 1}`}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </li>
  );
}
