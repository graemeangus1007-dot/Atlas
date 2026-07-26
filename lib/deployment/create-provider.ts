import { MockDeploymentProvider } from "@/lib/deployment/mock-provider";
import type { DeploymentProvider } from "@/lib/deployment/provider";

/**
 * Client-safe provider ids. Real selection is server-controlled via
 * `DEPLOYMENT_PROVIDER` — see `/api/deployment/provider`.
 */
export type DeploymentProviderId = "mock" | "supabase" | "vercel";

/**
 * Parse a provider id string (tests / overrides only).
 * The browser never reads private deployment env vars.
 */
export function getDeploymentProviderId(
  override?: string | null,
): DeploymentProviderId {
  if (override != null && override !== "") {
    const raw = override.trim().toLowerCase();
    if (raw === "vercel") return "vercel";
    if (raw === "supabase" || raw === "supabase-preview") return "supabase";
    if (raw === "mock" || raw === "mock-local") return "mock";
    return "mock";
  }
  // Client default: local mock. Active host comes from the server API.
  return "mock";
}

/**
 * Construct a browser-safe deployment provider.
 * Only the mock provider may be created in the client bundle.
 * Real Vercel / Supabase deploys go through `/api/deployment/deploy`.
 */
export function createDeploymentProvider(
  _override?: string | null,
): DeploymentProvider {
  return new MockDeploymentProvider();
}

/**
 * Local mock provider for tests and client-side mock publishes.
 */
export function resolveDeploymentProvider(): DeploymentProvider {
  return new MockDeploymentProvider();
}
