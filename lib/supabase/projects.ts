import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/supabase/errors";
import { normalizeMediaLibrary, resolveMediaUrl } from "@/lib/media";
import { resolveThumbnailSource } from "@/lib/project-thumbnail";
import { hydrateMediaLibrary } from "@/lib/supabase/storage";
import type {
  ProjectBrandingJson,
  ProjectContentJson,
  ProjectInsert,
  ProjectListItem,
  ProjectResult,
  ProjectRow,
  ProjectUpdate,
} from "@/lib/supabase/types";
import type { BusinessProject, ProjectStatus } from "@/types/business-project";
import type { WebsiteGoal } from "@/types/business";
import type { MediaAsset } from "@/types/media";
import type { PublishRecord } from "@/types/publishing";
import { sanitizePublishRecord } from "@/lib/deployment/preview-url";
import type { TemplateId } from "@/lib/templates/types";
import type {
  BodyFontId,
  ButtonStyleId,
  HeadingFontId,
  SiteThemeId,
  SiteWidthId,
} from "@/data/design-options";

function getProjectErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("you must be signed in") ||
    lower.includes("not authenticated") ||
    lower.includes("jwt") ||
    lower.includes("session")
  ) {
    return "Please sign in to save your project, then try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("permission denied") ||
    lower.includes("42501")
  ) {
    return "You don't have permission to save this project. Try signing in again.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    return "Could not reach the server. Check your connection and try again.";
  }
  if (
    lower.includes("placeholder") ||
    lower.includes("missing next_public_supabase") ||
    lower.includes("supabase env")
  ) {
    return "Project saving isn't configured yet. Add your Supabase keys to .env.local.";
  }

  if (
    lower.includes("plan_limit_projects") ||
    message.includes("PLAN_LIMIT_PROJECTS")
  ) {
    return "You've reached your website limit on the current plan. Upgrade to create more sites.";
  }

  return message || "Something went wrong with your project. Please try again.";
}

function fail<T>(error: unknown): ProjectResult<T> {
  return {
    ok: false,
    error: getProjectErrorMessage(error),
  };
}

function ok<T>(data: T): ProjectResult<T> {
  return { ok: true, data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Persist storagePath as durable identity; drop ephemeral signed-url expiry. */
function mediaForPersistence(library: MediaAsset[]): MediaAsset[] {
  return library.map((asset) => {
    const { urlExpiresAt: _expires, ...rest } = asset;
    return rest;
  });
}

/**
 * Re-issue signed display URLs for private project-media objects on a row.
 */
export async function hydrateProjectRow(row: ProjectRow): Promise<ProjectRow> {
  const media = await hydrateMediaLibrary(normalizeMediaLibrary(row.media));
  const contentRaw = isRecord(row.content) ? { ...row.content } : {};

  const heroImageId =
    typeof contentRaw.heroImageId === "string" ? contentRaw.heroImageId : null;
  const hero = heroImageId
    ? media.find((asset) => asset.id === heroImageId)
    : undefined;

  if (hero?.url && !hero.unavailable) {
    contentRaw.heroImageUrl = hero.url;
  } else if (heroImageId) {
    contentRaw.heroImageUrl = null;
  }

  return {
    ...row,
    media,
    content: contentRaw,
  };
}

/** Map a projects row to the dashboard / projects list card shape. */
export function toProjectListItem(row: ProjectRow): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    businessType: row.business_type ?? "",
    description: row.description ?? "",
    status: row.status,
    publishedUrl: row.published_url,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    thumbnail: resolveThumbnailSource(row),
  };
}

/** Metadata-only fields — never touch content, branding, media, template, or publish. */
export type ProjectMetadataInput = {
  id: string;
  name: string;
  businessName: string;
  businessType: string;
  description?: string | null;
};

/**
 * Split a BusinessProject into structured DB columns.
 * Kept here so React components never talk to Supabase directly.
 */
