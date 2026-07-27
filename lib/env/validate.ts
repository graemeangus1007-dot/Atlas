import { isLocalhostOrigin, isValidAppOrigin } from "@/lib/app-url";
import type {
  DeploymentProviderId,
  DomainProviderId,
  EmailProviderId,
  EnvIssue,
  EnvValidationResult,
  PublicEnv,
  ServerEnv,
} from "@/lib/env/types";

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    !value ||
    lower.includes("your-project") ||
    lower.includes("your-publishable") ||
    lower.includes("your-anon") ||
    lower.includes("your-atlas") ||
    lower === "changeme" ||
    lower.endsWith("...") ||
    lower === "https://your-project.supabase.co"
  );
}

function parseDeploymentProvider(raw: string): DeploymentProviderId | null {
  const v = raw.toLowerCase();
  if (v === "vercel") return "vercel";
  if (v === "supabase" || v === "supabase-preview") return "supabase";
  if (v === "mock" || v === "") return "mock";
  return null;
}

function parseDomainProvider(raw: string): DomainProviderId | null {
  const v = raw.toLowerCase();
  if (v === "vercel") return "vercel";
  if (v === "mock" || v === "") return "mock";
  return null;
}

function parseEmailProvider(raw: string): EmailProviderId | null {
  const v = raw.toLowerCase();
  if (v === "resend") return "resend";
  if (v === "mock" || v === "") return "mock";
  return null;
}

function nodeEnvOf(
  env: NodeJS.ProcessEnv,
): ServerEnv["nodeEnv"] {
  const raw = env.NODE_ENV;
  if (raw === "production" || raw === "test") return raw;
  return "development";
}

/**
 * Validate Atlas environment from a ProcessEnv-like object.
 * Never returns secret values in issue messages.
 */
