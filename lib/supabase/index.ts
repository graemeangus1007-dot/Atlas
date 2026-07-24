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
} from "@/lib/supabase/projects";
export { getAuthErrorMessage } from "@/lib/auth";
export {
  getSupabaseEnv,
  isSupabaseConfigured,
  type Database,
  type ProjectRow,
  type ProjectListItem,
  type ProjectInsert,
  type ProjectUpdate,
  type ProjectResult,
  type ProjectContentJson,
  type ProjectBrandingJson,
  type SupabasePublicEnv,
} from "@/lib/supabase/types";
