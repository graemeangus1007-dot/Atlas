"use client";

import { useMemo } from "react";
import PreviewActions from "@/components/preview/preview-actions";
import WebsiteRenderer from "@/components/templates/website-renderer";
import { useTemplate } from "@/context/template-context";
import { useProject } from "@/context/project-context";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { generateWebsiteContent } from "@/lib/website-generator";

/**
 * Full generated-site preview — layout from TemplateRegistry via WebsiteRenderer.
 */
export default function WebsitePreview() {
  const { project } = useProject();
  const { template } = useTemplate();
  const content = useMemo(() => generateWebsiteContent(project), [project]);
  const themeStyle = useMemo(() => buildSiteDesignStyle(project), [project]);

  return (
    <div
      className="site-canvas flex min-h-full flex-1 flex-col"
      style={themeStyle}
    >
      <WebsiteRenderer content={content} template={template} />
      <PreviewActions />
    </div>
  );
}
