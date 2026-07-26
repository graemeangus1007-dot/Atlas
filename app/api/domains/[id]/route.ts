import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkDomainRateLimit } from "@/lib/domains/rate-limit";
import { shouldDetachDomainFromProvider } from "@/lib/domains/provider";
import { createDomainProviderForRow } from "@/lib/domains/provider-for-row";
import { safeDomainErrorMessage } from "@/lib/domains/serialize";
import { hydrateMockProviderFromRow } from "@/lib/domains/verify";
import type { ProjectDomainRow } from "@/lib/domains/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/domains/[id]
 * Remove a domain in any removable status (including active). UI confirms first.
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

  const rate = checkDomainRateLimit(`domains:delete:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
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

  // Confirm project ownership (never trust client).
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

  // Allow remove for any status in 16.0B (including active); UI confirms first.
  const removable = new Set([
    "pending",
    "verifying",
    "ssl_provisioning",
    "verified",
    "failed",
    "active",
  ]);
  if (!removable.has(domain.status)) {
    return NextResponse.json(
      { error: "This domain cannot be removed in its current state." },
      { status: 409 },
    );
  }

  // Linked / detected domains must stay on Vercel — never take production offline.
  const mayDetach = shouldDetachDomainFromProvider(domain.migration_state);

  if (mayDetach && domain.provider_domain_id) {
    try {
      const provider = createDomainProviderForRow(domain);
      hydrateMockProviderFromRow(provider, domain);
      await provider.removeDomain(domain.provider_domain_id);
    } catch (error) {
      // Continue with DB delete for mock / missing provider entries;
      // surface a soft warning in the response body.
      const warning = safeDomainErrorMessage(error);
      const { error: deleteError } = await supabase
        .from("project_domains")
        .delete()
        .eq("id", domainId)
        .eq("owner_id", user.id);

      if (deleteError) {
        return NextResponse.json(
          { error: safeDomainErrorMessage(deleteError) },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        warning: `Domain removed from Atlas. Provider cleanup warning: ${warning}`,
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("project_domains")
    .delete()
    .eq("id", domainId)
    .eq("owner_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: safeDomainErrorMessage(deleteError) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
