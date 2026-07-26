import type { BusinessProject } from "@/types/business-project";
import type { LocalBusinessInfo, ProjectSeo } from "@/lib/seo/types";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function defaultOpeningHours(): LocalBusinessInfo["openingHours"] {
  return WEEKDAYS.map((day) => ({
    day,
    opens: "09:00",
    closes: "17:00",
    closed: day === "Sunday",
  }));
}

export function defaultLocalBusiness(
  project: Pick<BusinessProject, "businessName" | "contact">,
): LocalBusinessInfo {
  return {
    name: project.businessName || "",
    phone: project.contact.phone || "",
    email: project.contact.email || "",
    streetAddress: "",
    addressLocality: project.contact.location || "",
    addressRegion: "",
    postalCode: "",
    addressCountry: "",
    openingHours: defaultOpeningHours(),
    logoAssetId: null,
  };
}

export function defaultProjectSeo(
  project: Pick<BusinessProject, "businessName" | "description" | "contact">,
): ProjectSeo {
  const title = project.businessName?.trim() || "Website";
  const description = project.description?.trim() || "";
  return {
    siteTitle: title,
    metaDescription: description.slice(0, 160),
    canonicalUrl: "",
    socialTitle: title,
    socialDescription: description.slice(0, 200),
    socialImageAssetId: null,
    robotsIndex: true,
    faviconAssetId: null,
    localBusiness: defaultLocalBusiness(project),
  };
}

/** Merge saved SEO with defaults so older projects always have a full shape. */
export function resolveProjectSeo(project: BusinessProject): ProjectSeo {
  const defaults = defaultProjectSeo(project);
  const raw = project.seo;
  if (!raw || typeof raw !== "object") return defaults;

  const lb = raw.localBusiness;
  return {
    siteTitle: typeof raw.siteTitle === "string" ? raw.siteTitle : defaults.siteTitle,
    metaDescription:
      typeof raw.metaDescription === "string"
        ? raw.metaDescription
        : defaults.metaDescription,
    canonicalUrl:
      typeof raw.canonicalUrl === "string"
        ? raw.canonicalUrl
        : defaults.canonicalUrl,
    socialTitle:
      typeof raw.socialTitle === "string" ? raw.socialTitle : defaults.socialTitle,
    socialDescription:
      typeof raw.socialDescription === "string"
        ? raw.socialDescription
        : defaults.socialDescription,
    socialImageAssetId:
      typeof raw.socialImageAssetId === "string" || raw.socialImageAssetId === null
        ? raw.socialImageAssetId
        : defaults.socialImageAssetId,
    robotsIndex:
      typeof raw.robotsIndex === "boolean" ? raw.robotsIndex : defaults.robotsIndex,
    faviconAssetId:
      typeof raw.faviconAssetId === "string" || raw.faviconAssetId === null
        ? raw.faviconAssetId
        : defaults.faviconAssetId,
    localBusiness: {
      ...defaults.localBusiness,
      ...(lb && typeof lb === "object" ? lb : {}),
      openingHours: Array.isArray(lb?.openingHours)
        ? lb.openingHours
        : defaults.localBusiness.openingHours,
    },
  };
}
