import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MockDomainProvider } from "@/lib/domains/mock-provider";
import {
  shouldDetachDomainFromProvider,
  shouldUseLinkedVercelProject,
} from "@/lib/domains/provider";
import { resolveVercelDeployProjectId } from "@/lib/domains/resolve-deploy-project";
import { shouldPollDomainStatus } from "@/lib/domains/status";
import { VercelDomainProvider } from "@/lib/domains/vercel-provider";

describe("existing Vercel project linking", () => {
  it("detects same-account existing project on addDomain", async () => {
    const provider = new MockDomainProvider();
    provider.registerExistingProject("www.northforgedigital.dev", {
      projectId: "prj_existing_avft",
      projectName: "northforge-digital-avft",
      sameAccount: true,
    });

    const added = await provider.addDomain("www.northforgedigital.dev");
    expect(added.kind).toBe("existing_project");
    if (added.kind !== "existing_project") return;
    expect(added.linkedProjectName).toBe("northforge-digital-avft");
    expect(added.linkedProjectId).toBe("prj_existing_avft");
    expect(added.serving).toBe(true);
  });

  it("rejects different-account conflicts without existing_project", async () => {
    const provider = new MockDomainProvider();
    provider.registerExistingProject("www.other.com", {
      projectId: "prj_other",
      projectName: "other",
      sameAccount: false,
    });

    await expect(provider.addDomain("www.other.com")).rejects.toThrow(/409|already in use/i);
  });

  it("Vercel provider returns existing_project for same-account 409", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/domains") && method === "POST" && !url.includes("/verify")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "domain_already_in_use",
              projectId: "prj_owner_avft12",
              message:
                "Cannot add www.northforgedigital.dev since it's already in use by one of your projects.",
            },
          }),
          { status: 409 },
        );
      }

      if (url.includes("/v9/projects/prj_owner_avft12") && !url.includes("/domains")) {
        return new Response(
          JSON.stringify({ id: "prj_owner_avft12", name: "northforge-digital-avft" }),
          { status: 200 },
        );
      }

      if (url.includes("/domains/www.northforgedigital.dev") && method === "GET") {
        return new Response(
          JSON.stringify({
            name: "www.northforgedigital.dev",
            verified: true,
            verification: [],
          }),
          { status: 200 },
        );
      }

      if (url.includes("/config")) {
        return new Response(JSON.stringify({ misconfigured: false }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ error: { message: "unexpected" } }), {
        status: 500,
      });
    }) as unknown as typeof fetch;

    const provider = new VercelDomainProvider({
      token: "test-token",
      projectId: "prj_atlas_sites",
      fetchImpl,
    });

    const added = await provider.addDomain("www.northforgedigital.dev");
    expect(added.kind).toBe("existing_project");
    if (added.kind !== "existing_project") return;
    expect(added.linkedProjectName).toBe("northforge-digital-avft");
    expect(added.linkedProjectId).toBe("prj_owner_avft12");
  });

  it("rejects linking when conflict project is not accessible", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST" && url.includes("/domains")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "domain_already_in_use",
              projectId: "prj_foreign",
              message: "already in use",
            },
          }),
          { status: 409 },
        );
      }
      if (url.includes("/v9/projects/prj_foreign")) {
        return new Response(
          JSON.stringify({ error: { code: "forbidden" } }),
          { status: 403 },
        );
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new VercelDomainProvider({
      token: "test-token",
      projectId: "prj_atlas_sites",
      fetchImpl,
    });

    await expect(provider.addDomain("www.foreign.dev")).rejects.toThrow(/409|already in use/i);
  });
});

