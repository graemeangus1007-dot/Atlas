/**
 * Preview URL helpers — keep mock / Supabase / Vercel hosting URLs distinct.
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
