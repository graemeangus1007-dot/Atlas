/**
 * Secret / PII redaction for logs and monitoring events.
 * Never forward lead message bodies or raw credentials.
 */

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /(?:vercel|resend|supabase)[_-]?(?:token|key|secret)=([^\s&]+)/gi,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bvcp_[A-Za-z0-9]+/g,
  /\bre_[A-Za-z0-9]+/g,
  /\bsb_secret_[A-Za-z0-9]+/g,
];

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "api_key",
  "apikey",
  "secret",
  "service_role",
  "serviceRoleKey",
  "vercel_token",
  "resend_api_key",
  "message",
  "body",
  "lead_message",
  "leadMessage",
  "email_body",
  "html",
  "text",
]);

export function redactSecrets(input: string, extraSecrets: string[] = []): string {
  let out = input;
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 8) {
      out = out.split(secret).join("[redacted]");
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(lower)) return true;
  return (
    lower.includes("password") ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.endsWith("key") ||
    lower.includes("authorization")
  );
}

/**
 * Deep-clone-ish redaction for monitoring context objects.
 * Lead message content and credential-looking keys become "[redacted]".
 */
export function redactSecretsDeep<T>(value: T, depth = 0): T {
  if (depth > 6) return "[redacted:depth]" as T;
  if (value == null) return value;
  if (typeof value === "string") {
    return redactSecrets(value) as T;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretsDeep(item, depth + 1)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = redactSecretsDeep(child, depth + 1);
      }
    }
    return out as T;
  }
  return value;
}
