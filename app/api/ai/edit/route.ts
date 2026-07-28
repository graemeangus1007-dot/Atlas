import {
  apiError,
  apiJson,
  badRequest,
  getRequestId,
  internalError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import {
  isAiError,
  tryRunEditorAgent,
} from "@/lib/ai";
import type { EditorAgentHistoryItem } from "@/lib/ai/editor-agent";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProject } from "@/types/business-project";

export const runtime = "nodejs";

type EditBody = {
  project?: BusinessProject;
  request?: string;
  message?: string;
  history?: EditorAgentHistoryItem[];
};

/**
 * POST /api/ai/edit
 * Authenticated Design Assistant turn — structured ops only.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:edit:${user.id}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    let body: EditBody;
    try {
      body = (await request.json()) as EditBody;
    } catch {
      return badRequest("Invalid JSON body.", requestId, "invalid_json");
    }

    const prompt = (body.request ?? body.message ?? "").trim();
    if (!prompt) {
      return badRequest("request is required.", requestId, "missing_request");
    }
    if (!body.project || typeof body.project !== "object") {
      return badRequest("project is required.", requestId, "missing_project");
    }

    const result = tryRunEditorAgent({
      project: body.project,
      request: prompt,
      history: body.history,
    });

    if (!result.ok) {
      const status =
        result.code === "bad_request"
          ? 400
          : result.code === "rate_limited"
            ? 429
            : result.code === "unauthorized"
              ? 401
              : 502;
      return apiError({
        status,
        code: result.code,
        message: result.message,
        requestId,
      });
    }

    return apiJson(
      {
        explanation: result.explanation,
        operations: result.operations,
        changes: result.changes,
        project: result.project,
        changeCount: result.changes.length,
        applyStatus: result.applyStatus,
        operationCount: result.operations.length,
      },
      { requestId },
    );
  } catch (error) {
    if (isAiError(error)) {
      return apiError({
        status: error.status,
        code: error.code,
        message: error.message,
        requestId,
      });
    }
    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "ai.edit" },
      },
    });
    return internalError(requestId, "Could not apply design edits.");
  }
}