export function businessProjectToColumns(
  project: BusinessProject,
  name?: string,
): Omit<ProjectInsert, "owner_id" | "id" | "created_at" | "updated_at"> {
  // Denormalize the current hero display URL for list thumbnails.
  // Durable identity remains media[].storagePath; URLs are re-signed on load.
  const heroImageUrl = resolveMediaUrl(
    project.mediaLibrary,
    project.heroImageId,
  );

  const content: ProjectContentJson = {
    heroEyebrow: project.heroEyebrow ?? null,
    heroHeadline: project.heroHeadline,
    heroSubheadline: project.heroSubheadline,
    primaryCta: project.primaryCta,
    secondaryCta: project.secondaryCta ?? null,
    aboutTitle: project.aboutTitle ?? null,
    services: project.services,
    contact: project.contact,
    seo: project.seo ?? null,
    pages: project.pages,
    heroImageId: project.heroImageId,
    heroImageUrl,
    galleryImageIds: project.galleryImageIds,
    sectionImages: project.sectionImages ?? null,
    sectionOrder: project.sectionOrder ?? null,
    logoAssetId: project.logoAssetId ?? null,
    publish: project.publish,
    designSections: project.designSections ?? null,
    designAssistant: project.designAssistant ?? null,
  };

  const branding: ProjectBrandingJson = {
    primaryColor: project.primaryColor,
    secondaryColor: project.secondaryColor,
    accentColor: project.accentColor,
    backgroundColor: project.backgroundColor,
    headingFont: project.headingFont,
    bodyFont: project.bodyFont,
    buttonStyle: project.buttonStyle,
    heroOverlay: project.heroOverlay,
    siteWidth: project.siteWidth,
    theme: project.theme,
    logo: project.logo,
  };

  return {
    name: (name ?? project.businessName).trim() || "Untitled project",
    business_name: project.businessName.trim() || "Untitled project",
    business_type: project.businessType || null,
    description: project.description || null,
    goals: project.goals,
    content,
    branding,
    template: project.templateId || null,
    media: mediaForPersistence(project.mediaLibrary),
    status: project.status,
    published_url: project.publish?.url ?? null,
  };
}

/**
 * Rebuild a BusinessProject from a structured projects row.
 */
