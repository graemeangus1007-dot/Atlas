import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MockDomainProvider } from "@/lib/domains/mock-provider";
import { mapProviderSignalsToStatus } from "@/lib/domains/provider";
import {
  resolveActiveCustomDomainUrl,
  resolvePublishSiteUrl,
  shouldPollDomainStatus,
} from "@/lib/domains/status";
import {
  finalizeVerificationStatus,
  runDomainVerification,
} from "@/lib/domains/verify";
import { resolveProviderForDomainRow } from "@/lib/domains/create-provider";
import type { ProjectDomainRow } from "@/lib/domains/types";
import { VercelDomainProvider } from "@/lib/domains/vercel-provider";

function baseRow(overrides: Partial<ProjectDomainRow> = {}): ProjectDomainRow {
  const now = "2026-07-23T12:00:00.000Z";
  return {
    id: "dom_1",
    project_id: "proj_1",
    owner_id: "user_1",
    hostname: "www.example.com",
    normalized_hostname: "www.example.com",
    domain_type: "subdomain",
    status: "pending",
    verification_token: "atlas-verify-test",
    verification_method: "dns-txt",
    verification_records: [
      {
        type: "TXT",
        name: "_atlas-verify.www.example.com",
        value: "atlas-verify-test",
      },
    ],
    provider: "mock",
    provider_domain_id: "mock_abc",
    last_checked_at: null,
    verified_at: null,
    activated_at: null,
    failure_reason: null,
    linked_project_id: null,
    linked_project_name: null,
    migration_state: "none",
    linked_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("mapProviderSignalsToStatus", () => {
  it("requires ownership + SSL + serving for active", () => {
    expect(
      mapProviderSignalsToStatus({
        ownershipVerified: true,
        sslReady: false,
        serving: false,
      }),
    ).toBe("ssl_provisioning");

    expect(
      mapProviderSignalsToStatus({
        ownershipVerified: true,
        sslReady: true,
        serving: true,
      }),
    ).toBe("active");

    expect(
      mapProviderSignalsToStatus({
        ownershipVerified: false,
        sslReady: false,
        serving: false,
        hardFailure: true,
      }),
    ).toBe("failed");
  });
});

describe("finalizeVerificationStatus", () => {
  it("keeps ownership success statuses", () => {
    expect(
      finalizeVerificationStatus({
        ownershipVerified: true,
        suggestedStatus: "ssl_provisioning",
        failureReason: null,
      }),
    ).toEqual({ status: "ssl_provisioning", failureReason: null });

    expect(
      finalizeVerificationStatus({
        ownershipVerified: true,
        suggestedStatus: "active",
        failureReason: null,
      }),
    ).toEqual({ status: "active", failureReason: null });
  });

  it("coerces unverified soft-pending into failed with a reason", () => {
    const result = finalizeVerificationStatus({
      ownershipVerified: false,
      suggestedStatus: "pending",
      failureReason: null,
    });
    expect(result.status).toBe("failed");
    expect(result.failureReason).toMatch(/not verified/i);
  });
});

describe("runDomainVerification lifecycle", () => {
  it("verify failure (DNS not ready) becomes failed with failure_reason", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "pending" });
    const added = await provider.addDomain("www.example.com");
    const row = baseRow({
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const patches: Array<{ status: string; failure_reason?: string | null }> =
      [];
    const updated = await runDomainVerification({
      domain: row,
      provider,
      now: () => new Date("2026-07-23T12:02:00.000Z"),
      persistence: {
        async updateDomain(id, patch) {
          patches.push({
            status: patch.status,
            failure_reason: patch.failure_reason,
          });
          return {
            ...row,
            id,
            status: patch.status,
            verification_records:
              patch.verification_records ?? row.verification_records,
            last_checked_at: patch.last_checked_at,
            verified_at: patch.verified_at ?? null,
            activated_at: patch.activated_at ?? null,
            failure_reason: patch.failure_reason ?? null,
          };
        },
      },
    });

    expect(patches[0]?.status).toBe("verifying");
    expect(updated.status).toBe("failed");
    expect(updated.failureReason).toMatch(/DNS records/i);
    expect(updated.lastCheckedAt).toBe("2026-07-23T12:02:00.000Z");
    expect(updated.activatedAt).toBeNull();
  });

  it("verification success → ssl_provisioning when ownership ok but SSL pending", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "ssl_pending" });
    const added = await provider.addDomain("www.example.com");
    const row = baseRow({
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const patches: Array<{ status: string }> = [];
    const updated = await runDomainVerification({
      domain: row,
      provider,
      now: () => new Date("2026-07-23T12:01:00.000Z"),
      persistence: {
        async updateDomain(id, patch) {
          patches.push({ status: patch.status });
          return {
            ...row,
            ...patch,
            id,
            status: patch.status,
            verification_records:
              patch.verification_records ?? row.verification_records,
            last_checked_at: patch.last_checked_at,
            verified_at: patch.verified_at ?? null,
            activated_at: patch.activated_at ?? null,
            failure_reason: patch.failure_reason ?? null,
          };
        },
      },
    });

    expect(patches[0]?.status).toBe("verifying");
    expect(updated.status).toBe("ssl_provisioning");
    expect(updated.verifiedAt).toBe("2026-07-23T12:01:00.000Z");
    expect(updated.activatedAt).toBeNull();
    expect(updated.failureReason).toBeNull();
  });

  it("verification failure stores failure_reason", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "fail" });
    const added = await provider.addDomain("www.example.com");
    const row = baseRow({
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const updated = await runDomainVerification({
      domain: row,
      provider,
      persistence: {
        async updateDomain(id, patch) {
          return {
            ...row,
            id,
            status: patch.status,
            verification_records:
              patch.verification_records ?? row.verification_records,
            last_checked_at: patch.last_checked_at,
            verified_at: patch.verified_at ?? null,
            activated_at: patch.activated_at ?? null,
            failure_reason: patch.failure_reason ?? null,
          };
        },
      },
    });

    expect(updated.status).toBe("failed");
    expect(updated.failureReason).toMatch(/TXT record/i);
  });

  it("SSL pending does not activate", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "ssl_pending" });
    const added = await provider.addDomain("shop.example.com");
    const row = baseRow({
      hostname: "shop.example.com",
      normalized_hostname: "shop.example.com",
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const updated = await runDomainVerification({
      domain: row,
      provider,
      persistence: {
        async updateDomain(id, patch) {
          return {
            ...row,
            id,
            status: patch.status,
            verification_records:
              patch.verification_records ?? row.verification_records,
            last_checked_at: patch.last_checked_at,
            verified_at: patch.verified_at ?? null,
            activated_at: patch.activated_at ?? null,
            failure_reason: patch.failure_reason ?? null,
          };
        },
      },
    });

    expect(updated.status).toBe("ssl_provisioning");
    expect(updated.activatedAt).toBeNull();
  });

  it("activation sets active + activated_at when SSL ready", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "active" });
    const added = await provider.addDomain("www.example.com");
    const row = baseRow({
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const updated = await runDomainVerification({
      domain: row,
      provider,
      now: () => new Date("2026-07-23T12:05:00.000Z"),
      persistence: {
        async updateDomain(id, patch) {
          return {
            ...row,
            id,
            status: patch.status,
            verification_records:
              patch.verification_records ?? row.verification_records,
            last_checked_at: patch.last_checked_at,
            verified_at: patch.verified_at ?? null,
            activated_at: patch.activated_at ?? null,
            failure_reason: patch.failure_reason ?? null,
          };
        },
      },
    });

    expect(updated.status).toBe("active");
    expect(updated.activatedAt).toBe("2026-07-23T12:05:00.000Z");
    expect(updated.verifiedAt).toBe("2026-07-23T12:05:00.000Z");
  });

  it("retry verification can recover from failed → active", async () => {
    const provider = new MockDomainProvider({ defaultScenario: "fail" });
    const added = await provider.addDomain("www.example.com");
    const row = baseRow({
      status: "failed",
      failure_reason: "previous",
      provider_domain_id: added.providerDomainId,
      verification_token: added.verificationToken,
      verification_records: added.verificationRecords,
    });

    const persistence = {
      async updateDomain(id: string, patch: {
        status: ProjectDomainRow["status"];
        verification_records?: ProjectDomainRow["verification_records"];
        last_checked_at: string;
        verified_at?: string | null;
        activated_at?: string | null;
        failure_reason?: string | null;
      }) {
        return {
          ...row,
          id,
          status: patch.status,
          verification_records:
            patch.verification_records ?? row.verification_records,
          last_checked_at: patch.last_checked_at,
          verified_at: patch.verified_at ?? null,
          activated_at: patch.activated_at ?? null,
          failure_reason: patch.failure_reason ?? null,
        };
      },
    };

    const failed = await runDomainVerification({
      domain: row,
      provider,
      persistence,
    });
    expect(failed.status).toBe("failed");

    provider.setScenario(added.providerDomainId, "active");
    const recovered = await runDomainVerification({
      domain: { ...row, status: "failed", failure_reason: failed.failureReason },
      provider,
      now: () => new Date("2026-07-23T13:00:00.000Z"),
      persistence,
    });
    expect(recovered.status).toBe("active");
    expect(recovered.failureReason).toBeNull();
  });

  it("provider hard error bubbles for the verify route to mark failed", async () => {
    const provider = {
      id: "mock",
      async addDomain() {
        throw new Error("unused");
      },
      async getDomain() {
        throw new Error("unused");
      },
      async inspectDomain() {
        throw new Error("unused");
      },
      async getVerificationRecords() {
        throw new Error("unused");
      },
      async verifyDomain() {
        throw new Error("Vercel Domains API error (500): upstream boom");
      },
      async removeDomain() {},
    };

    await expect(
      runDomainVerification({
        domain: baseRow(),
        provider,
        persistence: {
          async updateDomain(id, patch) {
            return {
              ...baseRow(),
              id,
              status: patch.status,
              last_checked_at: patch.last_checked_at,
              verified_at: patch.verified_at ?? null,
              activated_at: patch.activated_at ?? null,
              failure_reason: patch.failure_reason ?? null,
            };
          },
        },
      }),
    ).rejects.toThrow(/upstream boom/i);
  });
});

