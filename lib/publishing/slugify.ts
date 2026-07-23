/**
 * Turn a business name into a URL-safe subdomain slug.
 * Example: "The Olive Branch" → "the-olive-branch"
 */
export function slugifyBusinessName(businessName: string): string {
  const slug = businessName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "my-business";
}
