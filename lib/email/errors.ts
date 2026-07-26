/**
 * Normalize + redact email provider errors before persistence or UI.
 * Never store API keys, Authorization headers, or raw response bodies with secrets.
 */

const SECRET_PATTERNS = [
  /re_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /api[_-]?key["'\s:=]+[A-Za-z0-9._\-]+/gi,
  /authorization["'\s:=]+[A-Za-z0-9._\-]+/gi,
];

export function redactProviderError(raw: unknown, maxLength = 280): string {
  let text =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : "Email provider error.";

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[redacted]");
  }

  // Collapse noisy JSON/HTML blobs.
  text = text.replace(/\s+/g, " ").trim();
  if (!text) text = "Email provider error.";
  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - 1)}…`;
  }
  return text;
}

export function normalizeEmailProviderError(
  error: unknown,
  providerId: string,
): { error: string; code?: string } {
  if (error && typeof error === "object") {
    const obj = error as {
      message?: unknown;
      name?: unknown;
      statusCode?: unknown;
      status?: unknown;
    };
    const code =
      typeof obj.statusCode === "number"
        ? String(obj.statusCode)
        : typeof obj.status === "number"
          ? String(obj.status)
          : typeof obj.name === "string"
            ? obj.name
            : undefined;
    return {
      error: redactProviderError(
        obj.message ?? `${providerId} request failed`,
      ),
      code,
    };
  }
  return { error: redactProviderError(error) };
}
