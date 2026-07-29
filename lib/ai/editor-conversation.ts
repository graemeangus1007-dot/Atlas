/**
 * Conversation history for the Atlas AI Design Assistant (Sprint 22.0A).
 */

import type { AtlasAiOperation } from "@/lib/ai/editor-revisions";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";

export type EditorConversationRole = "user" | "assistant";

export type EditorConversationMessage = {
  id: string;
  role: EditorConversationRole;
  content: string;
  createdAt: string;
  /** Present on assistant turns that applied edits. */
  operations?: AtlasAiOperation[];
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
    createdAt: message.createdAt ?? new Date().toISOString(),
    role: message.role,
    content: message.content,
    ...(message.operations ? { operations: message.operations } : {}),
    ...(message.changes ? { changes: message.changes } : {}),
  };
  const messages = [...conversation.messages, next].slice(
    -EDITOR_CONVERSATION_MAX_MESSAGES,
  );
  return { messages };
}

export function serializeConversationForAgent(
  conversation: EditorConversation,
): Array<{ role: "user" | "assistant"; content: string }> {
  return conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
