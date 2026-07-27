import {
  apiError,
  apiJson,
  badRequest,
  getRequestId,
  internalError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import { AiError, isAiError } from "@/lib/ai";
import { createProjectFromDraft } from "@/lib/ai/create-project-from-draft";
import type { GenerateWebsiteQuestionnaire } from "@/lib/ai/types";
import type { AiQuestionnaireAnswers } from "@/components/ai/ai-types";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CreateBody = {
  draft?: unknown;
  questionnaire?:
    | Partial<AiQuestionnaireAnswers>
    | GenerateWebsiteQuestionnaire;
  idempotencyKey?: string;
  /** Context project only — never overwritten in Sprint 20.0C. */
  sourceProjectId?: string;
  replaceExisting?: boolean;
  owner_id?: string;
};

/**
 * POST /api/ai/create-project
 * Create a real Atlas project from a generated AI draft (mock-compatible).
 * Default behavior always creates a new project (never replaces source).
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:create-project:${user.id}`, {
      limit: 15,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    let body: CreateBody;
    try {
      body = (await request.json()) as CreateBody;
    } catch {
      return badRequest("Invalid JSON body.", requestId, "invalid_json");
    }

    if (body.owner_id != null) {
      return badRequest(
        "owner_id cannot be set by the client.",
        requestId,
        "owner_id_forbidden",
      );
    }

    if (body.replaceExisting === true) {
      return badRequest(
        "Replacing an existing project is not available yet.",
        requestId,
        "replace_not_supported",
      );
    }

    if (!body.draft || typeof body.draft !== "object") {
      return badRequest("draft is required.", requestId, "missing_draft");
    }

    if (
      typeof body.idempotencyKey !== "string" ||
      !body.idempotencyKey.trim()
    ) {
      return badRequest(
        "idempotencyKey is required.",
        requestId,
        "missing_idempotency_key",
      );
    }

    const result = await createProjectFromDraft(supabase, user, {
      draft: body.draft,
      questionnaire: body.questionnaire,
      idempotencyKey: body.idempotencyKey,
      sourceProjectId: body.sourceProjectId?.trim() || null,
      replaceExisting: false,
    });

    if (!result.ok) {
      return apiError({
        code: result.code,
        message: result.message,
        status: result.status,
        requestId,
      });
    }

    return apiJson(
      {
        projectId: result.projectId,
        reused: result.reused,
        editorPath: result.editorPath,
      },
      { requestId, status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof AiError || isAiError(error)) {
      return apiError({
        code: error.code,
        message: error.message,
        status: error.status,
        requestId,
      });
    }

    captureException({
      error,
      context: {
        request: requestContextFromRequest(request, requestId),
        tags: { route: "ai.create-project" },
      },
    });
    return internalError(requestId, "Could not create project from draft.");
  }
}
