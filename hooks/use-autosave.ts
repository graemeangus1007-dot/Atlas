"use client";

import { useCallback } from "react";
import { useProject, type SaveStatus } from "@/context/project-context";

export type AutosaveLabel =
  | "Saved"
  | "Saving..."
  | "Unsaved changes"
  | "Save failed"
  | "Create or open a project to autosave";

function labelForStatus(
  saveStatus: SaveStatus,
  canSave: boolean,
): AutosaveLabel {
  if (!canSave) return "Create or open a project to autosave";

  switch (saveStatus) {
    case "saving":
      return "Saving...";
    case "saved":
    case "idle":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "error":
      return "Save failed";
    default:
      return "Saved";
  }
}

/**
 * Autosave status for editor chrome.
 * Persistence stays in Project Context → lib/supabase/projects.updateProject().
 */
export function useAutosave() {
  const { saveStatus, isSaving, saveError, saveNow, projectId } = useProject();
  const canSave = Boolean(projectId);
  const label = labelForStatus(saveStatus, canSave);

  const retry = useCallback(async () => {
    if (!canSave) return;
    await saveNow();
  }, [canSave, saveNow]);

  return {
    saveStatus,
    isSaving,
    saveError,
    saveNow,
    retry,
    label,
    canSave,
    showRetry: canSave && saveStatus === "error",
  };
}
