import type { AiContentField, AiHistoryEntry } from "@/types/ai";
import type { BusinessProject } from "@/types/business-project";

/**
 * Apply an AI suggestion onto a BusinessProject (immutable).
 * Used for Preview overlays and permanent Apply / Undo.
 */
export function applyAiFieldValue(
  project: BusinessProject,
  field: AiContentField,
  value: string,
  serviceIndex?: number,
): BusinessProject {
  if (field === "serviceTitle" || field === "serviceDescription") {
    const index = serviceIndex ?? 0;
    const services = project.services.map((service, i) => {
      if (i !== index) return service;
      if (field === "serviceTitle") return { ...service, title: value };
      return { ...service, description: value };
    });
    return { ...project, services };
  }

  return { ...project, [field]: value };
}

/** Read the current value for an AI field from the project. */
export function readAiFieldValue(
  project: BusinessProject,
  field: AiContentField,
  serviceIndex?: number,
): string {
  if (field === "serviceTitle") {
    return project.services[serviceIndex ?? 0]?.title ?? "";
  }
  if (field === "serviceDescription") {
    return project.services[serviceIndex ?? 0]?.description ?? "";
  }
  return project[field] ?? "";
}

/** Build a history entry capturing the value before an Apply. */
export function createAiHistoryEntry(
  project: BusinessProject,
  field: AiContentField,
  serviceIndex?: number,
): AiHistoryEntry {
  return {
    field,
    previousValue: readAiFieldValue(project, field, serviceIndex),
    serviceIndex,
  };
}
