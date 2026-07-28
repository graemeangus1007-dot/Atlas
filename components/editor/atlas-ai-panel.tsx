"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";

type AtlasAiPanelProps = {
  project: BusinessProject;
  messages: EditorConversationMessage[];
  thinking: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastChanges: EditChangeSummary[] | null;
  onSend: (request: string) => void;
  onUndo: () => void;
  onRedo: () => void;
};

/**
 * Right-rail Atlas AI Design Assistant — conversation + undo/redo.
 */
export default function AtlasAiPanel({
  project,
  messages,
  thinking,
  canUndo,
  canRedo,
  lastChanges,
  onSend,
  onUndo,
  onRedo,
}: AtlasAiPanelProps) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || thinking) return;
    setDraft("");
    onSend(value);
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-l border-border bg-surface/95 backdrop-blur-xl xl:w-80"
      aria-label="Atlas AI Design Assistant"
      aria-busy={thinking || undefined}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div>
          <p className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
            Atlas AI
          </p>
          <p className="text-xs text-muted">Design assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || thinking}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Undo last AI change"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || thinking}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Redo AI change"
          >
            Redo
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3 text-xs leading-relaxed text-muted">
            Ask Atlas to redesign this site. Try “Make the hero more modern”,
            “Add an FAQ”, or “Change all blue colors to green”.
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-4 bg-[color:var(--site-accent,theme(colors.accent))]/15 text-foreground"
                : "mr-2 border border-border/70 bg-background/50 text-foreground"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {message.role === "user" ? "You" : "Atlas"}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          </div>
        ))}

        {thinking ? (
          <div className="mr-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              Thinking…
            </span>
          </div>
        ) : null}

        {lastChanges && lastChanges.length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              <span>
                {lastChanges.length} change
                {lastChanges.length === 1 ? "" : "s"} made
              </span>
              <span className="text-muted">{expanded ? "Hide" : "Expand"}</span>
            </button>
            {expanded ? (
              <ul className="mt-2 space-y-1.5 text-xs text-muted">
                {lastChanges.map((change) => (
                  <li key={change.id} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{change.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-3"
      >
        <label htmlFor="atlas-ai-prompt" className="sr-only">
          Design request
        </label>
        <textarea
          id="atlas-ai-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={`Ask about ${project.businessName || "this website"}…`}
          disabled={thinking}
          className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" disabled={thinking || !draft.trim()} className="px-4 py-2 text-xs">
            Send
          </Button>
        </div>
      </form>
    </aside>
  );
}
