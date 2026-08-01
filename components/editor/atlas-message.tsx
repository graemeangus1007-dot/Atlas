"use client";

import type { ReactNode } from "react";
import { summarizeWebsiteChanges } from "@/components/editor/atlas-change-summary";
import {
  ATLAS_VOICE,
  atlasAppliedSummary,
} from "@/lib/ai/atlas-designer-voice";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";

type AtlasMessageProps = {
  id: string;
  role: "user" | "assistant";
  children: ReactNode;
  changes?: EditChangeSummary[];
  onViewChanges?: () => void;
  createdAt?: string;
};

export default function AtlasMessage({
  id,
  role,
  children,
  changes,
  onViewChanges,
  createdAt,
}: AtlasMessageProps) {
  const summary = summarizeWebsiteChanges(changes);
  const isUser = role === "user";

  return (
    <article
      className={`group max-w-[36rem] text-sm [content-visibility:auto] [contain-intrinsic-size:auto_96px] ${
        isUser ? "ml-6" : "mr-2"
      }`}
      data-testid={`atlas-message-${id}`}
      data-role={role}
    >
      <div
        className={
          isUser
            ? "rounded-2xl bg-[color:var(--site-accent,theme(colors.accent))]/12 px-3 py-2 text-foreground"
            : "px-0.5 py-1 text-foreground"
        }
      >
        {children}
      </div>

      {createdAt ? (
        <p className="mt-1 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
          {formatTime(createdAt)}
        </p>
      ) : null}

      {!isUser && summary.count > 0 ? (
        <div
          className="mt-2 border-t border-border/50 pt-2 text-xs text-muted"
          data-testid="atlas-message-change-summary"
        >
          <p className="font-medium text-foreground">
            {ATLAS_VOICE.appliedTitle}
          </p>
          <p className="mt-0.5">{atlasAppliedSummary(summary)}</p>
          {onViewChanges ? (
            <button
              type="button"
              onClick={onViewChanges}
              className="mt-1 text-[11px] font-medium text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {ATLAS_VOICE.viewDetails}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
