import { resolveProjectSeo } from "@/lib/seo/defaults";
import {
  sanitizeProjectSeo,
  type SanitizeProjectSeoOptions,
} from "@/lib/seo/validate";
import type { ProjectSeo } from "@/lib/seo/types";
import type { BusinessProject } from "@/types/business-project";

/**
 * Apply an SEO patch onto the resolved project SEO.
 * Default trimEnds: false so controlled inputs keep Space while typing.
 */
export function patchSeo(
  project: BusinessProject,
  patch: Partial<ProjectSeo>,
  options: SanitizeProjectSeoOptions = { trimEnds: false },
): ProjectSeo {
  const current = resolveProjectSeo(project);
  return sanitizeProjectSeo(
    {
      ...current,
      ...patch,
      localBusiness: {
        ...current.localBusiness,
        ...(patch.localBusiness ?? {}),
      },
    },
    { trimEnds: options.trimEnds ?? false },
  );
}
