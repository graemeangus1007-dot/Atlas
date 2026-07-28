/**
 * Shared Design Assistant persistence shapes (avoid circular imports).
 */

import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";
import type { EditorConversation } from "@/lib/ai/editor-conversation";

export type DesignAssistantPersistedMeta = {
  version: 1;
  conversation: EditorConversation;
  revisions: Array<{
    id: string;
    createdAt: string;
    prompt: string;
    changes: EditChangeSummary[];
    operations: EditOperation[];
  }>;
  revisionIndex: number;
  lastChanges: EditChangeSummary[] | null;
  updatedAt: string;
};
