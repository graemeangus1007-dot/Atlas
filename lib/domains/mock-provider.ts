import { createHash, randomBytes } from "node:crypto";
import type {
  DomainProvider,
  DomainProviderAddResult,
  DomainProviderProjectMeta,
  DomainProviderVerifyResult,
} from "@/lib/domains/provider";
import type { DomainDnsRecord } from "@/lib/domains/types";

export type MockVerifyScenario =
  | "pending"
  | "fail"
  | "ssl_pending"
  | "active";

type MockDomainEntry = {
  hostname: string;
  verificationToken: string;
  verificationRecords: DomainDnsRecord[];
  scenario: MockVerifyScenario;
  verifyAttempts: number;
};

type MockExistingProject = {
  projectId: string;
  projectName: string;
  sameAccount: boolean;
  ownershipVerified?: boolean;
  sslReady?: boolean;
  serving?: boolean;
};

export type MockDomainProviderOptions = {
  /** Default scenario applied on addDomain. */
  defaultScenario?: MockVerifyScenario;
};

/**
 * In-memory domain provider for tests and local fallback.
 */
export class MockDomainProvider implements DomainProvider {
  readonly id = "mock";

  private readonly domains = new Map<string, MockDomainEntry>();
  private readonly existingByHostname = new Map<string, MockExistingProject>();
  private readonly projects = new Map<
    string,
    { name: string; accessible: boolean }
  >();
  private readonly defaultScenario: MockVerifyScenario;

  constructor(options: MockDomainProviderOptions = {}) {
    this.defaultScenario = options.defaultScenario ?? "pending";
  }

  /** Test helper: force the next verify outcome for a domain. */
  setScenario(providerDomainId: string, scenario: MockVerifyScenario) {
    const entry = this.domains.get(providerDomainId);
    if (entry) entry.scenario = scenario;
  }

  /** Test helper: next addDomain for hostname returns existing_project. */
  registerExistingProject(hostname: string, existing: MockExistingProject) {
    const key = hostname.trim().toLowerCase();
    this.existingByHostname.set(key, existing);
    this.projects.set(existing.projectId, {
      name: existing.projectName,
      accessible: existing.sameAccount,
    });
  }

  /** Whether this in-memory provider already tracks the domain. */
  hasDomain(providerDomainId: string): boolean {
    return this.domains.has(providerDomainId);
  }

  /**
   * Rehydrate a domain from persistence (mock is in-memory per process/request).
   * Used by verify/delete routes so DNS checks work across HTTP requests.
   * Does not overwrite an existing entry (preserves test scenarios).
   */
  seedDomain(input: {
    providerDomainId: string;
    hostname: string;
    verificationToken: string;
    verificationRecords: DomainDnsRecord[];
    scenario?: MockVerifyScenario;
  }) {
    if (this.domains.has(input.providerDomainId)) return;
    this.domains.set(input.providerDomainId, {
      hostname: input.hostname,
      verificationToken: input.verificationToken,
      verificationRecords: input.verificationRecords,
      scenario: input.scenario ?? this.defaultScenario,
      verifyAttempts: 0,
    });
  }

  async addDomain(hostname: string): Promise<DomainProviderAddResult> {
    const key = hostname.trim().toLowerCase();
    const existing = this.existingByHostname.get(key);
    if (existing) {
      if (!existing.sameAccount) {
        throw new Error(
          "Vercel Domains API error (409): Cannot add domain since it's already in use by one of your projects.",
        );
      }
      const verificationRecords: DomainDnsRecord[] = [
        {
          type: "CNAME",
          name: hostname,
          value: "cname.vercel-dns.com",
          ttl: 300,
        },
      ];
      return {
        kind: "existing_project",
        hostname,
        linkedProjectId: existing.projectId,
        linkedProjectName: existing.projectName,
        providerDomainId: hostname,
        verificationToken: `linked-${hostname}`,
        verificationMethod: "dns-txt",
        verificationRecords,
        ownershipVerified: existing.ownershipVerified ?? true,
        sslReady: existing.sslReady ?? true,
        serving: existing.serving ?? true,
      };
    }

    const verificationToken = `atlas-verify-${randomBytes(12).toString("hex")}`;
    const providerDomainId = `mock_${createHash("sha1")
      .update(hostname)
      .digest("hex")
      .slice(0, 16)}`;

    const verificationRecords: DomainDnsRecord[] = [
      {
        type: "TXT",
        name: `_atlas-verify.${hostname}`,
        value: verificationToken,
        ttl: 300,
      },
    ];

    const labels = hostname.split(".");
    if (labels.length === 2) {
      verificationRecords.push({
        type: "A",
        name: "@",
        value: "76.76.21.21",
        ttl: 300,
      });
    } else {
      verificationRecords.push({
        type: "CNAME",
        name: hostname,
        value: "cname.vercel-dns.com",
        ttl: 300,
      });
    }

    this.domains.set(providerDomainId, {
      hostname,
      verificationToken,
      verificationRecords,
      scenario: this.defaultScenario,
      verifyAttempts: 0,
    });

    return {
      kind: "created",
      providerDomainId,
      verificationToken,
      verificationMethod: "dns-txt",
      verificationRecords,
    };
  }