export function rowToBusinessProject(row: ProjectRow): BusinessProject {
  const base = MOCK_BUSINESS_PROJECT;
  const content = isRecord(row.content) ? row.content : {};
  const branding = isRecord(row.branding) ? row.branding : {};
  const goals = Array.isArray(row.goals) ? (row.goals as WebsiteGoal[]) : [];
  const media = normalizeMediaLibrary(row.media);

  const publishRaw = content.publish;
  const publishParsed: PublishRecord | null =
    isRecord(publishRaw) &&
    typeof publishRaw.url === "string" &&
    typeof publishRaw.slug === "string" &&
    typeof publishRaw.publishedAt === "string"
      ? (publishRaw as PublishRecord)
      : null;
  // Discard invented preview.atlas.site hosts on load (heal later from versions).
  const publish = sanitizePublishRecord(publishParsed, {
    activeProviderId: null,
  });

  return {
    ...base,
    businessName: row.business_name || base.businessName,
    businessType: (row.business_type as BusinessProject["businessType"]) || "",
    description: row.description ?? "",
    goals,
    heroEyebrow: asString(content.heroEyebrow, ""),
    heroHeadline: asString(content.heroHeadline, base.heroHeadline),
    heroSubheadline: asString(content.heroSubheadline, base.heroSubheadline),
    primaryCta: asString(content.primaryCta, base.primaryCta),
    secondaryCta: asString(content.secondaryCta, ""),
    aboutTitle: asString(content.aboutTitle, ""),
    services: Array.isArray(content.services)
      ? (content.services as BusinessProject["services"])
      : base.services,
    contact: isRecord(content.contact)
      ? {
          title: asString(content.contact.title, base.contact.title),
          description: asString(
            content.contact.description,
            base.contact.description,
          ),
          phone: asString(content.contact.phone, base.contact.phone),
          email: asString(content.contact.email, base.contact.email),
          location: asString(content.contact.location, base.contact.location),
          formId:
            typeof content.contact.formId === "string" ||
            content.contact.formId === null
              ? (content.contact.formId as string | null)
              : (base.contact.formId ?? null),
          buttonText: asString(
            content.contact.buttonText ?? content.contact.formButtonText,
            base.contact.buttonText ||
              base.contact.formButtonText ||
              "Send message",
          ),
          successMessage: asString(
            content.contact.successMessage ??
              content.contact.formSuccessMessage,
            base.contact.successMessage ||
              base.contact.formSuccessMessage ||
              "Thanks — we received your message and will get back to you soon.",
          ),
          showPhoneField:
            typeof content.contact.showPhoneField === "boolean"
              ? content.contact.showPhoneField
              : base.contact.showPhoneField !== false,
          showCompanyField:
            typeof content.contact.showCompanyField === "boolean"
              ? content.contact.showCompanyField
              : Boolean(base.contact.showCompanyField),
          formEnabled:
            typeof content.contact.formEnabled === "boolean"
              ? content.contact.formEnabled
              : base.contact.formEnabled !== false,
        }
      : base.contact,
    seo: isRecord(content.seo)
      ? (content.seo as BusinessProject["seo"])
      : base.seo,
    templateId: (row.template as TemplateId) || base.templateId,
    pages: Array.isArray(content.pages)
      ? (content.pages as BusinessProject["pages"])
      : base.pages,
    primaryColor: asString(branding.primaryColor, base.primaryColor),
    secondaryColor: asString(branding.secondaryColor, base.secondaryColor),
    accentColor: asString(branding.accentColor, base.accentColor),
    backgroundColor: asString(branding.backgroundColor, base.backgroundColor),
    headingFont: (branding.headingFont as HeadingFontId) || base.headingFont,
    bodyFont: (branding.bodyFont as BodyFontId) || base.bodyFont,
    buttonStyle: (branding.buttonStyle as ButtonStyleId) || base.buttonStyle,
    heroOverlay: asNumber(branding.heroOverlay, base.heroOverlay),
    siteWidth: (branding.siteWidth as SiteWidthId) || base.siteWidth,
    theme: (branding.theme as SiteThemeId) || base.theme,
    logo:
      typeof branding.logo === "string" || branding.logo === null
        ? (branding.logo as string | null)
        : base.logo,
    mediaLibrary: media,
    heroImageId:
      typeof content.heroImageId === "string" || content.heroImageId === null
        ? (content.heroImageId as string | null)
        : base.heroImageId,
    galleryImageIds: Array.isArray(content.galleryImageIds)
      ? (content.galleryImageIds as BusinessProject["galleryImageIds"])
      : base.galleryImageIds,
    sectionImages: isRecord(content.sectionImages)
      ? (content.sectionImages as BusinessProject["sectionImages"])
      : undefined,
    sectionOrder: Array.isArray(content.sectionOrder)
      ? (content.sectionOrder as string[])
      : undefined,
    logoAssetId:
      typeof content.logoAssetId === "string" || content.logoAssetId === null
        ? (content.logoAssetId as string | null)
        : undefined,
    status: row.status,
    publish,
    designSections: isRecord(content.designSections)
      ? (content.designSections as BusinessProject["designSections"])
      : undefined,
    designAssistant: isRecord(content.designAssistant)
      ? (content.designAssistant as BusinessProject["designAssistant"])
      : undefined,
  };
}

export type CreateProjectInput = {
  name: string;
  businessName?: string;
  businessType?: string | null;
  description?: string | null;
  goals?: WebsiteGoal[];
  content?: ProjectContentJson;
  branding?: ProjectBrandingJson;
  template?: string | null;
  media?: MediaAsset[];
  status?: ProjectStatus;
  publishedUrl?: string | null;
  /** Convenience: map a full BusinessProject into structured columns. */
  project?: BusinessProject;
};

