"use client";

import { useProject } from "@/context/project-context";

/**
 * Reusable autosave status hook for editor / dashboard chrome.
 */
export function useAutosave() {
  const { saveStatus, isSaving, saveError, saveNow, projectId } = useProject();

  const label =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? "Saved ✓"
        : saveStatus === "error"
          ? "Save failed"
          : projectId
            ? "All changes saved"
            : "Not saved yet";

  return {
    saveStatus,
    isSaving,
    saveError,
    saveNow,
    label,
    canSave: Boolean(projectId),
  };
}
