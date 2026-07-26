/**
 * Server-only deployment configuration.
 * Never import this module from client components — it reads private env vars.
 */

export type ServerDeploymentProviderId = "mock" | "supabase" | "vercel";

export type VercelDeploymentConfig = {
  token: string;
  projectId: string;
  teamId?: string;
};

function readProviderId(): ServerDeploymentProviderId {
  // Direct static access (server bundle — not Next public inlining).
  const raw = process.env.DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  if (raw === "vercel") return "vercel";
  if (raw === "supabase" || raw === "supabase-preview") return "supabase";
  // Legacy fallback for older local setups.
  const legacy = process.env.NEXT_PUBLIC_DEPLOYMENT_PROVIDER?.trim().toLowerCase();
  if (legacy === "vercel") return "vercel";
  if (legacy === "supabase" || legacy === "supabase-preview") return "supabase";
  return "mock";
}

/** Active hosting backend (server-controlled). */
export function getServerDeploymentProviderId(
  override?: string | null,
): ServerDeploymentProviderId {
  if (override != null && override !== "") {
    const raw = override.trim().toLowerCase();
    if (raw === "vercel") return "vercel";
    if (raw === "supabase" || raw === "supabase-preview") return "supabase";
    return "mock";
  }
  return readProviderId();
}

export function getDeploymentProviderLabel(
  id: ServerDeploymentProviderId,
): string {
  switch (id) {
    case "vercel":
      return "Vercel preview hosting";
    case "supabase":
      return "Supabase preview hosting (legacy)";
    case "mock":
    default:
      return "mock provider (local)";
  }
}

/** Stable provider id stored on deployment records. */
export function getDeploymentProviderRecordId(
  id: ServerDeploymentProviderId,
): string {
  switch (id) {
    case "vercel":
      return "vercel";
    case "supabase":
      return "supabase-preview";
    case "mock":
    default:
      return "mock-local";
  }
}

/**
 * Read Vercel credentials from server env.
 * Throws a safe error (never includes the token value).
 */
export function getVercelDeploymentConfig(): VercelDeploymentConfig {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;

  if (!token) {
    throw new Error(
      "Missing VERCEL_TOKEN. Add a Vercel access token to the server environment.",
    );
  }
  if (!projectId) {
    throw new Error(
      "Missing VERCEL_PROJECT_ID. Add your Vercel project id to the server environment.",
    );
  }

  return { token, projectId, teamId };
}

/** True when a value looks like it might contain a secret (for log redaction). */
export function redactSecrets(message: string, token?: string): string {
  let out = message;
  if (token && token.length > 0) {
    out = out.split(token).join("[redacted]");
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]");
  return out;
}
