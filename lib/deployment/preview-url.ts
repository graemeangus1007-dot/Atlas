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

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Safe Visit Preview check.
 * Invented `preview.atlas.site` hosts are ONLY allowed when the *active*
 * deployment provider (from /api/deployment/provider) is mock-local.
 * Persisted `deployment.provider === "mock-local"` must not keep fake URLs
 * alive after Atlas switches to Vercel.
 */
export function isUsableVisitPreviewUrl(
  url: string | null | undefined,
  activeProviderId?: string | null,
): boolean {
  if (!url?.trim()) return false;
  if (isMockPreviewUrl(url)) {
    return activeProviderId === "mock-local";
  }
  if (activeProviderId === "vercel") {
    return isVercelPreviewUrl(url);
  }
  if (activeProviderId === "supabase-preview") {
    return isSupabaseStoragePreviewUrl(url);
  }
  // Unknown / not yet loaded: only real hosted previews.
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
  /**
   * Active provider from /api/deployment/provider (vercel | supabase-preview | mock-local).
   * Do NOT pass the stale persisted deployment.provider alone when env is Vercel.
   */
  providerId?: string | null;
  /** Active custom production hostname (excluded from preview candidates). */
  productionHostname?: string | null;
};

/**
 * Resolve the URL for Visit Preview.
 * Real hosted URLs always beat legacy mock hosts. Never invents hosts.
 * Never returns production custom domains as preview.
 */
export function resolveVisitPreviewUrl(
  input: ResolveVisitPreviewInput,
): string | null {
  const productionHost =
    input.productionHostname?.trim().toLowerCase().replace(/\.+$/, "") || null;
  const allowMock = input.providerId === "mock-local";

  const candidates = [
    input.deploymentPreviewUrl,
    input.latestVersionPreviewUrl,
    input.publishUrl,
  ]
    .map((raw) => (typeof raw === "string" ? raw.trim() : ""))
    .filter(Boolean);

  const filtered = candidates.filter((url) => {
    const host = hostnameOf(url);
    if (productionHost && host === productionHost) return false;
    if (isMockPreviewUrl(url) && !allowMock) return false;
    return true;
  });

  // Prefer real provider hosts over anything else (heals stale mock records).
  const real = filtered.find((url) => isRealHostedPreviewUrl(url));
  if (real) return real;

  for (const url of filtered) {
    if (isUsableVisitPreviewUrl(url, input.providerId)) {
      return url;
    }
  }

  return null;
}

/**
 * Strip invented preview.atlas.site hosts from a persisted publish record.
 * Optionally heal previewUrl from the latest publish-version URL.
 */
export function sanitizePublishRecord<T extends {
  url: string;
  deployment?: {
    previewUrl: string;
    provider: string;
  } & Record<string, unknown>;
}>(
  publish: T | null | undefined,
  options?: {
    activeProviderId?: string | null;
    latestVersionPreviewUrl?: string | null;
  },
): T | null {
  if (!publish) return null;

  const activeProviderId = options?.activeProviderId ?? null;
  const allowMock = activeProviderId === "mock-local";

  let previewUrl = publish.deployment?.previewUrl ?? "";
  let topUrl = publish.url ?? "";

  if (isMockPreviewUrl(previewUrl) && !allowMock) {
    previewUrl = "";
  }
  if (isMockPreviewUrl(topUrl) && !allowMock) {
    topUrl = "";
  }

  const healed = resolveVisitPreviewUrl({
    deploymentPreviewUrl: previewUrl || null,
    latestVersionPreviewUrl: options?.latestVersionPreviewUrl ?? null,
    publishUrl: topUrl || null,
    providerId: activeProviderId,
  });

  if (healed) {
    previewUrl = healed;
    if (!topUrl || isMockPreviewUrl(topUrl)) {
      topUrl = healed;
    }
  }

  if (!publish.deployment) {
    return {
      ...publish,
      url: topUrl,
    };
  }

  return {
    ...publish,
    url: topUrl || publish.url,
    deployment: {
      ...publish.deployment,
      previewUrl,
      // If we healed to a Vercel URL, correct the provider stamp.
      provider:
        isVercelPreviewUrl(previewUrl) &&
        publish.deployment.provider === "mock-local"
          ? "vercel"
          : publish.deployment.provider,
    },
  };
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
