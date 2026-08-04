/**
 * Human-readable media titles — never expose storage names, UUIDs, or numeric IDs.
 */

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_NUMERIC = /^\d{6,}$/;
const CAMERA_NOISE = /^(img|dsc|dcim|pic|photo|image|screenshot|screen\s*shot)[\s_-]*\d+$/i;
const STORAGE_PREFIX = /^[0-9a-f]{8,}[\s_-]+/i;

/** True when a label is opaque / machine-generated and must not appear publicly. */
export function isOpaqueMediaLabel(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return true;
  if (UUID_LIKE.test(text)) return true;
  if (LONG_NUMERIC.test(text.replace(/\s+/g, ""))) return true;
  if (/^[0-9a-f]{16,}$/i.test(text.replace(/[\s_-]/g, ""))) return true;
  if (CAMERA_NOISE.test(text)) return true;
  if (/[/\\]/.test(text)) return true; // storage paths
  if (/^media-/i.test(text) && /\d/.test(text)) return true;
  // Mostly digits with sparse separators (e.g. "133989754380766849")
  const alnum = text.replace(/[^a-z0-9]/gi, "");
  if (alnum.length >= 8) {
    const digits = (alnum.match(/\d/g) ?? []).length;
    if (digits / alnum.length >= 0.85) return true;
  }
  return false;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/i, "");
}

function cleanStem(raw: string): string {
  return raw
    .replace(STORAGE_PREFIX, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,4}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Deterministic admin/editor fallback: Photo 1, Photo 2, … (0-based index). */
export function photoIndexTitle(index: number): string {
  return `Photo ${Math.max(1, Math.floor(index) + 1)}`;
}

/**
 * Derive a safe initial display title from an original upload filename.
 * Opaque / camera / numeric names become Photo N when index is provided.
 */
export function deriveDisplayTitle(
  originalFilename: string,
  index = 0,
): string {
  const stem = cleanStem(stripExtension(originalFilename || ""));
  if (!stem || isOpaqueMediaLabel(stem)) {
    return photoIndexTitle(index);
  }
  // Camera prefix with leftover words: "IMG Vacation" → "Vacation"
  const withoutCamera = stem.replace(
    /^(img|dsc|dcim|pic|photo|image)[\s_-]+/i,
    "",
  );
  const candidate = cleanStem(withoutCamera || stem);
  if (!candidate || isOpaqueMediaLabel(candidate)) {
    return photoIndexTitle(index);
  }
  return titleCaseWords(candidate);
}

/** Public gallery: only show intentional human titles. */
export function publicGalleryTitle(
  title: string | null | undefined,
): string {
  const text = (title ?? "").trim();
  if (!text || isOpaqueMediaLabel(text)) return "";
  // "Photo 1" style is admin-only — hide on public surfaces.
  if (/^photo\s+\d+$/i.test(text)) return "";
  return text;
}

/** Accessibility alt — never empty; never opaque IDs. */
export function deriveAltText(
  title: string | null | undefined,
  originalFilename: string,
  index = 0,
): string {
  const publicTitle = publicGalleryTitle(title);
  if (publicTitle) return publicTitle;
  const derived = deriveDisplayTitle(originalFilename, index);
  return derived || photoIndexTitle(index);
}

/**
 * Idempotent migration: replace opaque titles/alts on library assets.
 * Preserves meaningful user-authored titles and captions (description).
 */
export function normalizeOpaqueMediaMetadata<
  T extends {
    id: string;
    name: string;
    filename?: string;
    title: string;
    description: string;
    alt: string;
  },
>(
  library: T[],
  galleryImageIds: Array<string | null | undefined> = [],
): T[] {
  const galleryOrder = new Map<string, number>();
  galleryImageIds.forEach((id, index) => {
    if (id && !galleryOrder.has(id)) galleryOrder.set(id, index);
  });

  let unnamedCounter = 0;
  return library.map((asset) => {
    const original = asset.name || asset.filename || "image";
    const order =
      galleryOrder.get(asset.id) ??
      (isOpaqueMediaLabel(asset.title) ? unnamedCounter++ : 0);

    const nextTitle = isOpaqueMediaLabel(asset.title)
      ? deriveDisplayTitle(original, order)
      : asset.title.trim();

    const nextAlt = isOpaqueMediaLabel(asset.alt)
      ? deriveAltText(nextTitle, original, order)
      : asset.alt.trim() || deriveAltText(nextTitle, original, order);

    if (nextTitle === asset.title && nextAlt === asset.alt) {
      return asset;
    }
    return { ...asset, title: nextTitle, alt: nextAlt };
  });
}