describe("polling stop conditions", () => {
  it("polls pending / verifying / ssl_provisioning and stops on active or failed", () => {
    expect(shouldPollDomainStatus("pending")).toBe(true);
    expect(shouldPollDomainStatus("verifying")).toBe(true);
    expect(shouldPollDomainStatus("ssl_provisioning")).toBe(true);
    expect(shouldPollDomainStatus("active")).toBe(false);
    expect(shouldPollDomainStatus("failed")).toBe(false);
  });

  it("Custom Domain UI refreshes after verify, polls, and renders failure reasons", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../components/publishing/custom-domain-section.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("POLL_INTERVAL_MS = 15_000");
    expect(source).toContain("shouldPollDomainStatus");
    expect(source).toContain("clearInterval");
    expect(source).toContain("Verify Now");
    expect(source).toContain("Retry Verification");
    expect(source).toContain("Connected");
    // Optimistic verifying + quiet reload after POST /verify
    expect(source).toContain('status: "verifying"');
    expect(source).toContain("loadDomain({ quiet: true })");
    expect(source).toContain("domain.failureReason");
    expect(source).toContain("Last checked");
  });
});

describe("provider resolution", () => {
  it("uses vercel for vercel-stored domains", () => {
    const prevProvider = process.env.DOMAIN_PROVIDER;
    const prevToken = process.env.VERCEL_TOKEN;
    const prevProject = process.env.VERCEL_PROJECT_ID;
    process.env.DOMAIN_PROVIDER = "mock";
    process.env.VERCEL_TOKEN = "test-token";
    process.env.VERCEL_PROJECT_ID = "prj_test";
    try {
      const resolved = resolveProviderForDomainRow({ provider: "vercel" });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.providerId).toBe("vercel");
      expect(resolved.provider.id).toBe("vercel");
    } finally {
      if (prevProvider === undefined) delete process.env.DOMAIN_PROVIDER;
      else process.env.DOMAIN_PROVIDER = prevProvider;
      if (prevToken === undefined) delete process.env.VERCEL_TOKEN;
      else process.env.VERCEL_TOKEN = prevToken;
      if (prevProject === undefined) delete process.env.VERCEL_PROJECT_ID;
      else process.env.VERCEL_PROJECT_ID = prevProject;
    }
  });

  it("rejects mock-stored domains when DOMAIN_PROVIDER=vercel", () => {
    const prev = process.env.DOMAIN_PROVIDER;
    process.env.DOMAIN_PROVIDER = "vercel";
    try {
      const resolved = resolveProviderForDomainRow({ provider: "mock" });
      expect(resolved.ok).toBe(false);
      if (resolved.ok) return;
      expect(resolved.code).toBe("mock_domain_with_vercel_env");
      expect(resolved.message).toMatch(/mock provider/i);
    } finally {
      if (prev === undefined) delete process.env.DOMAIN_PROVIDER;
      else process.env.DOMAIN_PROVIDER = prev;
    }
  });
});

