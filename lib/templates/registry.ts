import type { TemplateId, WebsiteTemplate } from "@/lib/templates/types";

/**
 * TemplateRegistry — register and resolve layout templates by id.
 * Third-party packs can call `registerTemplate` without editing core files
 * as long as they import this module (or a plugins entry that does).
 */
class TemplateRegistryImpl {
  private readonly templates = new Map<TemplateId, WebsiteTemplate>();

  register(template: WebsiteTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): WebsiteTemplate | undefined {
    return this.templates.get(id as TemplateId);
  }

  require(id: string): WebsiteTemplate {
    const template = this.get(id);
    if (!template) {
      const fallback = this.templates.get("modern");
      if (!fallback) {
        throw new Error(`Template "${id}" not found and no fallback registered.`);
      }
      return fallback;
    }
    return template;
  }

  list(): WebsiteTemplate[] {
    return Array.from(this.templates.values());
  }

  ids(): TemplateId[] {
    return Array.from(this.templates.keys());
  }
}

export const TemplateRegistry = new TemplateRegistryImpl();

/** Convenience alias used by the app. */
export function registerTemplate(template: WebsiteTemplate): void {
  TemplateRegistry.register(template);
}

export function getTemplate(id: string): WebsiteTemplate {
  return TemplateRegistry.require(id);
}

export function listTemplates(): WebsiteTemplate[] {
  return TemplateRegistry.list();
}
