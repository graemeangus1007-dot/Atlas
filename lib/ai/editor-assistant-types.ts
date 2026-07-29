/**
 * Shared Design Assistant persistence shapes (avoid circular imports).
 */

import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import type { EditorConversation } from "@/lib/ai/editor-conversation";
import type { AtlasAiOperation } from "@/lib/ai/editor-revisions";

export type DesignAssistantPersistedMeta = {
  version: 1;
  conversation: EditorConversation;
  revisions: Array<{
    id: string;
    createdAt: string;
    prompt: string;
    changes: EditChangeSummary[];
    operations: AtlasAiOperation[];
  }>;
  revisionIndex: number;
  lastChanges: EditChangeSummary[] | null;
  updatedAt: string;
};
