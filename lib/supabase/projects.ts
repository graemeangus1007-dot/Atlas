import type { BusinessProject, ProjectStatus } from "@/types/business-project";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/supabase/errors";
import type { ProjectListItem, ProjectRow } from "@/lib/supabase/types";

function toListItem(row: ProjectRow): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    businessType: row.data?.businessType || "",
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

/**
 * Project persistence API — single source for all projects table access.
 */
export async function listProjects(): Promise<ProjectListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(getAuthErrorMessage(error));
  return (data as ProjectRow[]).map(toListItem);
}

export async function getProject(id: string): Promise<ProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(getAuthErrorMessage(error));
  return data as ProjectRow;
}

export async function createProject(input: {
  userId: string;
  name: string;
  data: BusinessProject;
}): Promise<ProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: input.userId,
      name: input.name,
      data: input.data,
      status: input.data.status,
    })
    .select("*")
    .single();

  if (error) throw new Error(getAuthErrorMessage(error));
  return data as ProjectRow;
}

export async function updateProjectRecord(input: {
  id: string;
  name?: string;
  data?: BusinessProject;
  status?: ProjectStatus;
}): Promise<ProjectRow> {
  const supabase = createClient();
  const patch: {
    name?: string;
    data?: BusinessProject;
    status?: ProjectStatus;
  } = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.data !== undefined) {
    patch.data = input.data;
    patch.status = input.data.status;
  }
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw new Error(getAuthErrorMessage(error));
  return data as ProjectRow;
}

export async function renameProject(
  id: string,
  name: string,
): Promise<ProjectRow> {
  return updateProjectRecord({ id, name });
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(getAuthErrorMessage(error));
}
