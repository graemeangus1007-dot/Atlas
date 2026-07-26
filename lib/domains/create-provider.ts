import { MockDomainProvider } from "@/lib/domains/mock-provider";
import type { DomainProvider } from "@/lib/domains/provider";
import { VercelDomainProvider } from "@/lib/domains/vercel-provider";

export type DomainProviderId = "mock" | "vercel";

/**
 * Resolve the domain provider for server routes.
 * Defaults to mock so local/dev never requires live Vercel domain APIs.
 * Set DOMAIN_PROVIDER=vercel to use the Vercel Domains API (server-only).
 */
export function getDomainProviderId(override?: string | null): DomainProviderId {
  const raw = (override ?? process.env.DOMAIN_PROVIDER)?.trim().toLowerCase();
  if (raw === "vercel") return "vercel";
  return "mock";
}

/**
 * Construct the active domain provider (server-only for vercel).
 */
export function createDomainProvider(
  override?: string | null,
): DomainProvider {
  switch (getDomainProviderId(override)) {
    case "vercel":
      return new VercelDomainProvider();
    case "mock":
    default:
      return new MockDomainProvider();
  }
}

export type DomainProviderResolution =
  | { ok: true; providerId: DomainProviderId; provider: DomainProvider }
  | {
      ok: false;
      code: "mock_domain_with_vercel_env";
      message: string;
    };

/**
 * Resolve which provider should verify/remove a persisted domain row.
 *
 * - Rows registered with Vercel always use Vercel (provider_domain_id is the hostname).
 * - Mock rows while DOMAIN_PROVIDER=vercel are a configuration mismatch — the domain
 *   was never added to the Vercel project, so Verify Now cannot succeed silently.
 */
export function resolveProviderForDomainRow(domain: {
  provider: string;
}): DomainProviderResolution {
  const stored = domain.provider?.trim().toLowerCase();
  const envId = getDomainProviderId();

  if (stored === "vercel") {
    return {
      ok: true,
      providerId: "vercel",
      provider: createDomainProvider("vercel"),
    };
  }

  if (stored === "mock" && envId === "vercel") {
    return {
      ok: false,
      code: "mock_domain_with_vercel_env",
      message:
        "This domain was saved with the mock provider, so it was never registered on Vercel. Remove it and add the domain again.",
    };
  }

  return {
    ok: true,
    providerId: "mock",
    provider: createDomainProvider("mock"),
  };
}
