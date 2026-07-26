import type { DomainType } from "@/lib/domains/types";

/**
 * ASCII/punycode normalize via the URL parser (works in Node and browsers).
 * Avoids `node:url` so this module is safe for client components.
 */
function toAsciiHostname(host: string): string | null {
  try {
    const ascii = new URL(`http://${host}`).hostname;
    return ascii || null;
  } catch {
    return null;
  }
}

/** Host suffixes that must never be claimed as custom domains. */
const BLOCKED_SUFFIXES = [
  "localhost",
  "local",
  "vercel.app",
  "vercel.sh",
  "now.sh",
  "preview.atlas.site",
  "atlas.site",
] as const;

/** Common multi-part public suffixes for apex vs subdomain classification. */
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.jp",
  "com.br",
  "com.mx",
  "co.in",
  "com.sg",
]);

export type HostnameValidationErrorCode =
  | "empty"
  | "invalid"
  | "port"
  | "ip"
  | "localhost"
  | "wildcard"
  | "preview_domain"
  | "label";

export type HostnameValidationResult =
  | {
      ok: true;
      /** Display hostname (ASCII/punycode, lowercase, no trailing dot). */
      hostname: string;
      normalizedHostname: string;
      domainType: DomainType;
    }
  | {
      ok: false;
      code: HostnameValidationErrorCode;
      error: string;
    };

const IPV4_RE =
  /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^\[?[0-9a-f:]+\]?$/i;

function isIpAddress(host: string): boolean {
  if (IPV4_RE.test(host)) {
    return host.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  // Bare IPv6 or bracketed
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare.includes(":") && IPV6_RE.test(bare)) return true;
  return false;
}

function stripUrlParts(raw: string): {
  host: string;
  hadPort: boolean;
  error?: HostnameValidationResult;
} {
  let input = raw.trim();
  if (!input) {
    return {
      host: "",
      hadPort: false,
      error: { ok: false, code: "empty", error: "Enter a domain name." },
    };
  }

  // Strip protocol.
  input = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");

  // Strip credentials.
  const at = input.lastIndexOf("@");
  if (at >= 0) input = input.slice(at + 1);

  // Strip path / query / fragment.
  input = input.split(/[/?#]/)[0] ?? "";

  let hadPort = false;
  // Bracketed IPv6 with optional port: [2001:db8::1]:443
  if (input.startsWith("[")) {
    const end = input.indexOf("]");
    if (end === -1) {
      return {
        host: "",
        hadPort: false,
        error: {
          ok: false,
          code: "invalid",
          error: "Enter a valid domain name (for example www.example.com).",
        },
      };
    }
    const inside = input.slice(1, end);
    const rest = input.slice(end + 1);
    if (rest.startsWith(":")) hadPort = true;
    return { host: inside, hadPort };
  }

  // Host:port — only treat as port when the last colon segment is numeric
  // and there is exactly one colon (not IPv6).
  const colonCount = (input.match(/:/g) ?? []).length;
  if (colonCount === 1) {
    const [hostPart, portPart] = input.split(":");
    if (portPart && /^\d+$/.test(portPart)) {
      hadPort = true;
      return { host: hostPart ?? "", hadPort };
    }
  }

  return { host: input, hadPort };
}

function isBlockedPreviewOrLocal(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  for (const suffix of BLOCKED_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return true;
  }
  return false;
}

function isValidLabel(label: string): boolean {
  if (!label || label.length > 63) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  // Allow punycode xn-- labels and ASCII alphanumerics.
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|xn--[a-z0-9-]{1,59})$/i.test(
    label,
  );
}

/**
 * Classify apex vs subdomain using a small multi-part TLD list.
 * Does not claim full Public Suffix List coverage.
 */
export function classifyDomainType(hostname: string): DomainType {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return "apex";

  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return labels.length <= 3 ? "apex" : "subdomain";
  }
  return "subdomain";
}

/**
 * Normalize and validate a user-entered hostname for custom domains.
 * Safe for client and server (no secrets).
 */
export function normalizeAndValidateHostname(
  raw: string,
): HostnameValidationResult {
  const stripped = stripUrlParts(raw);
  if (stripped.error) return stripped.error;

  if (stripped.hadPort) {
    return {
      ok: false,
      code: "port",
      error: "Remove the port number. Use only the domain (for example example.com).",
    };
  }

  let host = stripped.host.trim();
  // Trailing dots (FQDN).
  host = host.replace(/\.+$/g, "");
  if (!host) {
    return { ok: false, code: "empty", error: "Enter a domain name." };
  }

  if (host.includes("*")) {
    return {
      ok: false,
      code: "wildcard",
      error: "Wildcard domains are not supported.",
    };
  }

  if (isIpAddress(host)) {
    return {
      ok: false,
      code: "ip",
      error: "IP addresses are not supported. Enter a domain name.",
    };
  }

  // Internationalized domains → ASCII punycode (via URL hostname).
  const ascii = toAsciiHostname(host);
  if (!ascii) {
    return {
      ok: false,
      code: "invalid",
      error: "Enter a valid domain name (for example www.example.com).",
    };
  }

  const normalized = ascii.toLowerCase();

  if (isBlockedPreviewOrLocal(normalized)) {
    const code = normalized.includes("localhost") || normalized.endsWith(".local")
      ? "localhost"
      : "preview_domain";
    return {
      ok: false,
      code,
      error:
        code === "localhost"
          ? "Localhost domains cannot be connected."
          : "Atlas and Vercel preview domains cannot be connected as custom domains.",
    };
  }

  const labels = normalized.split(".");
  if (labels.length < 2) {
    return {
      ok: false,
      code: "invalid",
      error: "Enter a full domain including the extension (for example example.com).",
    };
  }

  for (const label of labels) {
    if (!isValidLabel(label)) {
      return {
        ok: false,
        code: "label",
        error: "Domain contains an invalid label. Check for typos or unsupported characters.",
      };
    }
  }

  if (normalized.length > 253) {
    return {
      ok: false,
      code: "invalid",
      error: "Domain name is too long.",
    };
  }

  return {
    ok: true,
    hostname: normalized,
    normalizedHostname: normalized,
    domainType: classifyDomainType(normalized),
  };
}
