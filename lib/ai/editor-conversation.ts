/**
 * Conversation history for the Atlas AI Design Assistant (Sprint 22.0A).
 */

import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";

export type EditorConversationRole = "user" | "assistant";

export type EditorConversationMessage = {
  id: string;
  role: EditorConversationRole;
  content: string;
  createdAt: string;
  /** Present on assistant turns that applied edits. */
  operations?: EditOperation[];
  changes?: EditChangeSummary[];
};

export type EditorConversation = {
  messages: EditorConversationMessage[];
};

export const EDITOR_CONVERSATION_MAX_MESSAGES = 40;

export function createEmptyEditorConversation(): EditorConversation {
  return { messages: [] };
}

export function createConversationMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function appendConversationMessage(
  conversation: EditorConversation,
  message: Omit<EditorConversationMessage, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): EditorConversation {
  const next: EditorConversationMessage = {
    id: message.id ?? createConversationMessageId(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt ?? new Date().toISOString(),
    ...(message.operations ? { operations: message.operations } : {}),
    ...(message.changes ? { changes: message.changes } : {}),
  };
  const messages = [...conversation.messages, next].slice(
    -EDITOR_CONVERSATION_MAX_MESSAGES,
  );
  return { messages };
}

/** Compact history for the agent prompt (no secrets). */
export function serializeConversationForAgent(
  conversation: EditorConversation,
  limit = 12,
): Array<{ role: EditorConversationRole; content: string }> {
  return conversation.messages.slice(-limit).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