describe("active publish URL", () => {
  it("prefers https://custom.domain over .vercel.app", () => {
    expect(
      resolvePublishSiteUrl({
        deploymentPreviewUrl: "https://site-abc.vercel.app",
        activeCustomHostname: "www.example.com",
      }),
    ).toBe("https://www.example.com");

    expect(
      resolvePublishSiteUrl({
        deploymentPreviewUrl: "https://site-abc.vercel.app",
        activeCustomHostname: null,
      }),
    ).toBe("https://site-abc.vercel.app");

    expect(resolveActiveCustomDomainUrl("WWW.Example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("publish modal keeps preview host and production domain separate", () => {
    const source = readFileSync(
      resolve(__dirname, "../../components/publishing/publish-modal.tsx"),
      "utf8",
    );
    expect(source).toContain("fetchActiveCustomHostname");
    expect(source).toContain("Atlas preview (.vercel.app)");
    expect(source).toContain("Production custom domain");
    expect(source).toContain("url: liveUrl || previewHostUrl");
    expect(source).toContain("setAtlasPreviewUrl(previewHostUrl)");
  });
});

describe("ownership + verify API contracts", () => {
  it("verify route enforces auth, ownership, rate limit, and redaction", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/[id]/verify/route.ts"),
      "utf8",
    );
    expect(source).toContain('eq("owner_id", user.id)');
    expect(source).toContain("checkDomainRateLimit");
    expect(source).toContain("runDomainVerification");
    expect(source).toContain("safeDomainErrorMessage");
    expect(source).toContain("Domain not found or access denied");
    expect(source).toContain("resolveProviderForDomainRow");
    expect(source).toContain("[domains.verify]");
  });

  it("allows removing an active domain", () => {
    const source = readFileSync(
      resolve(__dirname, "../../app/api/domains/[id]/route.ts"),
      "utf8",
    );
    expect(source).toContain('"active"');
    expect(source).toContain("removeDomain");
    expect(source).toContain('eq("owner_id", user.id)');
  });
});

