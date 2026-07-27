/**
 * Preview URL helpers — keep mock / Supabase / Vercel hosting URLs distinct.
 *
 * `*.preview.atlas.site` is a local mock invention only. Production Visit Preview
 * must never open it — Atlas does not own that DNS/TLS/routing surface.
 */

const MOCK_PREVIEW_HOST = "preview.atlas.site";
const SUPABASE_PREVIEWS_MARKER = "/storage/v1/object/public/site-previews/";

/** Mock-local fake host used only by {@link MockDeploymentProvider}. */
export function isMockPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === MOCK_PREVIEW_HOST || host.endsWith(`.${MOCK_PREVIEW_HOST}`);
  } catch {
    return url.includes(MOCK_PREVIEW_HOST);
  }
}

/** Real Supabase Storage public object URL for site-previews. */
export function isSupabaseStoragePreviewUrl(
  url: string | null | undefined,
): boolean {
  if (!url) return false;
  return url.includes(SUPABASE_PREVIEWS_MARKER);
}

/** Real Vercel deployment URL (*.vercel.app). */
export function isVercelPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === "vercel.app" || host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/** Any real hosting preview URL (Vercel or Supabase Storage) — never invented. */
export function isRealHostedPreviewUrl(
  url: string | null | undefined,
): boolean {
  return isVercelPreviewUrl(url) || isSupabaseStoragePreviewUrl(url);
}

/**
 * Whether a URL is safe to open as "Visit Preview" for the active provider.
 * Invented `preview.atlas.site` hosts are only allowed for mock-local.
 */
export function isUsableVisitPreviewUrl(
  url: string | null | undefined,
  providerId?: string | null,
): boolean {
  if (!url?.trim()) return false;
  if (isMockPreviewUrl(url)) {
    return providerId === "mock-local";
  }
  if (providerId === "vercel") {
    return isVercelPreviewUrl(url);
  }
  if (providerId === "supabase-preview") {
    return isSupabaseStoragePreviewUrl(url);
  }
  // Unknown provider: only real hosted previews (heal legacy mock records).
  return isRealHostedPreviewUrl(url);
}

export type ResolveVisitPreviewInput = {
  deploymentPreviewUrl?: string | null;
  /** Latest publish_versions.preview_url (preferred over legacy fake URLs). */
  latestVersionPreviewUrl?: string | null;
  /**
   * Top-level publish.url — used only when it is a real provider preview.
   * Custom production domains must be passed separately and are never returned.
   */
  publishUrl?: string | null;
  /** Active provider record id: vercel | supabase-preview | mock-local */
  providerId?: string | null;
  /** Active custom production hostname (excluded from preview candidates). */
  productionHostname?: string | null;
};

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolve the URL for Visit Preview.
 * Never invents hosts. Never returns production custom domains as preview.
 * Rejects legacy `*.preview.atlas.site` unless the active provider is mock-local.
 */
export function resolveVisitPreviewUrl(
  input: ResolveVisitPreviewInput,
): string | null {
  const productionHost =
    input.productionHostname?.trim().toLowerCase().replace(/\.+$/, "") || null;

  const candidates = [
    input.deploymentPreviewUrl,
    input.latestVersionPreviewUrl,
    input.publishUrl,
  ];

  for (const raw of candidates) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url) continue;

    const host = hostnameOf(url);
    if (productionHost && host === productionHost) {
      // Keep production custom-domain URLs separate from preview.
      continue;
    }

    if (isUsableVisitPreviewUrl(url, input.providerId)) {
      return url;
    }

    // Heal: a real hosted URL from history beats a stale mock deployment URL
    // even when providerId is missing/ambiguous.
    if (isRealHostedPreviewUrl(url) && !isMockPreviewUrl(url)) {
      return url;
    }
  }

  return null;
}

/**
 * Whether a previous deployment may be reused for the active provider.
 * Never reuse mock or Supabase URLs for a Vercel deployment (and vice versa).
 */
export function canReusePreviousPreviewUrl(
  providerId: string,
  previousPreviewUrl: string | null | undefined,
  previousProviderId?: string | null,
): boolean {
  if (!previousPreviewUrl) return false;

  if (
    previousProviderId &&
    previousProviderId !== providerId
  ) {
    return false;
  }

  if (providerId === "vercel") {
    return isVercelPreviewUrl(previousPreviewUrl);
  }

  if (providerId === "supabase-preview") {
    return isSupabaseStoragePreviewUrl(previousPreviewUrl);
  }

  if (providerId === "mock-local") {
    // Prefer mock URLs; allow legacy records without a provider field.
    if (previousProviderId && previousProviderId !== "mock-local") {
      return false;
    }
    return (
      isMockPreviewUrl(previousPreviewUrl) ||
      (!previousProviderId && !isVercelPreviewUrl(previousPreviewUrl) &&
        !isSupabaseStoragePreviewUrl(previousPreviewUrl))
    );
  }

  return false;
}
