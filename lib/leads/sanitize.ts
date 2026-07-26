/**
 * Sanitize user-facing strings for storage and safe HTML/text rendering.
 * Strips tags, null bytes, and control characters (keeps newlines optionally).
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

export function sanitizePlainText(
  value: unknown,
  options: {
    maxLength: number;
    allowNewlines?: boolean;
    /**
     * When true (default), strip leading/trailing whitespace.
     * Set false for live controlled inputs so Space while typing is preserved.
     */
    trimEnds?: boolean;
  } = { maxLength: 500 },
): string {
  if (typeof value !== "string") return "";
  let out = value.normalize("NFKC");
  out = stripHtmlTags(out);
  out = out.replace(CONTROL_CHARS, "");
  if (!options.allowNewlines) {
    out = out.replace(/[\r\n\t]+/g, " ");
  } else {
    out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    out = out.replace(/\n{3,}/g, "\n\n");
  }
  if (options.trimEnds !== false) {
    out = out.trim();
  }
  if (out.length > options.maxLength) {
    out = out.slice(0, options.maxLength);
  }
  return out;
}

/** Normalize email: trim + lowercase. Does not validate format. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isValidEmail(value: string): boolean {
  if (!value || value.length > 320) return false;
  return EMAIL_RE.test(value);
}

/** Escape text for HTML attribute / text nodes in published sites. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
