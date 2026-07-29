"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";
import type { BusinessProject } from "@/types/business-project";

export type AtlasAiUiStatus =
  | "idle"
  | "sending"
  | "applied"
  | "no_changes"
  | "needs_clarification"
  | "failed";

type AtlasAiPanelProps = {
  project: BusinessProject;
  messages: EditorConversationMessage[];
  status: AtlasAiUiStatus;
  statusMessage?: string | null;
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
  status,
  statusMessage,
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
  const sending = status === "sending";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, lastChanges]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || sending) return;
    setDraft("");
    onSend(value);
  }

  const statusLabel =
    status === "sending"
      ? "Sending…"
      : status === "applied"
        ? "Applied"
        : status === "no_changes"
          ? "No changes needed"
          : status === "needs_clarification"
            ? "Quick question"
            : status === "failed"
              ? "Failed"
              : null;

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface/95 backdrop-blur-xl"
      aria-label="Atlas AI Design Assistant"
      aria-busy={sending || undefined}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
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
            disabled={!canUndo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Undo last AI change"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || sending}
            className="rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-40"
            title="Redo AI change"
          >
            Redo
          </button>
        </div>
      </div>

      {statusLabel ? (
        <div
          className={`shrink-0 border-b px-4 py-2 text-xs font-medium ${
            status === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : status === "no_changes"
                ? "border-border bg-background/50 text-muted"
                : status === "needs_clarification"
                  ? "border-amber-500/30 bg-amber-500/10 text-foreground"
                  : status === "applied"
                  ? "border-accent/30 bg-accent/10 text-foreground"
                  : "border-border bg-background/40 text-muted"
          }`}
          role={status === "failed" ? "alert" : "status"}
          aria-live="polite"
        >
          {statusLabel}
          {statusMessage ? (
            <span className="mt-0.5 block font-normal opacity-90">
              {statusMessage}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
            {message.role === "assistant" &&
            message.changes &&
            message.changes.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs text-muted">
                {message.changes.map((change) => (
                  <li key={change.id} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{change.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {sending ? (
          <div className="mr-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              Sending…
            </span>
          </div>
        ) : null}

        {status === "applied" && lastChanges && lastChanges.length > 0 ? (
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

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
        <label htmlFor="atlas-ai-prompt" className="sr-only">
          Design request
        </label>
        <textarea
          id="atlas-ai-prompt"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={`Ask about ${project.businessName || "this website"}…`}
          disabled={sending}
          className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2 disabled:opacity-60"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            disabled={sending || !draft.trim()}
            className="px-4 py-2 text-xs"
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </aside>
  );
}
