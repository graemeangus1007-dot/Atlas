"use client";

import { useCallback, useState } from "react";
import { useProject } from "@/context/project-context";

/**
 * Dedicated projects hook for dashboard /projects UI.
 *
 * List + open go through Context, which calls getProjects() /
 * getProjectById() in lib/supabase/projects.ts — presentation
 * components never query Supabase directly.
 */
export function useProjects() {
  const {
    projects,
    projectId,
    isLoading,
    listError,
    refreshProjects,
    createProject,
    openProject,
    renameProject,
    deleteProject,
  } = useProject();

  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refreshProjects();
    } catch {
      // listError is set inside refreshProjects
    } finally {
      setIsRetrying(false);
    }
  }, [refreshProjects]);

  return {
    projects,
    activeProjectId: projectId,
    isLoading: isLoading || isRetrying,
    error: listError,
    retry,
    refreshProjects,
    createProject,
    openProject,
    renameProject,
    deleteProject,
  };
}