export type UpdateProjectInput = {
  id: string;
  name?: string;
  businessName?: string;
  businessType?: string | null;
  description?: string | null;
  goals?: WebsiteGoal[];
  content?: ProjectContentJson;
  branding?: ProjectBrandingJson;
  template?: string | null;
  media?: MediaAsset[];
  status?: ProjectStatus;
  publishedUrl?: string | null;
  /** Convenience: map a full BusinessProject into structured columns. */
  project?: BusinessProject;
};

/**
 * Project persistence API — single source for all public.projects access.
 * Uses the browser publishable/anon client only (never the service-role key).
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<ProjectResult<ProjectRow>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return fail(userError);
    if (!user) {
      return {
        ok: false,
        error: "Please sign in to save your project, then try again.",
      };
    }

    // Soft pre-check from plan catalog (DB trigger remains authoritative).
    const { count: projectCount } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();
    const { resolveFeatures } = await import("@/lib/billing/entitlements");
    const features = resolveFeatures(
      subRow as import("@/lib/billing/types").SubscriptionRow | null,
    );
    const maxProjects = features.maxProjects;
    if (
      maxProjects != null &&
      typeof projectCount === "number" &&
      projectCount >= maxProjects
    ) {
      return {
        ok: false,
        error:
          "You've reached your website limit on the current plan. Upgrade to create more sites.",
      };
    }

    const fromProject = input.project
      ? businessProjectToColumns(input.project, input.name)
      : null;

    const insert: ProjectInsert = {
      owner_id: user.id,
      name: (input.name || fromProject?.name || "Untitled project").trim(),
      business_name: (
        input.businessName ||
        fromProject?.business_name ||
        input.name ||
        "Untitled project"
      ).trim(),
      business_type:
        input.businessType !== undefined
          ? input.businessType
          : (fromProject?.business_type ?? null),
      description:
        input.description !== undefined
          ? input.description
          : (fromProject?.description ?? null),
      goals: input.goals ?? fromProject?.goals ?? [],
      content: input.content ?? fromProject?.content ?? {},
      branding: input.branding ?? fromProject?.branding ?? {},
      template:
        input.template !== undefined
          ? input.template
          : (fromProject?.template ?? null),
      media: input.media ?? fromProject?.media ?? [],
      status: input.status ?? fromProject?.status ?? "draft",
      published_url:
        input.publishedUrl !== undefined
          ? input.publishedUrl
          : (fromProject?.published_url ?? null),
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(insert)
      .select("*")
      .single();

    if (error) return fail(error);
    return ok(await hydrateProjectRow(data as ProjectRow));
  } catch (error) {
    return fail(error);
  }
}

export async function getProjects(): Promise<ProjectResult<ProjectListItem[]>> {
  try {
    const supabase = createClient();
    // Full row (including content + media jsonb) is required to resolve thumbnails.
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, owner_id, name, business_name, business_type, description, goals, content, branding, template, media, status, published_url, created_at, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) return fail(error);

    const hydrated = await Promise.all(
      ((data as ProjectRow[]) ?? []).map((row) => hydrateProjectRow(row)),
    );
    return ok(hydrated.map(toProjectListItem));
  } catch (error) {
    return fail(error);
  }
}

export async function getProjectById(
  id: string,
): Promise<ProjectResult<ProjectRow>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return fail(error);
    return ok(await hydrateProjectRow(data as ProjectRow));
  } catch (error) {
    return fail(error);
  }
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<ProjectResult<ProjectRow>> {
  try {
    const supabase = createClient();
    const fromProject = input.project
      ? businessProjectToColumns(input.project, input.name)
      : null;

    const patch: ProjectUpdate = {};

    if (input.name !== undefined) patch.name = input.name.trim();
    else if (fromProject) patch.name = fromProject.name;

    if (input.businessName !== undefined) {
      patch.business_name = input.businessName.trim();
    } else if (fromProject) {
      patch.business_name = fromProject.business_name;
    }

    if (input.businessType !== undefined) {
      patch.business_type = input.businessType;
    } else if (fromProject) {
      patch.business_type = fromProject.business_type;
    }

    if (input.description !== undefined) {
      patch.description = input.description;
    } else if (fromProject) {
      patch.description = fromProject.description;
    }

    if (input.goals !== undefined) patch.goals = input.goals;
    else if (fromProject) patch.goals = fromProject.goals;

    if (input.content !== undefined) patch.content = input.content;
    else if (fromProject) patch.content = fromProject.content;

    if (input.branding !== undefined) patch.branding = input.branding;
    else if (fromProject) patch.branding = fromProject.branding;

    if (input.template !== undefined) patch.template = input.template;
    else if (fromProject) patch.template = fromProject.template;

    if (input.media !== undefined) patch.media = input.media;
    else if (fromProject) patch.media = fromProject.media;

    if (input.status !== undefined) patch.status = input.status;
    else if (fromProject) patch.status = fromProject.status;

    if (input.publishedUrl !== undefined) {
      patch.published_url = input.publishedUrl;
    } else if (fromProject) {
      patch.published_url = fromProject.published_url;
    }

    if (Object.keys(patch).length === 0) {
      return { ok: false, error: "No project fields provided to update." };
    }

    const { data, error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) return fail(error);
    return ok(await hydrateProjectRow(data as ProjectRow));
  } catch (error) {
    return fail(error);
  }
}

/**
 * Update project name / business metadata only.
 * Does not overwrite generated content, branding, media, template, or publish state.
 */
