/**
 * Client helper for Atlas AI Design Assistant turns.
 * Prefers POST /api/ai/edit when authenticated; falls back to local agent.
 */

import {
  tryRunEditorAgent,
  type EditorAgentFailure,
  type EditorAgentHistoryItem,
  type EditorAgentResult,
} from "@/lib/ai/editor-agent";
import type { BusinessProject } from "@/types/business-project";

export type EditorEditClientResult = (EditorAgentResult | EditorAgentFailure) & {
  requestId: string;
};

function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type ApiEditSuccessBody = {
  explanation: string;
  operations: EditorAgentResult["operations"];
  changes: EditorAgentResult["changes"];
  project: BusinessProject;
  changeCount?: number;
  applyStatus?: "applied" | "no_changes" | "needs_clarification";
};

/**
 * Request a Design Assistant edit.
 * Never fails silently — always returns ok/failure with a requestId.
 */
export async function requestEditorAgentEdit(input: {
  project: BusinessProject;
  request: string;
  history?: EditorAgentHistoryItem[];
  projectId?: string | null;
}): Promise<EditorEditClientResult> {
  const requestId = createClientRequestId();

  try {
    const response = await fetch("/api/ai/edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        project: input.project,
        projectId: input.projectId ?? undefined,
        request: input.request,
        history: input.history,
      }),
    });

    const headerId = response.headers.get("x-request-id") || requestId;

    if (response.status === 401) {
      // Local / signed-out editor — use the in-process agent.
      const local = tryRunEditorAgent({
        project: input.project,
        request: input.request,
        history: input.history,
      });
      return { ...local, requestId: headerId };
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as { error?: { message?: unknown } }).error?.message ===
          "string"
          ? (body as { error: { message: string } }).error.message
          : "Atlas AI could not apply that design request. Please try again.";
      return {
        ok: false,
        code: "provider_error",
        message,
        requestId: headerId,
      };
    }

    const data = body as ApiEditSuccessBody;
    if (!data || typeof data !== "object" || !data.project) {
      return {
        ok: false,
        code: "invalid_response",
        message: "Atlas AI returned an incomplete response. Please try again.",
        requestId: headerId,
      };
    }

    const operations = Array.isArray(data.operations) ? data.operations : [];
    const changes = Array.isArray(data.changes) ? data.changes : [];
    const applyStatus =
      data.applyStatus ??
      (operations.length === 0 ? "no_changes" : "applied");

    return {
      ok: true,
      explanation:
        typeof data.explanation === "string"
          ? data.explanation
          : applyStatus === "needs_clarification"
            ? "Could you tell me a bit more?"
            : applyStatus === "no_changes"
              ? "No changes needed."
              : "Design updates applied.",
      operations,
      changes,
      project: data.project,
      applyStatus,
      requestId: headerId,
    };
  } catch {
    // Network / offline — local agent so the editor still works.
    const local = tryRunEditorAgent({
      project: input.project,
      request: input.request,
      history: input.history,
    });
    return { ...local, requestId };
  }
}
