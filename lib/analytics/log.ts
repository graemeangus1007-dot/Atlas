/**
 * Redacted analytics pipeline logs (no IPs, raw visitor ids, or secrets).
 */
export function logAnalytics(
  stage: string,
  details: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value == null) {
      safe[key] = value;
      continue;
    }
    if (
      key.toLowerCase().includes("ip") ||
      key === "visitorId" ||
      key === "rawVisitorId"
    ) {
      safe[key] = "[redacted]";
      continue;
    }
    if (key === "visitorIdHash" && typeof value === "string") {
      safe[key] = `${value.slice(0, 8)}…`;
      continue;
    }
    if (key === "sessionId" && typeof value === "string") {
      safe[key] = `${value.slice(0, 6)}…`;
      continue;
    }
    if (key === "projectId" && typeof value === "string") {
      safe[key] =
        value.length > 8 ? `…${value.slice(-8)}` : value;
      continue;
    }
    safe[key] = value;
  }
  console.info(`[analytics.${stage}]`, safe);
}