  async getDomain(providerDomainId: string) {
    return this.inspectDomain(providerDomainId);
  }

  async inspectDomain(providerDomainId: string) {
    const entry = this.domains.get(providerDomainId);
    if (!entry) {
      throw new Error("Domain not found in mock provider.");
    }
    const signals = this.signalsFor(entry);
    return {
      providerDomainId,
      hostname: entry.hostname,
      ownershipVerified: signals.ownershipVerified,
      sslReady: signals.sslReady,
      serving: signals.serving,
      verificationRecords: entry.verificationRecords,
      rawStatus: signals.suggestedStatus,
      misconfigured: !signals.sslReady,
    };
  }

  async getVerificationRecords(providerDomainId: string) {
    const inspected = await this.inspectDomain(providerDomainId);
    return inspected.verificationRecords;
  }

  async verifyDomain(
    providerDomainId: string,
  ): Promise<DomainProviderVerifyResult> {
    const entry = this.domains.get(providerDomainId);
    if (!entry) {
      return {
        ownershipVerified: false,
        sslReady: false,
        serving: false,
        verificationRecords: [],
        failureReason: "Domain not found.",
        suggestedStatus: "failed",
      };
    }
    entry.verifyAttempts += 1;
    const signals = this.signalsFor(entry);
    return {
      ...signals,
      verificationRecords: entry.verificationRecords,
    };
  }

  async removeDomain(providerDomainId: string) {
    this.domains.delete(providerDomainId);
  }

  async getProject(projectId: string): Promise<DomainProviderProjectMeta> {
    const meta = this.projects.get(projectId);
    if (!meta || !meta.accessible) {
      return { projectId, projectName: "", accessible: false };
    }
    return {
      projectId,
      projectName: meta.name,
      accessible: true,
    };
  }

  async confirmDomainOnProject(input: {
    projectId: string;
    hostname: string;
  }) {
    const meta = await this.getProject(input.projectId);
    if (!meta.accessible) return null;
    const existing = this.existingByHostname.get(
      input.hostname.trim().toLowerCase(),
    );
    if (!existing || existing.projectId !== input.projectId) return null;
    return {
      providerDomainId: input.hostname,
      hostname: input.hostname,
      ownershipVerified: existing.ownershipVerified ?? true,
      sslReady: existing.sslReady ?? true,
      serving: existing.serving ?? true,
      verificationRecords: [
        {
          type: "CNAME" as const,
          name: input.hostname,
          value: "cname.vercel-dns.com",
        },
      ],
    };
  }

  private signalsFor(entry: MockDomainEntry): DomainProviderVerifyResult {
    switch (entry.scenario) {
      case "fail":
        return {
          ownershipVerified: false,
          sslReady: false,
          serving: false,
          verificationRecords: entry.verificationRecords,
          failureReason:
            "TXT record not found. Confirm DNS propagation and try again.",
          suggestedStatus: "failed",
        };
      case "ssl_pending":
        return {
          ownershipVerified: true,
          sslReady: false,
          serving: false,
          verificationRecords: entry.verificationRecords,
          failureReason: null,
          suggestedStatus: "ssl_provisioning",
        };
      case "active":
        return {
          ownershipVerified: true,
          sslReady: true,
          serving: true,
          verificationRecords: entry.verificationRecords,
          failureReason: null,
          suggestedStatus: "active",
        };
      case "pending":
      default:
        return {
          ownershipVerified: false,
          sslReady: false,
          serving: false,
          verificationRecords: entry.verificationRecords,
          failureReason:
            "DNS records are not configured yet (or have not propagated). Update DNS and retry verification.",
          suggestedStatus: "failed",
        };
    }
  }
}
