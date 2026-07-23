export { createClient as createBrowserClient, createSupabaseClient, requireSupabaseEnv } from "@/lib/supabase/client";
export {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  getSessionUser,
} from "@/lib/auth";
export {
  listProjects,
  getProject,
  createProject,
  updateProjectRecord,
  renameProject,
  deleteProject,
} from "@/lib/supabase/projects";
export { getAuthErrorMessage } from "@/lib/auth";
export {
  getSupabaseEnv,
  isSupabaseConfigured,
  type Database,
  type ProjectRow,
  type ProjectListItem,
  type SupabasePublicEnv,
} from "@/lib/supabase/types";
