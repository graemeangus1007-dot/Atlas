import {
  apiError,
  apiJson,
  badRequest,
  forbidden,
  getRequestId,
  internalError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api";
import {
  AiError,
  generateWebsiteDraft,
  isAiError,
  normalizeGenerateWebsiteInput,
  statusForCode,
  tryCreateAiProvider,
} from "@/lib/ai";
import type { GenerateWebsiteQuestionnaire } from "@/lib/ai/types";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type GenerateBody = {
  projectId?: string;
  businessName?: string;
  businessType?: string;
  description?: string;
  goals?: string[];
  questionnaire?: GenerateWebsiteQuestionnaire;
};

/**
 * POST /api/ai/generate
 * Authenticated website draft generation (mock by default).
 * Accepts optional questionnaire enrichment from Sprint 20.0B.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:generate:${user.id}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    let body: GenerateBody;
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return badRequest("Invalid JSON body.", requestId, "invalid_json");
    }

    const projectId = body.projectId?.trim();
    if (!projectId) {
      return badRequest("projectId is required.", requestId, "missing_project");
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, owner_id, business_name, business_type, description")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (projectError || !project) {
      return forbidden(requestId, "Project not found or access denied.");
    }

    let input;
    try {
      input = normalizeGenerateWebsiteInput({
        projectId,
        businessName:
          body.businessName?.trim() ||
          (typeof project.business_name === "string"
            ? project.business_name
            : "") ||
          "",
        businessType:
          body.businessType?.trim() ||
          (typeof project.business_type === "string"
            ? project.business_type
            : "") ||
          "",
        description:
          body.description?.trim() ||
          (typeof project.description === "string"
            ? project.description
            : "") ||
          "",
        goals: body.goals,
        questionnaire: body.questionnaire,
      });
    } catch (error) {
      if (isAiError(error)) {
        return badRequest(error.message, requestId, error.code);
      }
      return badRequest("Invalid generation input.", requestId);
    }

    const provider = tryCreateAiProvider();
    const result = await generateWebsiteDraft(input, provider);

    if (!result.ok) {
      return apiError({
        code: result.code,
        message: result.message,
        status: statusForCode(result.code),
        requestId,
      });
    }

    return apiJson(
      {
        provider: result.provider,
        draft: result.draft,
        durationMs: result.durationMs,
      },
      { requestId },
    );
  } catch (error) {
    if (error instanceof AiError) {
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
        tags: { route: "ai.generate" },
      },
    });
    return internalError(requestId, "Could not generate website draft.");
  }
}