export async function updateProjectMetadata(
  input: ProjectMetadataInput,
): Promise<ProjectResult<ProjectRow>> {
  return updateProject({
    id: input.id,
    name: input.name,
    businessName: input.businessName,
    businessType: input.businessType,
    description: input.description ?? null,
  });
}

/**
 * Permanently delete a project owned by the signed-in user (hard delete).
 * RLS enforces ownership; the service-role key is never used.
 */
export async function deleteProject(
  id: string,
): Promise<ProjectResult<{ id: string }>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return fail(userError);
    if (!user) {
      return {
        ok: false,
        error: "Please sign in to delete a project, then try again.",
      };
    }

    const { data, error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return fail(error);
    if (!data) {
      return {
        ok: false,
        error:
          "Project not found or you don't have permission to delete it.",
      };
    }

    return ok({ id: data.id });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Duplicate a project for the signed-in user.
 * Copies editable data into a new draft row with a fresh id.
 * Does not copy created_at, updated_at, or published_url.
 */
export async function duplicateProject(
  id: string,
): Promise<ProjectResult<ProjectRow>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) return fail(userError);
    if (!user) {
      return {
        ok: false,
        error: "Please sign in to duplicate a project, then try again.",
      };
    }

    const sourceResult = await getProjectById(id);
    if (!sourceResult.ok) return sourceResult;

    const source = sourceResult.data;
    const content: ProjectContentJson = isRecord(source.content)
      ? { ...source.content }
      : {};
    // Duplicates start unpublished — drop publish snapshot from content.
    delete content.publish;

    const baseName = source.name.trim() || "Untitled project";
    const insert: ProjectInsert = {
      owner_id: user.id,
      name: `${baseName} Copy`,
      business_name: source.business_name,
      business_type: source.business_type,
      description: source.description,
      goals: Array.isArray(source.goals) ? [...source.goals] : [],
      content,
      branding: isRecord(source.branding) ? { ...source.branding } : {},
      template: source.template,
      media: Array.isArray(source.media) ? [...source.media] : [],
      status: "draft",
      published_url: null,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(insert)
      .select("*")
      .single();

    if (error) return fail(error);
    return ok(await hydrateProjectRow(data as ProjectRow));
  } catch (error) {
    return fail(error);
  }
}
