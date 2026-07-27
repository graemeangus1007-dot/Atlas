import { loadServerEnv } from "@/lib/env/server";
import { getDomainProviderId } from "@/lib/domains/create-provider";
import { getEmailProviderId, getEmailFromAddress } from "@/lib/email/create-provider";
import { getServerDeploymentProviderId } from "@/lib/deployment/server-config";
import { createAnonClient } from "@/lib/supabase/anon";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/types";
import type {
  HealthCheckResult,
  HealthStatus,
  SystemHealthReport,
} from "@/lib/health/types";

function nowIso(): string {
  return new Date().toISOString();
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("unavailable")) return "unavailable";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}

async function checkSupabaseDatabase(): Promise<HealthCheckResult> {
  const checkedAt = nowIso();
  if (!isSupabaseConfigured()) {
    return {
      id: "supabase_database",
      label: "Supabase database",
      status: "unavailable",
      checkedAt,
      message: "Supabase public env is not configured.",
    };
  }

  try {
    const client = createAnonClient();
    const { error } = await client.from("projects").select("id").limit(1);
    if (error) {
      // RLS may block anon select — that still proves the DB is reachable.
      if (/permission|rls|policy|jwt/i.test(error.message)) {
        return {
          id: "supabase_database",
          label: "Supabase database",
          status: "healthy",
          checkedAt,
          message: "Database reachable (anon select restricted by RLS as expected).",
        };
      }
      return {
        id: "supabase_database",
        label: "Supabase database",
        status: "degraded",
        checkedAt,
        message: `Database responded with an error (${error.code || "unknown"}).`,
      };
    }
    return {
      id: "supabase_database",
      label: "Supabase database",
      status: "healthy",
      checkedAt,
      message: "Database query succeeded.",
    };
  } catch {
    return {
      id: "supabase_database",
      label: "Supabase database",
      status: "unavailable",
      checkedAt,
      message: "Could not reach Supabase database.",
    };
  }
}

async function checkSupabaseStorage(): Promise<HealthCheckResult> {
  const checkedAt = nowIso();
  if (!isSupabaseConfigured()) {
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      status: "unavailable",
      checkedAt,
      message: "Supabase public env is not configured.",
    };
  }

  try {
    const client = tryCreateServiceClient() ?? createAnonClient();
    const { error } = await client.storage.listBuckets();
    if (error) {
      return {
        id: "supabase_storage",
        label: "Supabase Storage",
        status: "degraded",
        checkedAt,
        message: "Storage API reachable but listBuckets failed (check policies).",
      };
    }
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      status: "healthy",
      checkedAt,
      message: "Storage API reachable.",
    };
  } catch {
    return {
      id: "supabase_storage",
      label: "Supabase Storage",
      status: "unavailable",
      checkedAt,
      message: "Could not reach Supabase Storage.",
    };
  }
}

async function checkAuthentication(): Promise<HealthCheckResult> {
  const checkedAt = nowIso();
  if (!isSupabaseConfigured()) {
    return {
      id: "authentication",
      label: "Authentication",
      status: "unavailable",
      checkedAt,
      message: "Supabase auth is not configured.",
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        id: "authentication",
        label: "Authentication",
        status: "degraded",
        checkedAt,
        message: "Auth service returned an error reading the session.",
      };
    }
    return {
      id: "authentication",
      label: "Authentication",
      status: "healthy",
      checkedAt,
      message: "Supabase Auth session endpoint reachable.",
    };
  } catch {
    return {
      id: "authentication",
      label: "Authentication",
      status: "unavailable",
      checkedAt,
      message: "Could not reach Supabase Auth.",
    };
  }
}

