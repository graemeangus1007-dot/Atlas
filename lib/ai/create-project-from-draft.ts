/**
 * Create a real Atlas project from an AI draft (Sprint 20.0C).
 * Authenticated owner only — never trusts client owner_id.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AiQuestionnaireAnswers } from "@/components/ai/ai-types";
import { AI_CREATE_PROJECT_EDITOR_PATH } from "@/lib/ai/create-project-constants";
import {
  mapDraftToBusinessProject,
  type AiProjectMeta,
} from "@/lib/ai/draft-to-project";
import { normalizeIdempotencyKey } from "@/lib/ai/validate-draft";
import type {
  GenerateWebsiteQuestionnaire,
  GeneratedWebsiteDraft,
} from "@/lib/ai/types";
import { resolveFeatures } from "@/lib/billing/entitlements";
import type { SubscriptionRow } from "@/lib/billing/types";
import { ensureLeadFormForOwner } from "@/lib/leads/ensure-server";
import {
  businessProjectToColumns,
  rowToBusinessProject,
} from "@/lib/supabase/projects";
import type { Database, ProjectRow } from "@/lib/supabase/types";
import type { BusinessProject } from "@/types/business-project";

export { AI_CREATE_PROJECT_EDITOR_PATH } from "@/lib/ai/create-project-constants";
export type CreateProjectFromDraftInput = {
  draft: GeneratedWebsiteDraft | unknown;
  questionnaire?:
    | Partial<AiQuestionnaireAnswers>
    | GenerateWebsiteQuestionnaire
    | null;
  idempotencyKey: string;
  /** Context project for questionnaire storage only — never overwritten. */
  sourceProjectId?: string | null;
  /** Reserved for later sprints — must remain false/omitted in 20.0C. */
  replaceExisting?: boolean;
};

export type CreateProjectFromDraftSuccess = {
  ok: true;
  projectId: string;
  reused: boolean;
  project: BusinessProject;
  editorPath: typeof AI_CREATE_PROJECT_EDITOR_PATH;
};

export type CreateProjectFromDraftFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type CreateProjectFromDraftResult =
  | CreateProjectFromDraftSuccess
  | CreateProjectFromDraftFailure;

function enrichContentWithAiMeta(
  content: Record<string, unknown>,
  meta: AiProjectMeta,
  aboutBody: string,
): Record<string, unknown> {
  return {
    ...content,
    aiGenerationKey: meta.idempotencyKey ?? null,
    aiMeta: {
      sourceProjectId: meta.sourceProjectId ?? null,
      tone: meta.tone ?? null,
      socialLinks: meta.socialLinks,
      aboutBody,
    },
  };
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" ||
    /duplicate key|unique constraint/i.test(error.message || "")
  );
}

function isPlanLimitError(error: { message?: string; hint?: string } | null): boolean {
  if (!error) return false;
  const haystack = `${error.message || ""} ${error.hint || ""}`;
  return /PLAN_LIMIT_PROJECTS|plan_limit_projects/i.test(haystack);
}

/**
 * Soft app-layer plan check (DB trigger remains authoritative).
 */
