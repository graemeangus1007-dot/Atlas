export { createClient as createBrowserClient, createSupabaseClient, requireSupabaseEnv } from "@/lib/supabase/client";
export {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  getSessionUser,
} from "@/lib/auth";
export {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  updateProjectMetadata,
  deleteProject,
  duplicateProject,
  businessProjectToColumns,
  rowToBusinessProject,
  toProjectListItem,
  hydrateProjectRow,
} from "@/lib/supabase/projects";
export {
  PROJECT_MEDIA_BUCKET,
  PROJECT_MEDIA_SIGNED_URL_TTL_SECONDS,
  uploadProjectMedia,
  uploadProjectMediaFiles,
  deleteProjectMedia,
  getProjectMediaUrl,
  getProjectMediaUrls,
  hydrateMediaLibrary,
  mediaAssetNeedsSignedUrlRefresh,
  validateProjectMediaFile,
  getStorageErrorMessage,
} from "@/lib/supabase/storage";
export {
  createPublishVersion,
  listPublishVersions,
  listPublishVersionPage,
  getPublishVersion,
  getLatestPublishVersion,
  sanitizeProjectSnapshot,
  createSupabasePublishVersionsGateway,
  createMemoryPublishVersionsGateway,
  type PublishVersionsGateway,
} from "@/lib/supabase/publish-versions";
export { PUBLISH_VERSION_PAGE_SIZE } from "@/lib/publishing/publish-version-types";
export { getAuthErrorMessage } from "@/lib/auth";
export {
  getSupabaseEnv,
  isSupabaseConfigured,
  type Database,
  type ProjectRow,
  type ProjectListItem,
  type ProjectListThumbnail,
  type ProjectInsert,
  type ProjectUpdate,
  type ProjectResult,
  type ProjectContentJson,
  type ProjectBrandingJson,
  type SupabasePublicEnv,
} from "@/lib/supabase/types";
export {
  createServiceClient,
  tryCreateServiceClient,
  getServiceRoleKey,
} from "@/lib/supabase/service";
