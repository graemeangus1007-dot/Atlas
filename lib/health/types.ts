export type HealthStatus = "healthy" | "degraded" | "unavailable";

export type HealthCheckId =
  | "supabase_database"
  | "supabase_storage"
  | "authentication"
  | "vercel_deployment_api"
  | "custom_domain_provider"
  | "email_provider"
  | "analytics_collection"
  | "lead_submission_api";

export type HealthCheckResult = {
  id: HealthCheckId;
  label: string;
  status: HealthStatus;
  checkedAt: string;
  /** Safe, redacted diagnostic — never includes secrets or lead bodies. */
  message: string;
};

export type SystemHealthReport = {
  overall: HealthStatus;
  checkedAt: string;
  checks: HealthCheckResult[];
};
