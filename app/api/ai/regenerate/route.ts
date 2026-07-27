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
  isAiError,
  normalizeGenerateWebsiteInput,
  statusForCode,
} from "@/lib/ai";
import {
  normalizeRegenerateSection,
  regenerateDraftSection,
} from "@/lib/ai/regenerate";
import { resolveGenerateIdentity } from "@/lib/ai/resolve-generate-input";
import { validateGeneratedWebsiteDraft } from "@/lib/ai/validate-draft";
import type {
  GenerateWebsiteQuestionnaire,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { captureException, requestContextFromRequest } from "@/lib/monitoring";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RegenerateBody = {
  projectId?: string;
  section?: string;
  currentDraft?: GeneratedWebsiteDraft;
  variation?: number;
  businessName?: string;
  businessType?: string;
  description?: string;
  goals?: string[];
  questionnaire?: GenerateWebsiteQuestionnaire;
};

/**
 * POST /api/ai/regenerate
 * Regenerates a single draft section (hero | about | services) via mock provider.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return unauthorized(requestId);

    const rate = checkDomainRateLimit(`ai:regenerate:${user.id}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return tooManyRequests(rate.retryAfterSeconds, requestId);
    }

    let body: RegenerateBody;
    try {
      body = (await request.json()) as RegenerateBody;
    } catch {
      return badRequest("Invalid JSON body.", requestId, "invalid_json");
    }

    const projectId = body.projectId?.trim();
    if (!projectId) {
      return badRequest("projectId is required.", requestId, "missing_project");
    }

    let section;
    try {
      section = normalizeRegenerateSection(body.section);
    } catch (error) {
      if (isAiError(error)) {
        return badRequest(error.message, requestId, error.code);
      }
      return badRequest("Invalid section.", requestId);
    }

    let currentDraft: GeneratedWebsiteDraft;
    try {
      currentDraft = validateGeneratedWebsiteDraft(body.currentDraft);
    } catch (error) {
      if (isAiError(error)) {
        return badRequest(error.message, requestId, error.code);
      }
      return badRequest("currentDraft is required.", requestId);
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

    let generateInput;
    try {
      const identity = resolveGenerateIdentity(
        {
          businessName: body.businessName || currentDraft.businessName,
          businessType: body.businessType || currentDraft.businessType,
          description: body.description || currentDraft.description,
          questionnaire: body.questionnaire,
        },
        {
          business_name:
            typeof project.business_name === "string"
              ? project.business_name
              : null,
          business_type:
            typeof project.business_type === "string"
              ? project.business_type
              : null,
          description:
            typeof project.description === "string"
              ? project.description
              : null,
        },
      );

      generateInput = normalizeGenerateWebsiteInput({
        projectId,
        businessName: identity.businessName,
        businessType: identity.businessType,
        description: identity.description,
        goals: body.goals,
        questionnaire: body.questionnaire,
      });
    } catch (error) {
      if (isAiError(error)) {
        return badRequest(error.message, requestId, error.code);
      }
      return badRequest("Invalid regeneration input.", requestId);
    }

    const variation =
      typeof body.variation === "number" && Number.isFinite(body.variation)
        ? Math.max(0, Math.floor(body.variation))
        : 1;

    const result = await regenerateDraftSection({
      section,
      currentDraft,
      generateInput,
      variation,
    });

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
        section: result.section,
        patch: result.patch,
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
        tags: { route: "ai.regenerate" },
      },
    });
    return internalError(requestId, "Could not regenerate draft section.");
  }
}
