import { getTemplate } from "@/lib/templates/registry";
import type { TemplateId } from "@/lib/templates/types";
import type { BusinessProject } from "@/types/business-project";

/**
 * Apply a layout template's identity + color/button defaults onto a project.
 */
export function applyTemplateToProject(
  project: BusinessProject,
  templateId: TemplateId | string,
): BusinessProject {
  const template = getTemplate(templateId);

  return {
    ...project,
    templateId: template.id,
    primaryColor: template.colorDefaults.primaryColor,
    secondaryColor: template.colorDefaults.secondaryColor,
    accentColor: template.colorDefaults.accentColor,
    backgroundColor: template.colorDefaults.backgroundColor,
    buttonStyle: template.buttonStyle,
  };
}
