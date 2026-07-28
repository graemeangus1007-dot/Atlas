/**
 * Client helper for Atlas AI Design Assistant turns.
 * Uses the local agent foundation (structured ops). A server route exists for
 * authenticated / future provider-backed planning.
 */

import { tryRunEditorAgent } from "@/lib/ai/editor-agent";
import type { EditorAgentHistoryItem } from "@/lib/ai/editor-agent";
import type { BusinessProject } from "@/types/business-project";

export async function requestEditorAgentEdit(input: {
  project: BusinessProject;
  request: string;
  history?: EditorAgentHistoryItem[];
}) {
  return tryRunEditorAgent(input);
}
