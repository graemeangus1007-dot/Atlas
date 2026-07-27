import type { TemplateId } from "@/lib/templates/types";

/** Text file inside a static publish artifact (UTF-8). */
export type PublishFile = {
  /** Relative path inside the site root, e.g. `index.html`, `assets/hero.svg`. */
  path: string;
  /** UTF-8 file body (HTML, CSS, SVG, JSON). */
  content: string;
  contentType: string;
};

/**
 * How deploy obtains binary/image bytes for a referenced asset.
 * HTML always uses the relative `path` — never ephemeral signed URLs.
 */
export type PublishAssetSource =
  | {
      type: "inline";
      encoding: "utf-8";
      content: string;
    }
  | {
      type: "storage";
      storagePath: string;
      mimeType: string;
    }
  | {
      /**
       * Legacy / session URL without a storagePath.
       * `url` is omitted from atlas-manifest.json so fingerprints stay stable.
       */
      type: "external";
      assetId: string;
      mimeType: string;
      /** Ephemeral fetch hint for the current publish session only. */
      url?: string;
    };

/** Image (or placeholder) referenced by the generated site. */
export type PublishAssetRole = "hero" | "gallery" | "favicon" | "og" | "logo";

export type PublishAssetEntry = {
  path: string;
  role: PublishAssetRole;
  /** Gallery slot index (0-based) when role is gallery. */
  slot?: number;
  contentType: string;
  source: PublishAssetSource;
  alt: string;
};

/**
 * Frozen static website ready to deploy later without regenerating markup.
 * Same project inputs → same fingerprint and file contents (deterministic).
 */
export type PublishArtifact = {
  /** Artifact schema version — bump when file layout changes. */
  version: 1;
  slug: string;
  templateId: TemplateId;
  /** Deterministic hash of generated files (excludes publish timestamps). */
  fingerprint: string;
  /** Site root files including index.html, styles.css, inline SVG assets, manifest. */
  files: PublishFile[];
  /**
   * Image plan for deploy. Inline placeholders are also present in `files`;
   * storage/external entries are fetched at deploy time into `path`.
   */
  assets: PublishAssetEntry[];
};

/** Options for {@link buildStaticSite}. */
export type BuildStaticSiteOptions = {
  /** Override slug (defaults to slugify(businessName)). */
  slug?: string;
  /**
   * Public site origin for canonical / sitemap / OG url.
   * Prefer verified custom domain; otherwise last preview URL.
   */
  siteUrl?: string | null;
  /** Active custom domain hostname (without protocol). */
  activeCustomHostname?: string | null;
  /** Prior or expected deployment preview URL. */
  deploymentPreviewUrl?: string | null;
  /**
   * Absolute Atlas app origin for contact form POST
   * (`APP_URL` / public origin). Empty → form has no endpoint.
   */
  atlasOrigin?: string | null;
  /** Atlas project id for analytics beacon (required for tracking). */
  projectId?: string | null;
  /**
   * When true (default), inject "Built with Atlas" on Free plans.
   * Set false for Pro/Agency (removeBranding entitlement).
   */
  showAtlasBranding?: boolean;
};