async function checkVercelDeploymentApi(): Promise<HealthCheckResult> {
  const checkedAt = nowIso();
  const provider = getServerDeploymentProviderId();
  const env = loadServerEnv();

  if (provider === "mock") {
    return {
      id: "vercel_deployment_api",
      label: "Vercel deployment API",
      status: "degraded",
      checkedAt,
      message: "DEPLOYMENT_PROVIDER=mock — live deploys are simulated locally.",
    };
  }

  if (provider !== "vercel") {
    return {
      id: "vercel_deployment_api",
      label: "Vercel deployment API",
      status: "degraded",
      checkedAt,
      message: `Active deployment provider is ${provider}, not vercel.`,
    };
  }

  if (!env.ok || !env.env.vercelToken || !env.env.vercelProjectId) {
    return {
      id: "vercel_deployment_api",
      label: "Vercel deployment API",
      status: "unavailable",
      checkedAt,
      message: "VERCEL_TOKEN or VERCEL_PROJECT_ID is missing.",
    };
  }

  try {
    const url = new URL(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(env.env.vercelProjectId)}`,
    );
    if (env.env.vercelTeamId) {
      url.searchParams.set("teamId", env.env.vercelTeamId);
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.env.vercelToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        id: "vercel_deployment_api",
        label: "Vercel deployment API",
        status: "unavailable",
        checkedAt,
        message: "Vercel API rejected credentials (check token scopes).",
      };
    }
    if (!res.ok) {
      return {
        id: "vercel_deployment_api",
        label: "Vercel deployment API",
        status: "degraded",
        checkedAt,
        message: `Vercel API returned HTTP ${res.status}.`,
      };
    }
    return {
      id: "vercel_deployment_api",
      label: "Vercel deployment API",
      status: "healthy",
      checkedAt,
      message: "Vercel project API reachable.",
    };
  } catch {
    return {
      id: "vercel_deployment_api",
      label: "Vercel deployment API",
      status: "unavailable",
      checkedAt,
      message: "Could not reach the Vercel API (timeout or network error).",
    };
  }
}

function checkCustomDomainProvider(): HealthCheckResult {
  const checkedAt = nowIso();
  const id = getDomainProviderId();
  if (id === "mock") {
    return {
      id: "custom_domain_provider",
      label: "Custom-domain provider",
      status: "degraded",
      checkedAt,
      message: "DOMAIN_PROVIDER=mock — DNS instructions are simulated.",
    };
  }
  const env = loadServerEnv();
  if (!env.ok || !env.env.vercelToken || !env.env.vercelProjectId) {
    return {
      id: "custom_domain_provider",
      label: "Custom-domain provider",
      status: "unavailable",
      checkedAt,
      message: "Vercel domain provider selected but credentials are incomplete.",
    };
  }
  return {
    id: "custom_domain_provider",
    label: "Custom-domain provider",
    status: "healthy",
    checkedAt,
    message: "DOMAIN_PROVIDER=vercel with credentials present.",
  };
}

function checkEmailProvider(): HealthCheckResult {
  const checkedAt = nowIso();
  const id = getEmailProviderId();
  const from = getEmailFromAddress();
  if (id === "mock") {
    return {
      id: "email_provider",
      label: "Email provider",
      status: "degraded",
      checkedAt,
      message: "EMAIL_PROVIDER=mock — notifications are not delivered externally.",
    };
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      id: "email_provider",
      label: "Email provider",
      status: "unavailable",
      checkedAt,
      message: "EMAIL_PROVIDER=resend but RESEND_API_KEY is missing.",
    };
  }
  if (!from || from.includes("@localhost")) {
    return {
      id: "email_provider",
      label: "Email provider",
      status: "degraded",
      checkedAt,
      message: "EMAIL_FROM_ADDRESS looks unset or unsafe for production.",
    };
  }
  return {
    id: "email_provider",
    label: "Email provider",
    status: "healthy",
    checkedAt,
    message: "Resend provider configured with a from-address.",
  };
}

function checkAnalyticsCollection(): HealthCheckResult {
  const checkedAt = nowIso();
  const env = loadServerEnv();
  if (!env.ok) {
    return {
      id: "analytics_collection",
      label: "Analytics collection",
      status: "unavailable",
      checkedAt,
      message: "Server environment invalid — collect endpoint may fail.",
    };
  }
  if (!env.env.analyticsVisitorSalt || env.env.analyticsVisitorSalt.startsWith("dev-")) {
    return {
      id: "analytics_collection",
      label: "Analytics collection",
      status: "degraded",
      checkedAt,
      message: "Analytics visitor salt missing or using a development default.",
    };
  }
  if (!env.env.appUrl || env.env.appUrl.includes("localhost")) {
    return {
      id: "analytics_collection",
      label: "Analytics collection",
      status: "degraded",
      checkedAt,
      message: "APP_URL is missing or localhost — published beacons will not collect.",
    };
  }
  return {
    id: "analytics_collection",
    label: "Analytics collection",
    status: "healthy",
    checkedAt,
    message: "Collect endpoint configuration looks ready (CORS allowlist + salts).",
  };
}

function checkLeadSubmissionApi(): HealthCheckResult {
  const checkedAt = nowIso();
  const env = loadServerEnv();
  if (!env.ok) {
    return {
      id: "lead_submission_api",
      label: "Lead submission API",
      status: "unavailable",
      checkedAt,
      message: "Server environment invalid — form submit may fail.",
    };
  }
  if (!env.env.leadIpHashSalt || env.env.leadIpHashSalt.startsWith("dev-")) {
    return {
      id: "lead_submission_api",
      label: "Lead submission API",
      status: "degraded",
      checkedAt,
      message: "LEAD_IP_HASH_SALT missing or using a development default.",
    };
  }
  if (!tryCreateServiceClient()) {
    return {
      id: "lead_submission_api",
      label: "Lead submission API",
      status: "degraded",
      checkedAt,
      message:
        "Service role unavailable — submissions may work, but email delivery is degraded.",
    };
  }
  if (!env.env.appUrl || env.env.appUrl.includes("localhost")) {
    return {
      id: "lead_submission_api",
      label: "Lead submission API",
      status: "degraded",
      checkedAt,
      message: "APP_URL is missing or localhost — published forms cannot submit.",
    };
  }
  return {
    id: "lead_submission_api",
    label: "Lead submission API",
    status: "healthy",
    checkedAt,
    message: "Form submit path configured (salt + service role + public origin).",
  };
}

/** Run all system health checks (authenticated dashboard use). */
export async function runSystemHealthChecks(): Promise<SystemHealthReport> {
  const checkedAt = nowIso();
  const [
    supabaseDatabase,
    supabaseStorage,
    authentication,
    vercelDeploymentApi,
  ] = await Promise.all([
    checkSupabaseDatabase(),
    checkSupabaseStorage(),
    checkAuthentication(),
    checkVercelDeploymentApi(),
  ]);

  const checks: HealthCheckResult[] = [
    supabaseDatabase,
    supabaseStorage,
    authentication,
    vercelDeploymentApi,
    checkCustomDomainProvider(),
    checkEmailProvider(),
    checkAnalyticsCollection(),
    checkLeadSubmissionApi(),
  ];

  return {
    overall: worstStatus(checks.map((c) => c.status)),
    checkedAt,
    checks,
  };
}
