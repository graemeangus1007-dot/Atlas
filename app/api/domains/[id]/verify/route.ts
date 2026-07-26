import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProviderForDomainRow } from "@/lib/domains/create-provider";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { createDomainProviderForRow } from "@/lib/domains/provider-for-row";
import {
  safeDomainErrorMessage,
  toPublicProjectDomain,
  rowToProjectDomain,
} from "@/lib/domains/serialize";
import { runDomainVerification } from "@/lib/domains/verify";
import type { ProjectDomainRow } from "@/lib/domains/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/domains/[id]/verify
 * Authenticate → ownership → rate limit → provider.verifyDomain → update row.
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

  const rate = checkDomainRateLimit(`domains:verify:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification requests. Try again shortly." },
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

  // Detected-but-unlinked domains should link, not run DNS verify.
  if (domain.migration_state === "detected") {
    return NextResponse.json(
      {
        domain: toPublicProjectDomain(rowToProjectDomain(domain)),
        live: true,
        requiresLinkConfirmation: true,
        error:
          "This domain is already on another Vercel project. Link the project to continue.",
      },
      { status: 409 },
    );
  }

  const resolved = resolveProviderForDomainRow(domain);
  if (!resolved.ok) {
    const checkedAt = new Date().toISOString();
    console.info("[domains.verify]", {
      domainId: domain.id,
      hostname: domain.normalized_hostname || domain.hostname,
      storedProvider: domain.provider,
      resolvedProvider: null,
      mismatch: resolved.code,
    });

    const { data: updatedRow, error: updateError } = await supabase
      .from("project_domains")
      .update({
        status: "failed",
        last_checked_at: checkedAt,
        failure_reason: resolved.message,
        verified_at: null,
        activated_at: null,
      })
      .eq("id", domainId)
      .eq("owner_id", user.id)
      .select("*")
      .single();

    if (updateError || !updatedRow) {
      return NextResponse.json(
        { error: resolved.message },
        { status: 409 },
      );
    }

    return NextResponse.json({
      domain: toPublicProjectDomain(
        rowToProjectDomain(updatedRow as ProjectDomainRow),
      ),
      live: false,
      error: resolved.message,
    });
  }

  try {
    const provider = createDomainProviderForRow(domain);
    console.info("[domains.verify] start", {
      domainId: domain.id,
      hostname: domain.normalized_hostname || domain.hostname,
      storedProvider: domain.provider,
      resolvedProvider: provider.id,
      migrationState: domain.migration_state,
    });

    const updated = await runDomainVerification({
      domain,
      provider,
      persistence: {
        async updateDomain(id, patch) {
          const { data, error } = await supabase
            .from("project_domains")
            .update(patch)
            .eq("id", id)
            .eq("owner_id", user.id)
            .select("*")
            .single();
          if (error || !data) {
            throw error ?? new Error("Failed to update domain status.");
          }
          return data as ProjectDomainRow;
        },
      },
    });

    return NextResponse.json({
      domain: toPublicProjectDomain(updated),
      live: updated.status === "active",
    });
  } catch (error) {
    // Persist a failed check when the provider throws.
    const reason = safeDomainErrorMessage(error);
    const checkedAt = new Date().toISOString();
    console.info("[domains.verify] provider_error", {
      domainId,
      hostname: domain.normalized_hostname || domain.hostname,
      resolvedProvider: resolved.ok ? resolved.providerId : null,
      error: reason.slice(0, 200),
    });

    const { data: failedRow } = await supabase
      .from("project_domains")
      .update({
        status: "failed",
        last_checked_at: checkedAt,
        failure_reason: reason,
        verified_at: null,
        activated_at: null,
      })
      .eq("id", domainId)
      .eq("owner_id", user.id)
      .select("*")
      .maybeSingle();

    if (failedRow) {
      return NextResponse.json(
        {
          domain: toPublicProjectDomain(
            rowToProjectDomain(failedRow as ProjectDomainRow),
          ),
          live: false,
          error: reason,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
