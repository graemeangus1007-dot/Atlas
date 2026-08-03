"use client";

import { forwardRef } from "react";
import AtlasCritiqueMessage from "@/components/editor/atlas-critique-message";
import AtlasMessage from "@/components/editor/atlas-message";
import type { CompactChangeSummary } from "@/components/editor/atlas-change-summary";
import type { AtlasAiUiStatus } from "@/components/editor/atlas-ai-panel-types";
import {
  ATLAS_VOICE,
  atlasAppliedSummary,
  atlasProgressLabel,
} from "@/lib/ai/atlas-designer-voice";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversationMessage } from "@/lib/ai/editor-conversation";

type AtlasConversationProps = {
  messages: EditorConversationMessage[];
  status: AtlasAiUiStatus;
  lastChangesSummary: CompactChangeSummary;
  emptyHint?: string;
  progressLabel?: string;
  onScroll?: () => void;
  onReviewPlan: () => void;
  onApplyAll: () => void;
  onViewChanges: () => void;
  /** Resolve attachment thumbnails from project media (persistent URLs). */
  resolveAttachmentPreviewUrl?: (assetId: string) => string | undefined;
};

const AtlasConversation = forwardRef<HTMLDivElement, AtlasConversationProps>(
  function AtlasConversation(
    {
      messages,
      status,
      lastChangesSummary,
      emptyHint = ATLAS_VOICE.emptyConversation,
      progressLabel,
      onScroll,
      onReviewPlan,
      onApplyAll,
      onViewChanges,
      resolveAttachmentPreviewUrl,
    },
    ref,
  ) {
    const lastUserRequest = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content;
    const streamingLabel =
      progressLabel ?? atlasProgressLabel(lastUserRequest);
    return (
      <section
        ref={ref}
        onScroll={onScroll}
        className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
        data-testid="atlas-conversation-region"
        aria-label="Conversation"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted">{emptyHint}</p>
          ) : null}

          {messages.map((message) => (
            <AtlasMessage
              key={message.id}
              id={message.id}
              role={message.role}
              changes={message.changes}
              createdAt={message.createdAt}
              onViewChanges={
                message.changes?.length ? onViewChanges : undefined
              }
            >
              {message.role === "assistant" ? (
                <AtlasCritiqueMessage
                  content={message.content}
                  messageId={message.id}
                  onReviewPlan={onReviewPlan}
                  onApplyAll={onApplyAll}
                />
              ) : (
                <div className="space-y-2">
                  {message.attachments?.length ? (
                    <ul
                      className="flex flex-wrap gap-1.5"
                      aria-label="Attached photos"
                    >
                      {message.attachments.map((att) => {
                        const url =
                          (att.assetId &&
                            resolveAttachmentPreviewUrl?.(att.assetId)) ||
                          (att.previewUrl &&
                          !att.previewUrl.startsWith("blob:")
                            ? att.previewUrl
                            : undefined);
                        return (
                          <li
                            key={att.id}
                            className="overflow-hidden rounded-md border border-border/70"
                          >
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url}
                                alt={att.altText || att.filename}
                                className="size-12 object-cover"
                              />
                            ) : (
                              <span className="flex size-12 items-center justify-center text-[9px] text-muted">
                                Photo
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                </div>
              )}
            </AtlasMessage>
          ))}

          {status === "sending" ? (
            <div
              className="flex items-center gap-2 px-0.5 text-sm text-muted"
              data-testid="atlas-streaming-indicator"
              aria-live="polite"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
              {streamingLabel}
            </div>
          ) : null}

          {status === "applied" && lastChangesSummary.count > 0 ? (
            <CompactAppliedCard
              summary={lastChangesSummary}
              onViewDetails={onViewChanges}
            />
          ) : null}
        </div>
      </section>
    );
  },
);

function CompactAppliedCard({
  summary,
  onViewDetails,
}: {
  summary: CompactChangeSummary;
  onViewDetails: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-border/60 px-3 py-2.5"
      data-testid="atlas-last-changes-summary"
    >
      <p className="text-xs font-medium text-foreground">
        {ATLAS_VOICE.appliedTitle}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {atlasAppliedSummary(summary)}
      </p>
      <button
        type="button"
        onClick={onViewDetails}
        className="mt-1.5 text-[11px] font-medium text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        data-testid="atlas-view-change-details"
      >
        {ATLAS_VOICE.viewDetails}
      </button>
    </div>
  );
}

export type { EditChangeSummary };
export default AtlasConversation;