describe("VercelDomainProvider API", () => {
  it("addDomain / verifyDomain / removeDomain call Domains API paths", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.includes("/domains") && method === "POST" && !url.includes("/verify")) {
        return new Response(
          JSON.stringify({
            name: "www.example.com",
            verified: false,
            verification: [
              {
                type: "TXT",
                domain: "_vercel.www.example.com",
                value: "vc-domain-verify=abc",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("/verify") && method === "POST") {
        return new Response(
          JSON.stringify({
            name: "www.example.com",
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

      if (method === "GET" && url.includes("/domains/")) {
        return new Response(
          JSON.stringify({
            name: "www.example.com",
            verified: true,
            verification: [],
          }),
          { status: 200 },
        );
      }

      if (method === "DELETE") {
        return new Response("", { status: 200 });
      }

      return new Response(JSON.stringify({ error: { message: "unexpected" } }), {
        status: 500,
      });
    }) as unknown as typeof fetch;

    const provider = new VercelDomainProvider({
      token: "test-token",
      projectId: "prj_test",
      fetchImpl,
    });

    const added = await provider.addDomain("www.example.com");
    expect(added.kind).toBe("created");
    if (added.kind !== "created") return;
    expect(added.providerDomainId).toBe("www.example.com");
    expect(added.verificationRecords.some((r) => r.type === "TXT")).toBe(true);

    const verified = await provider.verifyDomain("www.example.com");
    expect(verified.ownershipVerified).toBe(true);
    expect(verified.sslReady).toBe(true);
    expect(verified.suggestedStatus).toBe("active");

    const records = await provider.getVerificationRecords("www.example.com");
    expect(Array.isArray(records)).toBe(true);

    const inspected = await provider.getDomain("www.example.com");
    expect(inspected.serving).toBe(true);

    await provider.removeDomain("www.example.com");

    expect(calls.some((c) => c.method === "POST" && c.url.includes("/domains"))).toBe(
      true,
    );
    expect(calls.some((c) => c.url.includes("/verify"))).toBe(true);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("keeps ssl_provisioning when ownership verified but misconfigured", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/verify") && method === "POST") {
        return new Response(
          JSON.stringify({ name: "www.example.com", verified: true }),
          { status: 200 },
        );
      }
      if (url.includes("/config")) {
        return new Response(JSON.stringify({ misconfigured: true }), {
          status: 200,
        });
      }
      if (method === "GET") {
        return new Response(
          JSON.stringify({ name: "www.example.com", verified: true }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new VercelDomainProvider({
      token: "test-token",
      projectId: "prj_test",
      fetchImpl,
    });

    const verified = await provider.verifyDomain("www.example.com");
    expect(verified.ownershipVerified).toBe(true);
    expect(verified.sslReady).toBe(false);
    expect(verified.suggestedStatus).toBe("ssl_provisioning");
  });

  it("redacts token from thrown provider errors", async () => {
    const token = "super-secret-domain-token";
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: { message: `Bearer ${token} rejected` },
        }),
        { status: 401 },
      );
    }) as unknown as typeof fetch;

    const provider = new VercelDomainProvider({
      token,
      projectId: "prj_test",
      fetchImpl,
    });

    await expect(provider.addDomain("www.example.com")).rejects.toThrow(
      /redacted|Vercel Domains API error/i,
    );
    try {
      await provider.addDomain("www.example.com");
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain(token);
    }
  });
});

describe("verification migration", () => {
  it("adds ssl_provisioning to status check", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260728_project_domains_verification.sql",
      ),
      "utf8",
    );
    expect(source).toContain("ssl_provisioning");
    expect(source).toContain("verifying");
  });
});