export function validateEnv(
  source: NodeJS.ProcessEnv = process.env,
  options: { requireProductionSecrets?: boolean } = {},
): EnvValidationResult {
  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];
  const nodeEnv = nodeEnvOf(source);
  const isVercelRuntime = source.VERCEL === "1";
  const strict =
    options.requireProductionSecrets ??
    (nodeEnv === "production" || isVercelRuntime);

  const supabaseUrl = trim(source.NEXT_PUBLIC_SUPABASE_URL);
  const supabasePublishableKey =
    trim(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    trim(source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const publicAppUrl = trim(source.NEXT_PUBLIC_APP_URL) || null;

  if (!supabaseUrl || isPlaceholder(supabaseUrl)) {
    errors.push({
      severity: "error",
      key: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Missing or placeholder Supabase project URL.",
    });
  } else if (!/^https:\/\//i.test(supabaseUrl)) {
    errors.push({
      severity: "error",
      key: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Supabase URL must be an https origin.",
    });
  }

  if (!supabasePublishableKey || isPlaceholder(supabasePublishableKey)) {
    errors.push({
      severity: "error",
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      message: "Missing or placeholder Supabase publishable key.",
    });
  }

  const appUrlRaw = trim(source.APP_URL) || trim(source.NEXT_PUBLIC_APP_URL);
  let appUrl = "";
  if (!appUrlRaw) {
    if (strict) {
      errors.push({
        severity: "error",
        key: "APP_URL",
        message:
          "APP_URL is required in production so published sites can reach Atlas APIs.",
      });
    } else {
      warnings.push({
        severity: "warning",
        key: "APP_URL",
        message:
          "APP_URL is unset. Localhost may be used for in-app APIs only; do not publish sites without a public origin.",
      });
    }
  } else if (!isValidAppOrigin(appUrlRaw)) {
    errors.push({
      severity: "error",
      key: "APP_URL",
      message: "APP_URL must be an absolute http(s) origin with no path.",
    });
  } else if (isLocalhostOrigin(appUrlRaw) && strict) {
    errors.push({
      severity: "error",
      key: "APP_URL",
      message:
        "APP_URL must not be localhost in production or on Vercel — published sites cannot reach it.",
    });
  } else {
    appUrl = appUrlRaw.replace(/\/+$/, "");
    if (isLocalhostOrigin(appUrl)) {
      warnings.push({
        severity: "warning",
        key: "APP_URL",
        message:
          "APP_URL points at localhost. Publishing will refuse to embed this origin.",
      });
    }
  }

  const deploymentRaw = trim(source.DEPLOYMENT_PROVIDER);
  const deploymentProvider = parseDeploymentProvider(deploymentRaw || "mock");
  if (deploymentProvider === null) {
    errors.push({
      severity: "error",
      key: "DEPLOYMENT_PROVIDER",
      message: "DEPLOYMENT_PROVIDER must be mock, supabase, or vercel.",
    });
  } else if (!deploymentRaw && strict) {
    warnings.push({
      severity: "warning",
      key: "DEPLOYMENT_PROVIDER",
      message: "DEPLOYMENT_PROVIDER unset; defaulting to mock.",
    });
  }

  const vercelToken = trim(source.VERCEL_TOKEN) || null;
  const vercelProjectId = trim(source.VERCEL_PROJECT_ID) || null;
  const vercelTeamId = trim(source.VERCEL_TEAM_ID) || null;

  if (deploymentProvider === "vercel") {
    if (!vercelToken) {
      errors.push({
        severity: "error",
        key: "VERCEL_TOKEN",
        message: "VERCEL_TOKEN is required when DEPLOYMENT_PROVIDER=vercel.",
      });
    }
    if (!vercelProjectId) {
      errors.push({
        severity: "error",
        key: "VERCEL_PROJECT_ID",
        message:
          "VERCEL_PROJECT_ID is required when DEPLOYMENT_PROVIDER=vercel.",
      });
    }
  } else if (strict && (!vercelToken || !vercelProjectId)) {
    warnings.push({
      severity: "warning",
      key: "VERCEL_TOKEN",
      message:
        "Vercel credentials are unset. Custom-domain verify and Vercel deploys will be unavailable until configured.",
    });
  }

  const domainRaw = trim(source.DOMAIN_PROVIDER);
  const domainProvider = parseDomainProvider(domainRaw || "mock");
  if (domainProvider === null) {
    errors.push({
      severity: "error",
      key: "DOMAIN_PROVIDER",
      message: "DOMAIN_PROVIDER must be mock or vercel.",
    });
  }

  if (domainProvider === "vercel" && (!vercelToken || !vercelProjectId)) {
    errors.push({
      severity: "error",
      key: "DOMAIN_PROVIDER",
      message:
        "DOMAIN_PROVIDER=vercel requires VERCEL_TOKEN and VERCEL_PROJECT_ID.",
    });
  }

  const emailRaw = trim(source.EMAIL_PROVIDER);
  const emailProvider = parseEmailProvider(emailRaw || "mock");
  if (emailProvider === null) {
    errors.push({
      severity: "error",
      key: "EMAIL_PROVIDER",
      message: "EMAIL_PROVIDER must be mock or resend.",
    });
  }

  const emailFromAddress = trim(source.EMAIL_FROM_ADDRESS);
  const resendApiKey = trim(source.RESEND_API_KEY) || null;

  if (!emailFromAddress) {
    if (emailProvider === "resend" || strict) {
      errors.push({
        severity: "error",
        key: "EMAIL_FROM_ADDRESS",
        message: "EMAIL_FROM_ADDRESS is required for outbound notifications.",
      });
    } else {
      warnings.push({
        severity: "warning",
        key: "EMAIL_FROM_ADDRESS",
        message: "EMAIL_FROM_ADDRESS unset; mock email will use a localhost from-address.",
      });
    }
  }

  if (emailProvider === "resend" && !resendApiKey) {
    errors.push({
      severity: "error",
      key: "RESEND_API_KEY",
      message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
    });
  }

  const serviceRoleKey = trim(source.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey || isPlaceholder(serviceRoleKey)) {
    if (strict) {
      errors.push({
        severity: "error",
        key: "SUPABASE_SERVICE_ROLE_KEY",
        message:
          "SUPABASE_SERVICE_ROLE_KEY is required for lead notifications and analytics write fallback.",
      });
    } else {
      warnings.push({
        severity: "warning",
        key: "SUPABASE_SERVICE_ROLE_KEY",
        message:
          "Service role key unset — lead email delivery and some analytics paths will be degraded.",
      });
    }
  }

  const leadIpHashSalt = trim(source.LEAD_IP_HASH_SALT);
  if (!leadIpHashSalt) {
    if (strict) {
      errors.push({
        severity: "error",
        key: "LEAD_IP_HASH_SALT",
        message: "LEAD_IP_HASH_SALT is required so IP hashes are not guessable.",
      });
    } else {
      warnings.push({
        severity: "warning",
        key: "LEAD_IP_HASH_SALT",
        message:
          "LEAD_IP_HASH_SALT unset — a development default may be used (not for production).",
      });
    }
  }

  const analyticsVisitorSalt =
    trim(source.ANALYTICS_VISITOR_SALT) || leadIpHashSalt;
  if (!trim(source.ANALYTICS_VISITOR_SALT)) {
    if (strict) {
      errors.push({
        severity: "error",
        key: "ANALYTICS_VISITOR_SALT",
        message: "ANALYTICS_VISITOR_SALT is required in production.",
      });
    } else {
      warnings.push({
        severity: "warning",
        key: "ANALYTICS_VISITOR_SALT",
        message:
          "ANALYTICS_VISITOR_SALT unset — falling back to LEAD_IP_HASH_SALT when present.",
      });
    }
  }

  const stripeSecretKey = trim(source.STRIPE_SECRET_KEY) || null;
  const stripeWebhookSecret = trim(source.STRIPE_WEBHOOK_SECRET) || null;
  const stripePublishableKey =
    trim(source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) || null;

  // Static process.env.* reads when validating the live env — Next.js/Vercel
  // may not expose values via dynamic source[key] lookups.
  const stripePriceStarter =
    (source === process.env
      ? trim(process.env.STRIPE_PRICE_STARTER)
      : trim(source.STRIPE_PRICE_STARTER)) || null;
  const stripePriceProfessional =
    (source === process.env
      ? trim(process.env.STRIPE_PRICE_PROFESSIONAL) ||
        trim(process.env.STRIPE_PRICE_PRO)
      : trim(source.STRIPE_PRICE_PROFESSIONAL) ||
        trim(source.STRIPE_PRICE_PRO)) || null;
  const stripePriceAgency =
    (source === process.env
      ? trim(process.env.STRIPE_PRICE_AGENCY)
      : trim(source.STRIPE_PRICE_AGENCY)) || null;

  if (strict) {
    if (!stripeSecretKey) {
      errors.push({
        severity: "error",
        key: "STRIPE_SECRET_KEY",
        message: "STRIPE_SECRET_KEY is required for billing in production.",
      });
    }
    if (!stripeWebhookSecret) {
      errors.push({
        severity: "error",
        key: "STRIPE_WEBHOOK_SECRET",
        message: "STRIPE_WEBHOOK_SECRET is required to verify Stripe webhooks.",
      });
    }
    if (!stripePublishableKey) {
      errors.push({
        severity: "error",
        key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        message: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required for Checkout.",
      });
    }
    if (!stripePriceStarter) {
      errors.push({
        severity: "error",
        key: "STRIPE_PRICE_STARTER",
        message: "STRIPE_PRICE_STARTER (Stripe Price id) is required.",
      });
    }
    if (!stripePriceProfessional) {
      errors.push({
        severity: "error",
        key: "STRIPE_PRICE_PROFESSIONAL",
        message: "STRIPE_PRICE_PROFESSIONAL (Stripe Price id) is required.",
      });
    }
    if (!stripePriceAgency) {
      errors.push({
        severity: "error",
        key: "STRIPE_PRICE_AGENCY",
        message: "STRIPE_PRICE_AGENCY (Stripe Price id) is required.",
      });
    }
  } else if (
    !stripeSecretKey ||
    !stripePriceStarter ||
    !stripePriceProfessional ||
    !stripePriceAgency
  ) {
    warnings.push({
      severity: "warning",
      key: "STRIPE_SECRET_KEY",
      message:
        "Stripe billing is not fully configured — checkout/portal will be unavailable until keys and price IDs are set.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const publicEnv: PublicEnv = {
    supabaseUrl,
    supabasePublishableKey,
    appUrl: publicAppUrl && isValidAppOrigin(publicAppUrl)
      ? publicAppUrl.replace(/\/+$/, "")
      : null,
    stripePublishableKey,
  };

  const env: ServerEnv = {
    public: publicEnv,
    supabaseServiceRoleKey: serviceRoleKey,
    appUrl: appUrl || publicEnv.appUrl || "http://localhost:3000",
    deploymentProvider: deploymentProvider ?? "mock",
    vercelToken,
    vercelProjectId,
    vercelTeamId,
    domainProvider: domainProvider ?? "mock",
    emailProvider: emailProvider ?? "mock",
    emailFromAddress:
      emailFromAddress || "Atlas <notifications@localhost>",
    resendApiKey,
    leadIpHashSalt: leadIpHashSalt || "dev-lead-ip-hash-salt",
    analyticsVisitorSalt: analyticsVisitorSalt || "dev-analytics-visitor-salt",
    stripeSecretKey,
    stripeWebhookSecret,
    stripePriceStarter,
    stripePriceProfessional,
    stripePriceAgency,
    nodeEnv,
    isVercelRuntime,
  };

  return { ok: true, env, warnings };
}

/** Format issues for console — never includes secret values. */
export function formatEnvIssues(issues: EnvIssue[]): string {
  return issues
    .map((issue) => `[${issue.severity}] ${issue.key}: ${issue.message}`)
    .join("\n");
}
