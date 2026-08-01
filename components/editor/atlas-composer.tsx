"use client";

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Button from "@/components/ui/button";
import { ATLAS_VOICE } from "@/lib/ai/atlas-designer-voice";

type AtlasComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (value: string) => void;
  sending: boolean;
  placeholder?: string;
  followUpSuggestions?: string[];
  onFollowUpSuggestion?: (suggestion: string) => void;
  onDismissFollowUps?: () => void;
  showFollowUps?: boolean;
};

const MAX_FOLLOW_UPS = 3;
const MAX_TEXTAREA_PX = 160;

const AtlasComposer = forwardRef<HTMLTextAreaElement, AtlasComposerProps>(
  function AtlasComposer(
    {
      draft,
      onDraftChange,
      onSubmit,
      sending,
      placeholder = ATLAS_VOICE.composerPlaceholder,
      followUpSuggestions = [],
      onFollowUpSuggestion,
      onDismissFollowUps,
      showFollowUps = false,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    }, [draft]);

    function handleSubmit(event: FormEvent) {
      event.preventDefault();
      const value = draft.trim();
      if (!value || sending) return;
      onSubmit(value);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const value = draft.trim();
        if (!value || sending) return;
        onSubmit(value);
      }
    }

    const suggestions = followUpSuggestions.slice(0, MAX_FOLLOW_UPS);
    const typing = draft.trim().length > 0;
    const canShowSuggestions =
      showFollowUps && !typing && suggestions.length > 0 && onFollowUpSuggestion;

    return (
      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-surface/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="atlas-prompt-region"
        aria-label="Prompt composer"
      >
        {canShowSuggestions ? (
          <div
            className="mb-2 flex flex-wrap items-center gap-1.5"
            data-testid="atlas-follow-up-suggestions"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={sending}
                onClick={() => onFollowUpSuggestion?.(suggestion)}
                className="truncate rounded-md px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
              >
                {suggestion}
              </button>
            ))}
            {onDismissFollowUps ? (
              <button
                type="button"
                aria-label="Dismiss suggestions"
                onClick={onDismissFollowUps}
                className="ml-auto rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                data-testid="atlas-dismiss-follow-ups"
              >
                ✕
              </button>
            ) : null}
          </div>
        ) : null}

        <label htmlFor="atlas-ai-prompt" className="sr-only">
          Design request
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={setRefs}
            id="atlas-ai-prompt"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={placeholder}
            disabled={sending}
            className="max-h-40 min-h-[2.75rem] w-full resize-none overflow-y-auto rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            data-testid="atlas-prompt-input"
          />
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 px-3 py-2 text-xs"
            aria-label="Send message"
          >
            {sending ? "…" : "Send"}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted/80">
          Enter to send · Shift+Enter for new line
        </p>
      </form>
    );
  },
);

export default AtlasComposer;
