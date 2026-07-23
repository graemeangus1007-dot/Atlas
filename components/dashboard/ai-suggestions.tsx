"use client";

import { MOCK_SUGGESTIONS } from "@/data/dashboard";
import type { AiContentField } from "@/types/ai";

type AiSuggestionsProps = {
  onSelectSuggestion: (field: AiContentField) => void;
};

/**
 * AI-powered suggestion cards for next best content improvements.
 * Opens the shared Atlas AI modal with the mapped content field.
 */
export default function AiSuggestions({
  onSelectSuggestion,
}: AiSuggestionsProps) {
  return (
    <section aria-labelledby="suggestions-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2
          id="suggestions-heading"
          className="font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground"
        >
          AI Suggestions
        </h2>
        <p className="text-xs text-muted">Based on your draft site</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {MOCK_SUGGESTIONS.map((suggestion) => (
          <li key={suggestion.id}>
            <button
              type="button"
              onClick={() => onSelectSuggestion(suggestion.field)}
              className="group flex h-full w-full flex-col rounded-2xl border border-border bg-surface/60 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-accent">
                Suggestion
              </span>
              <h3 className="mt-2 text-base font-semibold text-foreground">
                {suggestion.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                {suggestion.description}
              </p>
              <span className="mt-4 self-start text-sm font-medium text-accent transition-colors group-hover:text-accent-hover">
                Improve with AI →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
