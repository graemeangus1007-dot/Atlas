/**
 * Temporary redacted pipeline logging for lead submit / inbox (Sprint 17.0B bugfix).
 * Never logs IP hashes, emails, message bodies, or secrets.
 */

function shortId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…`;
}

export function logLeadPipeline(
  step: string,
  details: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("email") ||
      lower.includes("message") ||
      lower.includes("phone") ||
      lower.includes("ip") ||
      lower.includes("token") ||
      lower.includes("key") ||
      lower.includes("authorization")
    ) {
      safe[key] = value == null ? null : "[redacted]";
      continue;
    }
    if (
      lower.endsWith("id") ||
      lower.includes("formid") ||
      lower.includes("projectid") ||
      lower.includes("ownerid") ||
      lower.includes("submissionid")
    ) {
      safe[key] = typeof value === "string" ? shortId(value) : value;
      continue;
    }
    safe[key] = value;
  }
  console.info(`[leads.pipeline] ${step}`, safe);
}
