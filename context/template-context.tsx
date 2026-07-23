"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useProject } from "@/context/project-context";
import "@/lib/templates";
import { getTemplate } from "@/lib/templates";
import type { WebsiteTemplate } from "@/lib/templates";

type TemplateContextValue = {
  template: WebsiteTemplate;
  templateId: string;
};

const TemplateContext = createContext<TemplateContextValue | null>(null);

type TemplateProviderProps = {
  children: ReactNode;
};

/**
 * Resolves the active layout template from BusinessProject.templateId.
 * Must sit under ProjectProvider.
 */
export function TemplateProvider({ children }: TemplateProviderProps) {
  const { project } = useProject();

  const value = useMemo(() => {
    const template = getTemplate(project.templateId || "modern");
    return {
      template,
      templateId: template.id,
    };
  }, [project.templateId]);

  return (
    <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>
  );
}

export function useTemplate(): TemplateContextValue {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error("useTemplate must be used within a TemplateProvider");
  }
  return context;
}
