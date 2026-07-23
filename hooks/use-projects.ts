"use client";

import { useProject } from "@/context/project-context";

/**
 * Reusable projects hook — list + CRUD without duplicating fetch logic.
 */
export function useProjects() {
  const {
    projects,
    projectId,
    isLoading,
    refreshProjects,
    createProject,
    openProject,
    renameProject,
    deleteProject,
  } = useProject();

  return {
    projects,
    activeProjectId: projectId,
    isLoading,
    refreshProjects,
    createProject,
    openProject,
    renameProject,
    deleteProject,
  };
}