describe("migration state helpers", () => {
  it("linked state is for domain ops — not automatic publish targeting", () => {
    // Domain provider scoping still uses linked/migrated.
    expect(shouldUseLinkedVercelProject("detected", "prj_x")).toBe(false);
    expect(shouldUseLinkedVercelProject("linked", "prj_x")).toBe(true);
    expect(shouldUseLinkedVercelProject("migrated", "prj_x")).toBe(true);
    expect(shouldUseLinkedVercelProject("linked", null)).toBe(false);

    expect(shouldDetachDomainFromProvider("none")).toBe(true);
    expect(shouldDetachDomainFromProvider("detected")).toBe(false);
    expect(shouldDetachDomainFromProvider("linked")).toBe(false);

    expect(shouldPollDomainStatus("pending", "detected")).toBe(false);
    expect(shouldPollDomainStatus("pending", "none")).toBe(true);
  });

  it("normal publish never targets linked production; production needs confirmation", async () => {
    const prevToken = process.env.VERCEL_TOKEN;
    const prevProject = process.env.VERCEL_PROJECT_ID;
    process.env.VERCEL_TOKEN = "test-token";
    process.env.VERCEL_PROJECT_ID = "prj_atlas_sites_default";

    const linkedSupabase = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: {
                          hostname: "www.northforgedigital.dev",
                          normalized_hostname: "www.northforgedigital.dev",
                          linked_project_id: "prj_linked_prod",
                          linked_project_name: "northforge-digital-avft",
                          migration_state: "linked",
                        },
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as never;

    try {
      const preview = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        target: "preview",
      });
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      expect(preview.source).toBe("preview_default");
      expect(preview.vercelProjectId).toBe("prj_atlas_sites_default");

      const forceStyle = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        // Force Redeploy path must resolve like preview.
        target: "preview",
      });
      expect(forceStyle.ok).toBe(true);
      if (!forceStyle.ok) return;
      expect(forceStyle.vercelProjectId).toBe("prj_atlas_sites_default");

      const missingConfirm = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        target: "production",
      });
      expect(missingConfirm.ok).toBe(false);
      if (missingConfirm.ok) return;
      expect(missingConfirm.code).toBe("confirmation_required");

      const badConfirm = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        target: "production",
        productionConfirmation: "wrong-name",
      });
      expect(badConfirm.ok).toBe(false);

      const production = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        target: "production",
        productionConfirmation: "www.northforgedigital.dev",
      });
      expect(production.ok).toBe(true);
      if (!production.ok) return;
      expect(production.source).toBe("production_linked");
      expect(production.vercelProjectId).toBe("prj_linked_prod");

      const byProjectName = await resolveVercelDeployProjectId({
        supabase: linkedSupabase,
        ownerId: "user_1",
        atlasProjectId: "atlas_proj_1",
        target: "production",
        productionConfirmation: "northforge-digital-avft",
      });
      expect(byProjectName.ok).toBe(true);
      if (!byProjectName.ok) return;
      expect(byProjectName.vercelProjectId).toBe("prj_linked_prod");
    } finally {
      if (prevToken === undefined) delete process.env.VERCEL_TOKEN;
      else process.env.VERCEL_TOKEN = prevToken;
      if (prevProject === undefined) delete process.env.VERCEL_PROJECT_ID;
      else process.env.VERCEL_PROJECT_ID = prevProject;
    }
  });
});

describe("link UI + API contracts", () => {
  it("UI shows link confirmation copy and actions", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../components/publishing/custom-domain-section.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("This domain is already connected to:");
    expect(source).toContain("Link Project");
    expect(source).toContain("Your website stays live");
    expect(source).toContain("Publish to Production");
    expect(source).toContain("Normal Publish still deploys");
    expect(source).toContain("/link");
    expect(source).toContain('migrationState === "detected"');
  });

  it("link route re-verifies ownership and rolls back on failure", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/[id]/link/route.ts"),
      "utf8",
    );
    expect(source).toContain("confirmDomainOnProject");
    expect(source).toContain("getProject");
    expect(source).toContain("migration_state");
    expect(source).toContain("linked");
    expect(source).toContain("prior");
    expect(source).toContain('eq("owner_id", user.id)');
  });

  it("delete never detaches linked/detected production domains", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/[id]/route.ts"),
      "utf8",
    );
    expect(source).toContain("shouldDetachDomainFromProvider");
  });

  it("deploy route defaults to preview and coerces force away from production", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/deployment/deploy/route.ts"),
      "utf8",
    );
    expect(source).toContain("resolveVercelDeployProjectId");
    expect(source).toContain("vercelProjectId");
    expect(source).toContain('deployTarget');
    expect(source).toContain("productionConfirmation");
    expect(source).toContain(
      "Force Redeploy / normal Publish can never target linked production",
    );
    expect(source).toContain(
      'force || requestedTarget !== "production" ? "preview" : "production"',
    );
  });

  it("migration SQL adds linked project columns", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260729_project_domains_linked_project.sql",
      ),
      "utf8",
    );
    expect(source).toContain("linked_project_id");
    expect(source).toContain("linked_project_name");
    expect(source).toContain("migration_state");
    expect(source).toContain("linked_at");
    expect(source).toContain("'detected'");
    expect(source).toContain("'linked'");
  });
});
