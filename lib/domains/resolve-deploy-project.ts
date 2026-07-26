import type { SupabaseClient } from "@supabase/supabase-js";
import { getVercelDeploymentConfig } from "@/lib/deployment/server-config";
import {
  canPublishToLinkedProduction,
  matchesProductionPublishConfirmation,
  type DeployTarget,
} from "@/lib/domains/production-publish";
import type { ProjectDomainRow } from "@/lib/domains/types";

export type ResolveVercelDeployProjectResult =
  | {
      ok: true;
      vercelProjectId: string;
      /** preview_default = atlas-sites; production_linked = explicit cutover only */
      source: "preview_default" | "production_linked";
      linkedProjectName: string | null;
      hostname: string | null;
    }
  | {
      ok: false;
      code:
        | "not_linked"
        | "confirmation_required"
        | "confirmation_mismatch"
        | "missing_atlas_project";
      message: string;
    };

/**
 * Resolve which Vercel project id to deploy into for an Atlas project.
 *
 * Safety rules:
 * - Preview (default / Force Redeploy / normal Publish) → always atlas-sites
 *   (`VERCEL_PROJECT_ID`). Linking a domain never changes this.
 * - Production → linked Vercel project only after typed confirmation.
 *
 * Never trusts a Vercel project id from the browser — only DB + env.
 */
export async function resolveVercelDeployProjectId(input: {
  supabase: SupabaseClient;
  ownerId: string;
  atlasProjectId: string | null | undefined;
  /** preview (default) | production (explicit cutover only) */
  target?: DeployTarget;
  /** Required when target=production — hostname or linked project name */
  productionConfirmation?: string | null;
  /** Override default atlas-sites id (tests). */
  defaultProjectId?: string;
}): Promise<ResolveVercelDeployProjectResult> {
  const fallback =
    input.defaultProjectId?.trim() || getVercelDeploymentConfig().projectId;
  const target: DeployTarget =
    input.target === "production" ? "production" : "preview";

  // Preview path — never follow linked_project_id.
  if (target === "preview") {
    return {
      ok: true,
      vercelProjectId: fallback,
      source: "preview_default",
      linkedProjectName: null,
      hostname: null,
    };
  }

  const atlasProjectId = input.atlasProjectId?.trim();
  if (!atlasProjectId) {
    return {
      ok: false,
      code: "missing_atlas_project",
      message: "Save the project before publishing to production.",
    };
  }

  const { data, error } = await input.supabase
    .from("project_domains")
    .select(
      "hostname, normalized_hostname, linked_project_id, linked_project_name, migration_state",
    )
    .eq("project_id", atlasProjectId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      code: "not_linked",
      message:
        "No linked production Vercel project. Link an existing project under Custom Domain first.",
    };
  }

  const row = data as Pick<
    ProjectDomainRow,
    | "hostname"
    | "normalized_hostname"
    | "linked_project_id"
    | "linked_project_name"
    | "migration_state"
  >;

  if (!canPublishToLinkedProduction(row.migration_state, row.linked_project_id)) {
    return {
      ok: false,
      code: "not_linked",
      message:
        "Production publish requires a linked Vercel project. Normal Publish still deploys to Atlas preview hosting.",
    };
  }

  const confirmation = input.productionConfirmation?.trim() ?? "";
  if (!confirmation) {
    return {
      ok: false,
      code: "confirmation_required",
      message:
        "Type the domain or linked project name to confirm publishing to production.",
    };
  }

  if (
    !matchesProductionPublishConfirmation({
      confirmation,
      hostname: row.hostname,
      normalizedHostname: row.normalized_hostname,
      linkedProjectName: row.linked_project_name,
    })
  ) {
    return {
      ok: false,
      code: "confirmation_mismatch",
      message:
        "Confirmation did not match the domain or linked project name. Production was not changed.",
    };
  }

  return {
    ok: true,
    vercelProjectId: row.linked_project_id!.trim(),
    source: "production_linked",
    linkedProjectName: row.linked_project_name ?? null,
    hostname: row.hostname ?? null,
  };
}