export async function assertCanCreateProject(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<CreateProjectFromDraftFailure | null> {
  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const features = resolveFeatures(subRow as SubscriptionRow | null);
  const maxProjects = features.maxProjects;
  if (
    maxProjects != null &&
    typeof projectCount === "number" &&
    projectCount >= maxProjects
  ) {
    return {
      ok: false,
      code: "plan_limit_projects",
      message:
        "You've reached your website limit on the current plan. Upgrade to create more sites.",
      status: 403,
    };
  }
  return null;
}

/**
 * Create (or idempotently reuse) a project from a validated AI draft.
 */
export async function createProjectFromDraft(
  supabase: SupabaseClient<Database>,
  user: User,
  input: CreateProjectFromDraftInput,
): Promise<CreateProjectFromDraftResult> {
  if (input.replaceExisting) {
    return {
      ok: false,
      code: "bad_request",
      message:
        "Replacing an existing project is not available yet. A new project will be created instead.",
      status: 400,
    };
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  } catch (error) {
    return {
      ok: false,
      code: "bad_request",
      message:
        error instanceof Error ? error.message : "Invalid idempotency key.",
      status: 400,
    };
  }

  const { data: existingCreation } = await supabase
    .from("ai_draft_creations")
    .select("project_id")
    .eq("owner_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingCreation?.project_id) {
    const { data: existingRow } = await supabase
      .from("projects")
      .select("*")
      .eq("id", existingCreation.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (existingRow) {
      return {
        ok: true,
        projectId: existingRow.id,
        reused: true,
        project: rowToBusinessProject(existingRow as ProjectRow),
        editorPath: AI_CREATE_PROJECT_EDITOR_PATH,
      };
    }
  }

  const limitError = await assertCanCreateProject(supabase, user.id);
  if (limitError) return limitError;

  let mapped;
  try {
    mapped = mapDraftToBusinessProject({
      draft: input.draft,
      questionnaire: input.questionnaire,
      idempotencyKey,
      sourceProjectId: input.sourceProjectId,
    });
  } catch (error) {
    return {
      ok: false,
      code: "bad_request",
      message:
        error instanceof Error
          ? error.message
          : "Draft is incomplete or malformed.",
      status: 400,
    };
  }

  const columns = businessProjectToColumns(mapped.project);
  const aboutBody =
    typeof input.draft === "object" &&
    input.draft &&
    "aboutBody" in input.draft &&
    typeof (input.draft as { aboutBody?: unknown }).aboutBody === "string"
      ? (input.draft as { aboutBody: string }).aboutBody
      : mapped.project.description;

  const content = enrichContentWithAiMeta(
    (columns.content as Record<string, unknown>) || {},
    mapped.meta,
    aboutBody,
  );

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: columns.name,
      business_name: columns.business_name,
      business_type: columns.business_type,
      description: columns.description,
      goals: columns.goals,
      content,
      branding: columns.branding,
      template: columns.template,
      media: columns.media,
      status: columns.status ?? "ready",
      published_url: columns.published_url ?? null,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    if (isPlanLimitError(insertError)) {
      return {
        ok: false,
        code: "plan_limit_projects",
        message:
          "You've reached your website limit on the current plan. Upgrade to create more sites.",
        status: 403,
      };
    }
    return {
      ok: false,
      code: "internal_error",
      message: "Could not create project from draft.",
      status: 500,
    };
  }

  const projectId = (inserted as ProjectRow).id;

  const { error: idempotencyError } = await supabase
    .from("ai_draft_creations")
    .insert({
      owner_id: user.id,
      idempotency_key: idempotencyKey,
      project_id: projectId,
    });

  if (idempotencyError) {
    if (isUniqueViolation(idempotencyError)) {
      // Concurrent duplicate — keep the winner, drop this orphan.
      await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)
        .eq("owner_id", user.id);

      const { data: winner } = await supabase
        .from("ai_draft_creations")
        .select("project_id")
        .eq("owner_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (winner?.project_id) {
        const { data: winnerRow } = await supabase
          .from("projects")
          .select("*")
          .eq("id", winner.project_id)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (winnerRow) {
          return {
            ok: true,
            projectId: winnerRow.id,
            reused: true,
            project: rowToBusinessProject(winnerRow as ProjectRow),
            editorPath: AI_CREATE_PROJECT_EDITOR_PATH,
          };
        }
      }
    }

    return {
      ok: false,
      code: "internal_error",
      message: "Could not finalize project creation.",
      status: 500,
    };
  }

  const formResult = await ensureLeadFormForOwner(supabase, user, {
    projectId,
    successMessage: mapped.project.contact.successMessage,
    description: mapped.project.contact.description,
    name: "Contact form",
  });

  let project = rowToBusinessProject(inserted as ProjectRow);
  if (formResult.ok) {
    const nextContact = { ...project.contact, formId: formResult.formId };
    const nextContent = {
      ...(typeof inserted.content === "object" && inserted.content
        ? (inserted.content as Record<string, unknown>)
        : {}),
      contact: nextContact,
    };
    await supabase
      .from("projects")
      .update({ content: nextContent })
      .eq("id", projectId)
      .eq("owner_id", user.id);
    project = { ...project, contact: nextContact };
  }

  return {
    ok: true,
    projectId,
    reused: false,
    project,
    editorPath: AI_CREATE_PROJECT_EDITOR_PATH,
  };
}
