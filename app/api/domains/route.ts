import { NextResponse } from "next/server";
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
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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
      response: NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, userId: user.id, supabase };
}

/**
 * GET /api/domains?projectId=
 * List custom domains for a project the caller owns.
 */
export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId query parameter." },
      { status: 400 },
    );
  }

  const auth = await requireOwnedProject(projectId);
  if (!auth.ok) return auth.response;

  const rate = checkDomainRateLimit(`domains:list:${auth.userId}`, {
    limit: 60,
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

  const { data, error } = await auth.supabase
    .from("project_domains")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: safeDomainErrorMessage(error) },
      { status: 500 },
    );
  }

  const domains = ((data ?? []) as ProjectDomainRow[]).map((row) =>
    toPublicProjectDomain(rowToProjectDomain(row)),
  );

  return NextResponse.json({ domains });
}

/**
 * POST /api/domains
 * Body: { projectId, hostname }
 * Creates a pending domain, asks the provider for DNS records, saves them.
 * Never trusts owner_id from the client.
 */
export async function POST(request: Request) {
  let body: { projectId?: string; hostname?: string; owner_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Never accept ownership claims from the browser.
  if (body.owner_id != null) {
    return NextResponse.json(
      { error: "owner_id cannot be set by the client." },
      { status: 400 },
    );
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }

  const auth = await requireOwnedProject(projectId);
  if (!auth.ok) return auth.response;

  const rate = checkDomainRateLimit(`domains:create:${auth.userId}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many domain requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const validated = normalizeAndValidateHostname(body.hostname ?? "");
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  // One domain per project — reject if one already exists.
  const { data: existingForProject } = await auth.supabase
    .from("project_domains")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingForProject) {
    return NextResponse.json(
      {
        error:
          "This project already has a custom domain. Remove it before adding another.",
      },
      { status: 409 },
    );
  }

  const { data: existingHostname } = await auth.supabase
    .from("project_domains")
    .select("id")
    .eq("normalized_hostname", validated.normalizedHostname)
    .maybeSingle();

  if (existingHostname) {
    return NextResponse.json(
      { error: "That domain is already connected to a project." },
      { status: 409 },
    );
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
        return NextResponse.json(
          { error: safeDomainErrorMessage(insertError) },
          { status: 500 },
        );
      }

      const domain = toPublicProjectDomain(
        rowToProjectDomain(inserted as ProjectDomainRow),
      );

      return NextResponse.json({
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
      });
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
      return NextResponse.json(
        { error: safeDomainErrorMessage(insertError) },
        { status: 500 },
      );
    }

    const domain = toPublicProjectDomain(
      rowToProjectDomain(inserted as ProjectDomainRow),
    );

    return NextResponse.json({
      domain,
      // Explicit: not live yet.
      live: false,
      requiresLinkConfirmation: false,
      message:
        "Domain saved as pending. Configure the DNS records below — this domain is not live yet.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeDomainErrorMessage(error) },
      { status: 502 },
    );
  }
}
