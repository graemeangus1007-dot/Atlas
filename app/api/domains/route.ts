import { NextResponse } from "next/server";
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
import { createClient } from "@/lib/supabase/server";
import { createDomainProvider } from "@/lib/domains/create-provider";
import { normalizeAndValidateHostname } from "@/lib/domains/hostname";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  rowToProjectDomain,
  safeDomainErrorMessage,
  toPublicProjectDomain,
} from "@/lib/domains/serialize";
import type { ProjectDomainRow } from "@/lib/domains/types";

export const runtime = "nodejs";

async function requireOwnedProject(
  projectId: string,
  requestId: string,
): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: unauthorized(requestId),
    };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !project) {
    return {
      ok: false,
      response: forbidden(requestId),
    };
  }

  return { ok: true, userId: user.id, supabase };
}

/**
 * GET /api/domains?projectId=
 * List custom domains for a project the caller owns.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) {
    return badRequest("Missing projectId query parameter.", requestId);
  }

  const auth = await requireOwnedProject(projectId, requestId);
  if (!auth.ok) return auth.response;

  const rate = checkDomainRateLimit(`domains:list:${auth.userId}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds, requestId);
  }

  const { data, error } = await auth.supabase
    .from("project_domains")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return internalError(requestId, safeDomainErrorMessage(error));
  }

  const domains = ((data ?? []) as ProjectDomainRow[]).map((row) =>
    toPublicProjectDomain(rowToProjectDomain(row)),
  );

  return apiJson({ domains }, { requestId });
}

/**
 * POST /api/domains
 * Body: { projectId, hostname }
 * Creates a pending domain, asks the provider for DNS records, saves them.
 * Never trusts owner_id from the client.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  let body: { projectId?: string; hostname?: string; owner_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Invalid JSON body.", requestId, "invalid_json");
  }

  // Never accept ownership claims from the browser.
  if (body.owner_id != null) {
    return badRequest(
      "owner_id cannot be set by the client.",
      requestId,
      "owner_id_forbidden",
    );
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return badRequest("Missing projectId.", requestId);
  }

  const auth = await requireOwnedProject(projectId, requestId);
  if (!auth.ok) return auth.response;

  const rate = checkDomainRateLimit(`domains:create:${auth.userId}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return tooManyRequests(rate.retryAfterSeconds, requestId);
  }

  const { getBillingSummaryForOwner } = await import(
    "@/lib/billing/subscription"
  );
  const { upgradeMessage } = await import("@/lib/billing/entitlements");
  const billing = await getBillingSummaryForOwner(auth.userId, auth.supabase);
  if (!billing.subscription.features.customDomains) {
    return apiError({
      code: "feature_custom_domains",
      message: upgradeMessage("feature_custom_domains"),
      status: 402,
      requestId,
    });
  }
  if (!billing.canAddDomain) {
    return apiError({
      code: "plan_limit_domains",
      message: upgradeMessage("plan_limit_domains"),
      status: 402,
      requestId,
    });
  }

  const validated = normalizeAndValidateHostname(body.hostname ?? "");
  if (!validated.ok) {
    return badRequest(validated.error, requestId, "invalid_hostname");
  }

  // One domain per project — reject if one already exists.
  const { data: existingForProject } = await auth.supabase
    .from("project_domains")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingForProject) {
    return apiError({
      code: "domain_exists_for_project",
      message:
        "This project already has a custom domain. Remove it before adding another.",
      status: 409,
      requestId,
    });
  }

  const { data: existingHostname } = await auth.supabase
    .from("project_domains")
    .select("id")
    .eq("normalized_hostname", validated.normalizedHostname)
    .maybeSingle();

  if (existingHostname) {
    return apiError({
      code: "domain_already_connected",
      message: "That domain is already connected to a project.",
      status: 409,
      requestId,
    });
  }

  try {
    const provider = createDomainProvider();
    const added = await provider.addDomain(validated.normalizedHostname);

    if (added.kind === "existing_project") {
      // Zero-downtime path: domain stays on the other Vercel project.
      const { data: inserted, error: insertError } = await auth.supabase
        .from("project_domains")
        .insert({
          project_id: projectId,
          owner_id: auth.userId,
          hostname: validated.hostname,
          normalized_hostname: validated.normalizedHostname,
          domain_type: validated.domainType,
          status: "pending",
          verification_token: added.verificationToken,
          verification_method: added.verificationMethod,
          verification_records: added.verificationRecords,
          provider: provider.id,
          provider_domain_id: added.providerDomainId,
          failure_reason: null,
          linked_project_id: added.linkedProjectId,
          linked_project_name: added.linkedProjectName,
          migration_state: "detected",
          linked_at: null,
        })
        .select("*")
        .single();

      if (insertError || !inserted) {
        return internalError(requestId, safeDomainErrorMessage(insertError));
      }

      const domain = toPublicProjectDomain(
        rowToProjectDomain(inserted as ProjectDomainRow),
      );

      return apiJson(
        {
          domain,
          live: true,
          requiresLinkConfirmation: true,
          existingProject: {
            projectId: added.linkedProjectId,
            projectName: added.linkedProjectName,
            hostname: added.hostname,
            sameAccount: true as const,
          },
          message:
            "This domain is already connected to an existing Vercel project. Link it to keep the site live with zero downtime.",
        },
        { requestId },
      );
    }

    const { data: inserted, error: insertError } = await auth.supabase
      .from("project_domains")
      .insert({
        project_id: projectId,
        owner_id: auth.userId,
        hostname: validated.hostname,
        normalized_hostname: validated.normalizedHostname,
        domain_type: validated.domainType,
        status: "pending",
        verification_token: added.verificationToken,
        verification_method: added.verificationMethod,
        verification_records: added.verificationRecords,
        provider: provider.id,
        provider_domain_id: added.providerDomainId,
        failure_reason: null,
        migration_state: "none",
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      // Best-effort cleanup of provider domain if DB insert fails.
      try {
        await provider.removeDomain(added.providerDomainId);
      } catch {
        // ignore
      }
      return internalError(requestId, safeDomainErrorMessage(insertError));
    }

    const domain = toPublicProjectDomain(
      rowToProjectDomain(inserted as ProjectDomainRow),
    );

    return apiJson(
      {
        domain,
        // Explicit: not live yet.
        live: false,
        requiresLinkConfirmation: false,
        message:
          "Domain saved as pending. Configure the DNS records below — this domain is not live yet.",
      },
      { requestId },
    );
  } catch (error) {
    return apiError({
      code: "domain_provider_error",
      message: safeDomainErrorMessage(error),
      status: 502,
      requestId,
    });
  }
}
