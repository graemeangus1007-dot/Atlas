/**
 * Typed environment configuration for Atlas (Sprint 19.0A).
 * Public values may ship to the browser; server-only values must never.
 */

export type DeploymentProviderId = "mock" | "supabase" | "vercel";
export type DomainProviderId = "mock" | "vercel";
export type EmailProviderId = "mock" | "resend";

/** Safe for client bundles (NEXT_PUBLIC_* only). */
export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** Optional client fallback for Atlas origin (never prefer over APP_URL). */
  appUrl: string | null;
  stripePublishableKey: string | null;
};

/** Server-only configuration — never import from client components. */
export type ServerEnv = {
  public: PublicEnv;
  supabaseServiceRoleKey: string;
  appUrl: string;
  deploymentProvider: DeploymentProviderId;
  vercelToken: string | null;
  vercelProjectId: string | null;
  vercelTeamId: string | null;
  domainProvider: DomainProviderId;
  emailProvider: EmailProviderId;
  emailFromAddress: string;
  resendApiKey: string | null;
  leadIpHashSalt: string;
  analyticsVisitorSalt: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  stripePriceStarter: string | null;
  stripePriceProfessional: string | null;
  stripePriceAgency: string | null;
  nodeEnv: "development" | "production" | "test";
  isVercelRuntime: boolean;
};

export type EnvIssueSeverity = "error" | "warning";

export type EnvIssue = {
  severity: EnvIssueSeverity;
  key: string;
  message: string;
};

export type EnvValidationResult =
  | { ok: true; env: ServerEnv; warnings: EnvIssue[] }
  | { ok: false; errors: EnvIssue[]; warnings: EnvIssue[] };

export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

export const SERVER_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "DEPLOYMENT_PROVIDER",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
  "DOMAIN_PROVIDER",
  "EMAIL_PROVIDER",
  "EMAIL_FROM_ADDRESS",
  "RESEND_API_KEY",
  "LEAD_IP_HASH_SALT",
  "ANALYTICS_VISITOR_SALT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_PRICE_AGENCY",
] as const;

/** Keys that must never appear in client bundles or logs. */
export const SECRET_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_TOKEN",
  "RESEND_API_KEY",
  "LEAD_IP_HASH_SALT",
  "ANALYTICS_VISITOR_SALT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;
