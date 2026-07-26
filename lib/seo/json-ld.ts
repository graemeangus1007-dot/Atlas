import { resolveProjectSeo } from "@/lib/seo/defaults";
import type { BusinessProject } from "@/types/business-project";

function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Build LocalBusiness JSON-LD. Values are plain strings — stringify escapes safely.
 * Never interpolate unsanitized HTML into the script tag (caller uses JSON.stringify).
 */
export function buildLocalBusinessJsonLd(
  project: BusinessProject,
  options: {
    siteUrl?: string | null;
    logoUrl?: string | null;
  } = {},
): Record<string, unknown> {
  const seo = resolveProjectSeo(project);
  const lb = seo.localBusiness;
  const name = lb.name.trim() || project.businessName.trim() || "Local Business";

  const address = compact({
    "@type": "PostalAddress",
    streetAddress: lb.streetAddress.trim(),
    addressLocality: lb.addressLocality.trim() || project.contact.location.trim(),
    addressRegion: lb.addressRegion.trim(),
    postalCode: lb.postalCode.trim(),
    addressCountry: lb.addressCountry.trim(),
  });

  const hours = (lb.openingHours ?? [])
    .filter((row) => !row.closed && row.opens && row.closes && row.day)
    .map((row) =>
      compact({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${row.day}`,
        opens: row.opens,
        closes: row.closes,
      }),
    );

  return compact({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    description: seo.metaDescription.trim() || project.description.trim(),
    telephone: lb.phone.trim() || project.contact.phone.trim(),
    email: lb.email.trim() || project.contact.email.trim(),
    url: options.siteUrl || undefined,
    image: options.logoUrl || undefined,
    logo: options.logoUrl || undefined,
    address: Object.keys(address).length > 1 ? address : undefined,
    openingHoursSpecification: hours.length > 0 ? hours : undefined,
  });
}

/** Safe script tag for LocalBusiness JSON-LD (escaped via JSON.stringify). */
export function renderLocalBusinessJsonLdScript(
  project: BusinessProject,
  options: {
    siteUrl?: string | null;
    logoUrl?: string | null;
  } = {},
): string {
  const data = buildLocalBusinessJsonLd(project, options);
  // Prevent </script> breakout in string values.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
