import { placeholderImageUrl } from "@/lib/media";
import type { MediaAsset } from "@/types/media";
import type { BusinessProject } from "@/types/business-project";
import type { GeneratedWebsiteContent } from "@/types/website-content";
import { resolveProjectSeo } from "@/lib/seo/defaults";
import type {
  PublishAssetEntry,
  PublishAssetRole,
  PublishFile,
} from "@/lib/publishing/types";

export type StaticSiteAssetPlan = {
  /** Content with imageUrl fields rewritten to relative asset paths. */
  content: GeneratedWebsiteContent;
  assets: PublishAssetEntry[];
  /** Inline placeholder SVG files to include in the artifact. */
  inlineFiles: PublishFile[];
  faviconHref: string | null;
  socialImageHref: string | null;
  logoHref: string | null;
};

function extensionForAsset(asset: MediaAsset | undefined): string {
  if (asset?.filename) {
    const fromName = asset.filename.split(".").pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  }
  switch (asset?.mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

function svgFromDataUrl(dataUrl: string): string | null {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  if (!dataUrl.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(dataUrl.slice(prefix.length));
  } catch {
    return null;
  }
}

function resolveLibraryAsset(
  library: MediaAsset[],
  id: string | null | undefined,
): MediaAsset | undefined {
  if (!id) return undefined;
  const asset = library.find((item) => item.id === id);
  if (!asset || asset.unavailable) return undefined;
  return asset;
}

function buildAssetEntry(input: {
  path: string;
  role: PublishAssetRole;
  slot?: number;
  alt: string;
  asset: MediaAsset | undefined;
  placeholderLabel: string;
  placeholderWidth: number;
  placeholderHeight: number;
  /** When true, skip placeholder SVG if no real asset (SEO images). */
  optional?: boolean;
}): {
  entry: PublishAssetEntry | null;
  inlineFile: PublishFile | null;
  href: string | null;
} {
  const { path, role, slot, alt, asset } = input;

  if (asset?.storagePath) {
    const contentType = asset.mimeType || "application/octet-stream";
    return {
      href: path,
      inlineFile: null,
      entry: {
        path,
        role,
        slot,
        contentType,
        alt,
        source: {
          type: "storage",
          storagePath: asset.storagePath,
          mimeType: contentType,
        },
      },
    };
  }

  if (asset?.url && !asset.url.startsWith("blob:")) {
    // Legacy assets without storagePath — keep assetId durable; URL is session-only.
    if (
      asset.url.startsWith("http://") ||
      asset.url.startsWith("https://")
    ) {
      const contentType = asset.mimeType || "application/octet-stream";
      return {
        href: path,
        inlineFile: null,
        entry: {
          path,
          role,
          slot,
          contentType,
          alt,
          source: {
            type: "external",
            assetId: asset.id,
            mimeType: contentType,
            url: asset.url,
          },
        },
      };
    }
  }

  if (input.optional) {
    return { href: null, inlineFile: null, entry: null };
  }

  const dataUrl = placeholderImageUrl(
    input.placeholderLabel,
    input.placeholderWidth,
    input.placeholderHeight,
  );
  const svg = svgFromDataUrl(dataUrl) ?? "";
  const svgPath = path.replace(/\.[^.]+$/, ".svg");

  return {
    href: svgPath,
    inlineFile: {
      path: svgPath,
      content: svg,
      contentType: "image/svg+xml; charset=utf-8",
    },
    entry: {
      path: svgPath,
      role,
      slot,
      contentType: "image/svg+xml",
      alt,
      source: {
        type: "inline",
        encoding: "utf-8",
        content: svg,
      },
    },
  };
}

/**
 * Map hero + gallery media to stable relative paths for the static site.
 * Placeholders become deterministic SVG files; uploads keep storagePath for deploy.
 */
export function planStaticSiteAssets(
  project: BusinessProject,
  content: GeneratedWebsiteContent,
): StaticSiteAssetPlan {
  const assets: PublishAssetEntry[] = [];
  const inlineFiles: PublishFile[] = [];

  const heroAsset = resolveLibraryAsset(
    project.mediaLibrary,
    project.heroImageId,
  );
  const heroExt = heroAsset ? extensionForAsset(heroAsset) : "svg";
  const heroPlan = buildAssetEntry({
    path: `assets/hero.${heroExt}`,
    role: "hero",
    alt: content.hero.headline,
    asset: heroAsset,
    placeholderLabel: `${content.businessName} hero`,
    placeholderWidth: 1600,
    placeholderHeight: 900,
  });
  if (heroPlan.entry) assets.push(heroPlan.entry);
  if (heroPlan.inlineFile) inlineFiles.push(heroPlan.inlineFile);

  const gallery = content.gallery.map((item, index) => {
    const asset = resolveLibraryAsset(project.mediaLibrary, item.assetId);
    const ext = asset ? extensionForAsset(asset) : "svg";
    const slot = String(index + 1).padStart(2, "0");
    const plan = buildAssetEntry({
      path: `assets/gallery-${slot}.${ext}`,
      role: "gallery",
      slot: index,
      alt: item.alt,
      asset,
      placeholderLabel: item.label,
      placeholderWidth: 800,
      placeholderHeight: 600,
    });
    if (plan.entry) assets.push(plan.entry);
    if (plan.inlineFile) inlineFiles.push(plan.inlineFile);

    return {
      ...item,
      imageUrl: plan.href || item.imageUrl,
      isPlaceholder: plan.entry?.source.type === "inline",
    };
  });

  const seo = resolveProjectSeo(project);

  const faviconAsset = resolveLibraryAsset(
    project.mediaLibrary,
    seo.faviconAssetId,
  );
  const faviconExt = faviconAsset ? extensionForAsset(faviconAsset) : "ico";
  const faviconPlan = buildAssetEntry({
    path: `assets/favicon.${faviconExt}`,
    role: "favicon",
    alt: `${content.businessName} favicon`,
    asset: faviconAsset,
    placeholderLabel: "favicon",
    placeholderWidth: 64,
    placeholderHeight: 64,
    optional: true,
  });
  if (faviconPlan.entry) assets.push(faviconPlan.entry);

  const socialAsset = resolveLibraryAsset(
    project.mediaLibrary,
    seo.socialImageAssetId,
  );
  const socialExt = socialAsset ? extensionForAsset(socialAsset) : "jpg";
  const socialPlan = buildAssetEntry({
    path: `assets/og-image.${socialExt}`,
    role: "og",
    alt: `${content.businessName} social share`,
    asset: socialAsset,
    placeholderLabel: "social",
    placeholderWidth: 1200,
    placeholderHeight: 630,
    optional: true,
  });
  if (socialPlan.entry) assets.push(socialPlan.entry);

  const logoAsset = resolveLibraryAsset(
    project.mediaLibrary,
    project.logoAssetId ?? seo.localBusiness.logoAssetId,
  );
  const logoExt = logoAsset ? extensionForAsset(logoAsset) : "png";
  const logoPlan = buildAssetEntry({
    path: `assets/logo.${logoExt}`,
    role: "logo",
    alt: `${content.businessName} logo`,
    asset: logoAsset,
    placeholderLabel: "logo",
    placeholderWidth: 512,
    placeholderHeight: 512,
    optional: true,
  });
  if (logoPlan.entry) assets.push(logoPlan.entry);

  const aboutAsset = resolveLibraryAsset(
    project.mediaLibrary,
    project.sectionImages?.about ?? null,
  );
  const aboutExt = aboutAsset ? extensionForAsset(aboutAsset) : "jpg";
  const aboutPlan = buildAssetEntry({
    path: `assets/about.${aboutExt}`,
    role: "about",
    alt: content.about.title,
    asset: aboutAsset,
    placeholderLabel: `${content.businessName} about`,
    placeholderWidth: 1200,
    placeholderHeight: 900,
    optional: true,
  });
  if (aboutPlan.entry) assets.push(aboutPlan.entry);

  return {
    content: {
      ...content,
      hero: {
        ...content.hero,
        imageUrl: heroPlan.href || content.hero.imageUrl,
        isPlaceholder: heroPlan.entry?.source.type === "inline",
      },
      about: {
        ...content.about,
        imageUrl: aboutPlan.href || content.about.imageUrl || null,
        isPlaceholder: aboutAsset
          ? false
          : Boolean(content.about.isPlaceholder),
      },
      gallery,
      logoUrl: logoPlan.href || content.logoUrl || null,
    },
    assets,
    inlineFiles,
    faviconHref: faviconPlan.href,
    socialImageHref: socialPlan.href,
    logoHref: logoPlan.href,
  };
}
