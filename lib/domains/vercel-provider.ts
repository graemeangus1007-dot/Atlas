/**
 * Server-only Vercel Domains API (Sprint 16.0B).
 * Never import from client components — reads VERCEL_TOKEN.
 */

import {
  getVercelDeploymentConfig,
  redactSecrets,
} from "@/lib/deployment/server-config";
import {
  mapProviderSignalsToStatus,
  type DomainProvider,
  type DomainProviderAddResult,
  type DomainProviderInspectResult,
  type DomainProviderProjectMeta,
  type DomainProviderVerifyResult,
} from "@/lib/domains/provider";
import type { DomainDnsRecord } from "@/lib/domains/types";

const VERCEL_API_BASE = "https://api.vercel.com";

export type VercelDomainProviderOptions = {
  token?: string;
  projectId?: string;
  teamId?: string;
  fetchImpl?: typeof fetch;
};

type VercelVerificationChallenge = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

type VercelProjectDomain = {
  name?: string;
  verified?: boolean;
  verification?: VercelVerificationChallenge[];
};

type VercelDomainConfig = {
  misconfigured?: boolean;
  configuredBy?: string | null;
  acceptedChallenges?: unknown[];
};

function teamQuery(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function mapVerificationRecords(
  challenges: VercelVerificationChallenge[] | undefined,
  fallbackHostname: string,
): DomainDnsRecord[] {
  const fromApi: DomainDnsRecord[] = (challenges ?? []).map((item) => {
    const typeUpper = (item.type ?? "TXT").toUpperCase();
    const type =
      typeUpper === "CNAME"
        ? "CNAME"
        : typeUpper === "A"
          ? "A"
          : typeUpper === "AAAA"
            ? "AAAA"
            : "TXT";
    return {
      type,
      name: item.domain || fallbackHostname,
      value: item.value || "",
    };
  });

  // Supplement with standard Vercel routing records when API only returns TXT challenges.
  const hostname = fallbackHostname.toLowerCase();
  const labels = hostname.split(".");
  const isApex = labels.length === 2;
  const hasCname = fromApi.some((r) => r.type === "CNAME");
  const hasA = fromApi.some((r) => r.type === "A");

  if (isApex && !hasA) {
    fromApi.push({
      type: "A",
      name: "@",
      value: "76.76.21.21",
      ttl: 300,
    });
  }
  if (!isApex && !hasCname) {
    fromApi.push({
      type: "CNAME",
      name: hostname,
      value: "cname.vercel-dns.com",
      ttl: 300,
    });
  }

  return fromApi;
}

/**
 * Vercel Domains API provider.
 * Uses server env credentials; redacts secrets from thrown errors.
 */
export class VercelDomainProvider implements DomainProvider {
  readonly id = "vercel";

  private readonly token: string;
  private readonly projectId: string;
  private readonly teamId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: VercelDomainProviderOptions = {}) {
    if (options.token && options.projectId) {
      this.token = options.token;
      this.projectId = options.projectId;
      this.teamId = options.teamId;
    } else {
      const config = getVercelDeploymentConfig();
      this.token = options.token ?? config.token;
      this.projectId = options.projectId ?? config.projectId;
      this.teamId = options.teamId ?? config.teamId;
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private safeError(status: number, bodyText: string): Error {
    let apiMessage = bodyText.slice(0, 280);
    try {
      const parsed = JSON.parse(bodyText) as {
        error?: { message?: string; code?: string };
        message?: string;
      };
      apiMessage =
        parsed.error?.message || parsed.message || apiMessage;
    } catch {
      // keep slice
    }
    return new Error(
      redactSecrets(
        `Vercel Domains API error (${status}): ${apiMessage}`,
        this.token,
      ),
    );
  }

  private async request(
    path: string,
    init?: RequestInit,
  ): Promise<unknown> {
    const res = await this.fetchImpl(`${VERCEL_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw this.safeError(res.status, text);
    }
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("Vercel Domains API returned invalid JSON.");
    }
  }

  private async getDomainConfig(hostname: string): Promise<VercelDomainConfig> {
    try {
      return (await this.request(
        `/v6/domains/${encodeURIComponent(hostname)}/config${teamQuery(this.teamId)}`,
      )) as VercelDomainConfig;
    } catch {
      // Config endpoint may 404 before ownership is established.
      return { misconfigured: true };
    }
  }

  private async loadProjectDomainOn(
    vercelProjectId: string,
    providerDomainId: string,
  ): Promise<VercelProjectDomain> {
    return (await this.request(
      `/v9/projects/${encodeURIComponent(vercelProjectId)}/domains/${encodeURIComponent(providerDomainId)}${teamQuery(this.teamId)}`,
    )) as VercelProjectDomain;
  }

  private async loadProjectDomain(
    providerDomainId: string,
  ): Promise<VercelProjectDomain> {
    return this.loadProjectDomainOn(this.projectId, providerDomainId);
  }

  private async inspectDomainOnProject(
    vercelProjectId: string,
    providerDomainId: string,
  ): Promise<DomainProviderInspectResult> {
    const data = await this.loadProjectDomainOn(
      vercelProjectId,
      providerDomainId,
    );
    const hostname = data.name || providerDomainId;
    const ownershipVerified = Boolean(data.verified);
    const config = ownershipVerified
      ? await this.getDomainConfig(hostname)
      : { misconfigured: true };
    const misconfigured = config.misconfigured !== false;
    const sslReady = ownershipVerified && !misconfigured;
    const serving = sslReady;
    const verificationRecords = mapVerificationRecords(
      data.verification,
      hostname,
    );

    return {
      providerDomainId,
      hostname,
      ownershipVerified,
      sslReady,
      serving,
      verificationRecords,
      misconfigured,
      rawStatus: ownershipVerified
        ? sslReady
          ? "active"
          : "ssl_provisioning"
        : "pending",
    };
  }

  /**
   * GET project metadata when the project is in the configured account/team.
   * 403/404 → accessible:false (different account or missing).
   */
  async getProject(projectId: string): Promise<DomainProviderProjectMeta> {
    const path = `/v9/projects/${encodeURIComponent(projectId)}${teamQuery(this.teamId)}`;
    const res = await this.fetchImpl(`${VERCEL_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      console.info("[domains.vercel.getProject]", {
        projectIdTail:
          projectId.length > 6 ? `…${projectId.slice(-6)}` : projectId,
        status: res.status,
        accessible: false,
      });
      return {
        projectId,
        projectName: "",
        accessible: false,
      };
    }

    let name = "";
    try {
      const parsed = JSON.parse(text) as { id?: string; name?: string };
      name = parsed.name?.trim() || parsed.id || projectId;
    } catch {
      name = projectId;
    }

    return {
      projectId,
      projectName: name,
      accessible: true,
    };
  }

  async confirmDomainOnProject(input: {
    projectId: string;
    hostname: string;
  }): Promise<DomainProviderInspectResult | null> {
    const meta = await this.getProject(input.projectId);
    if (!meta.accessible) return null;
    try {
      return await this.inspectDomainOnProject(
        input.projectId,
        input.hostname,
      );
    } catch {
      return null;
    }
  }

  async addDomain(hostname: string): Promise<DomainProviderAddResult> {
    const path = `/v10/projects/${encodeURIComponent(this.projectId)}/domains${teamQuery(this.teamId)}`;
    const url = `${VERCEL_API_BASE}${path}`;
    const requestBody = { name: hostname };

    console.info("[domains.vercel.addDomain] request", {
      method: "POST",
      endpoint: "Add Domain to Project (POST /v10/projects/{id}/domains)",
      url: url.replace(this.projectId, `…${this.projectId.slice(-6)}`),
      teamIdSent: Boolean(this.teamId),
      vercelProjectIdTail: `…${this.projectId.slice(-6)}`,
      hostname,
    });

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const text = await res.text();

    let parsedBody: unknown = null;
    try {
      parsedBody = text ? JSON.parse(text) : null;
    } catch {
      parsedBody = { raw: text.slice(0, 500) };
    }

    if (res.status === 409) {
      const conflict = parsedBody as {
        error?: {
          code?: string;
          projectId?: string;
          message?: string;
        };
      };
      const ownerProjectId = conflict.error?.projectId?.trim();
      const code = conflict.error?.code;

      console.info("[domains.vercel.addDomain] conflict", {
        status: 409,
        code: code ?? null,
        ownerProjectIdTail: ownerProjectId
          ? `…${ownerProjectId.slice(-6)}`
          : null,
        message: redactSecrets(
          conflict.error?.message || "domain_already_in_use",
          this.token,
        ).slice(0, 200),
      });

      if (
        ownerProjectId &&
        (code === "domain_already_in_use" ||
          /already in use/i.test(conflict.error?.message || ""))
      ) {
        const meta = await this.getProject(ownerProjectId);
        if (meta.accessible) {
          // Same account/team — offer zero-downtime link. Do not remove the domain.
          let inspected: DomainProviderInspectResult | null = null;
          try {
            inspected = await this.inspectDomainOnProject(
              ownerProjectId,
              hostname,
            );
          } catch {
            inspected = null;
          }

          const verificationRecords =
            inspected?.verificationRecords ??
            mapVerificationRecords(undefined, hostname);
          const verificationToken =
            verificationRecords.find((r) => r.type === "TXT")?.value ||
            `linked-${hostname}`;

          return {
            kind: "existing_project",
            hostname,
            linkedProjectId: ownerProjectId,
            linkedProjectName: meta.projectName || ownerProjectId,
            providerDomainId: hostname,
            verificationToken,
            verificationMethod: "dns-txt",
            verificationRecords,
            ownershipVerified: inspected?.ownershipVerified ?? true,
            sslReady: inspected?.sslReady ?? true,
            serving: inspected?.serving ?? true,
          };
        }
        // Different account — fall through to normal error (caller continues DNS flow messaging).
      }
    }

    if (!res.ok) {
      throw this.safeError(res.status, text);
    }

    const data = (parsedBody ?? {}) as VercelProjectDomain;
    const verificationRecords = mapVerificationRecords(
      data.verification,
      data.name || hostname,
    );

    return {
      kind: "created",
      providerDomainId: data.name || hostname,
      verificationToken:
        verificationRecords.find((r) => r.type === "TXT")?.value ||
        `pending-${hostname}`,
      verificationMethod: "dns-txt",
      verificationRecords,
    };
  }

  async getDomain(providerDomainId: string) {
    return this.inspectDomain(providerDomainId);
  }

  async inspectDomain(
    providerDomainId: string,
  ): Promise<DomainProviderInspectResult> {
    return this.inspectDomainOnProject(this.projectId, providerDomainId);
  }

  async getVerificationRecords(providerDomainId: string) {
    const inspected = await this.inspectDomain(providerDomainId);
    return inspected.verificationRecords;
  }

  async verifyDomain(
    providerDomainId: string,
  ): Promise<DomainProviderVerifyResult> {
    let ownershipVerified = false;
    let failureReason: string | null = null;
    let verificationRecords: DomainDnsRecord[] = [];
    let hostname = providerDomainId;

    try {
      // Trigger verification challenge check.
      const verifiedBody = (await this.request(
        `/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(providerDomainId)}/verify${teamQuery(this.teamId)}`,
        { method: "POST" },
      )) as VercelProjectDomain;

      ownershipVerified = Boolean(verifiedBody.verified);
      hostname = verifiedBody.name || providerDomainId;
      verificationRecords = mapVerificationRecords(
        verifiedBody.verification,
        hostname,
      );

      if (!ownershipVerified) {
        failureReason =
          verifiedBody.verification?.[0]?.reason ||
          "Domain ownership is not verified yet. Confirm the DNS TXT record and try again.";
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Domain verification failed.";
      // Soft-fail into inspect — some domains are already verified and reject re-verify.
      try {
        const current = await this.inspectDomain(providerDomainId);
        ownershipVerified = current.ownershipVerified;
        verificationRecords = current.verificationRecords;
        hostname = current.hostname;
        if (!ownershipVerified) {
          failureReason = redactSecrets(message, this.token);
        }
      } catch {
        return {
          ownershipVerified: false,
          sslReady: false,
          serving: false,
          verificationRecords: [],
          failureReason: redactSecrets(message, this.token),
          suggestedStatus: "failed",
        };
      }
    }

    // Ownership ok ≠ SSL ready. Check config / serving.
    let sslReady = false;
    let serving = false;
    if (ownershipVerified) {
      const config = await this.getDomainConfig(hostname);
      const misconfigured = config.misconfigured !== false;
      sslReady = !misconfigured;
      serving = sslReady;
      if (!sslReady) {
        failureReason = null; // still progressing — not a hard failure
      }
      // Refresh records after verify.
      try {
        const fresh = await this.loadProjectDomain(providerDomainId);
        verificationRecords = mapVerificationRecords(
          fresh.verification,
          fresh.name || hostname,
        );
      } catch {
        // keep existing records
      }
    }

    const suggestedStatus = mapProviderSignalsToStatus({
      ownershipVerified,
      sslReady,
      serving,
      hardFailure: Boolean(failureReason) && !ownershipVerified,
      failureReason,
    });

    return {
      ownershipVerified,
      sslReady,
      serving,
      verificationRecords,
      failureReason,
      suggestedStatus,
    };
  }

  async removeDomain(providerDomainId: string) {
    await this.request(
      `/v9/projects/${encodeURIComponent(this.projectId)}/domains/${encodeURIComponent(providerDomainId)}${teamQuery(this.teamId)}`,
      { method: "DELETE" },
    );
  }
}
