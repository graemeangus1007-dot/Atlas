import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import {
  rowToProjectDomain,
  safeDomainErrorMessage,
  toPublicProjectDomain,
} from "@/lib/domains/serialize";
import { createDomainProviderForRow } from "@/lib/domains/provider-for-row";
import type { ProjectDomainRow } from "@/lib/domains/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/domains/[id]/link
 * Confirm linking a detected same-account Vercel project (zero downtime).
 * Never trusts a Vercel project id from the browser — re-verifies via API.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const domainId = id?.trim();
  if (!domainId) {
    return NextResponse.json({ error: "Missing domain id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkDomainRateLimit(`domains:link:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many link requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const { data: row, error: loadError } = await supabase
    .from("project_domains")
    .select("*")
    .eq("id", domainId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { error: safeDomainErrorMessage(loadError) },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: "Domain not found or access denied." },
      { status: 404 },
    );
  }

  const domain = row as ProjectDomainRow;

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", domain.project_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json(
      { error: "Domain not found or access denied." },
      { status: 403 },
    );
  }

  if (domain.migration_state !== "detected" || !domain.linked_project_id) {
    return NextResponse.json(
      {
        error:
          "This domain is not waiting for a project link. Add the domain again if needed.",
      },
      { status: 409 },
    );
  }

  // Snapshot for rollback if link confirmation fails mid-update.
  const prior = {
    status: domain.status,
    migration_state: domain.migration_state,
    linked_project_id: domain.linked_project_id,
    linked_project_name: domain.linked_project_name,
    linked_at: domain.linked_at,
    verified_at: domain.verified_at,
    activated_at: domain.activated_at,
    failure_reason: domain.failure_reason,
  };

  try {
    const provider = createDomainProviderForRow(domain);
    if (!provider.confirmDomainOnProject || !provider.getProject) {
      return NextResponse.json(
        {
          error:
            "Linking existing Vercel projects requires the Vercel domain provider.",
        },
        { status: 400 },
      );
    }

    // Re-verify ownership through the Vercel API (never trust browser ids).
    const meta = await provider.getProject(domain.linked_project_id);
    if (!meta.accessible) {
      await supabase
        .from("project_domains")
        .update({
          failure_reason:
            "Could not verify that Vercel project belongs to this account. The live site was not changed.",
        })
        .eq("id", domainId)
        .eq("owner_id", user.id);

      return NextResponse.json(
        {
          error:
            "Could not verify that Vercel project belongs to this account. Your website was not changed.",
        },
        { status: 403 },
      );
    }

    const confirmed = await provider.confirmDomainOnProject({
      projectId: domain.linked_project_id,
      hostname: domain.normalized_hostname || domain.hostname,
    });

    if (!confirmed) {
      // Rollback: stay in detected so the user can retry; never detach Vercel domain.
      await supabase
        .from("project_domains")
        .update({
          ...prior,
          failure_reason:
            "Could not confirm the domain is still on that Vercel project. The live site was not changed.",
        })
        .eq("id", domainId)
        .eq("owner_id", user.id);

      return NextResponse.json(
        {
          error:
            "Could not confirm the domain is still on that Vercel project. Your website was not changed.",
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("project_domains")
      .update({
        status: "active",
        migration_state: "linked",
        linked_project_id: domain.linked_project_id,
        linked_project_name: meta.projectName || domain.linked_project_name,
        linked_at: now,
        verified_at: domain.verified_at ?? now,
        activated_at: domain.activated_at ?? now,
        last_checked_at: now,
        failure_reason: null,
        verification_records: confirmed.verificationRecords,
        provider_domain_id: confirmed.providerDomainId || domain.provider_domain_id,
      })
      .eq("id", domainId)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      await supabase
        .from("project_domains")
        .update(prior)
        .eq("id", domainId)
        .eq("owner_id", user.id);

      return NextResponse.json(
        { error: safeDomainErrorMessage(updateError) },
        { status: 500 },
      );
    }

    console.info("[domains.link]", {
      domainId,
      hostname: domain.normalized_hostname,
      linkedProjectIdTail: `…${domain.linked_project_id.slice(-6)}`,
      migrationState: "linked",
    });

    return NextResponse.json({
      domain: toPublicProjectDomain(
        rowToProjectDomain(updated as ProjectDomainRow),
      ),
      live: true,
      linked: true,
      message:
        "Project linked. Your website stays live. Normal Publish still uses Atlas preview hosting — use Publish to Production for an explicit cutover.",
    });
  } catch (error) {
    await supabase
      .from("project_domains")
      .update({
        ...prior,
        failure_reason: safeDomainErrorMessage(error),
      })
      .eq("id", domainId)
      .eq("owner_id", user.id);

    return NextResponse.json(
      { error: safeDomainErrorMessage(error) },
      { status: 502 },
    );
  }
}
