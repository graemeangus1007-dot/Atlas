/**
 * Undo / redo revision stack for Atlas AI Design Assistant edits.
 */

import type { BusinessProject } from "@/types/business-project";
import type { EditChangeSummary, EditOperation } from "@/lib/ai/edit-operations";

export type EditorRevision = {
  id: string;
  createdAt: string;
  /** Project snapshot before this AI edit was applied. */
  before: BusinessProject;
  /** Project snapshot after this AI edit was applied. */
  after: BusinessProject;
  operations: EditOperation[];
  changes: EditChangeSummary[];
  prompt: string;
};

export type EditorRevisionStack = {
  revisions: EditorRevision[];
  /** Index of the current revision head; -1 when empty / fully undone. */
  index: number;
};

export const EDITOR_REVISION_MAX = 20;

export function createEmptyRevisionStack(): EditorRevisionStack {
  return { revisions: [], index: -1 };
}

export function createRevisionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Push a new AI revision. Drops any redo branch beyond the current index.
 */
export function pushEditorRevision(
  stack: EditorRevisionStack,
  revision: Omit<EditorRevision, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): EditorRevisionStack {
  const kept = stack.revisions.slice(0, stack.index + 1);
  const entry: EditorRevision = {
    id: revision.id ?? createRevisionId(),
    createdAt: revision.createdAt ?? new Date().toISOString(),
    before: revision.before,
    after: revision.after,
    operations: revision.operations,
    changes: revision.changes,
    prompt: revision.prompt,
  };
  const revisions = [...kept, entry].slice(-EDITOR_REVISION_MAX);
  return {
    revisions,
    index: revisions.length - 1,
  };
}

export function canUndoEditorRevision(stack: EditorRevisionStack): boolean {
  return stack.index >= 0;
}

export function canRedoEditorRevision(stack: EditorRevisionStack): boolean {
  return stack.index < stack.revisions.length - 1;
}

export function undoEditorRevision(
  stack: EditorRevisionStack,
): { stack: EditorRevisionStack; project: BusinessProject } | null {
  if (!canUndoEditorRevision(stack)) return null;
  const current = stack.revisions[stack.index]!;
  return {
    stack: { ...stack, index: stack.index - 1 },
    project: current.before,
  };
}

export function redoEditorRevision(
  stack: EditorRevisionStack,
): { stack: EditorRevisionStack; project: BusinessProject } | null {
  if (!canRedoEditorRevision(stack)) return null;
  const nextIndex = stack.index + 1;
  const next = stack.revisions[nextIndex]!;
  return {
    stack: { ...stack, index: nextIndex },
    project: next.after,
  };
}
