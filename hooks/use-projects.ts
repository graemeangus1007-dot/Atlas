"use client";

import { useCallback, useState } from "react";
import { useProject } from "@/context/project-context";

/**
 * Dedicated projects hook for dashboard /projects UI.
 *
 * List + mutations go through Context, which calls helpers in
 * lib/supabase/projects.ts — presentation components never query Supabase.
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
    updateProjectDetails,
    duplicateProject,
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
    updateProjectDetails,
    duplicateProject,
    deleteProject,
  };
}
