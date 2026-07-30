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

  const motionOn = Boolean(content.creativePolish?.motion);
  const sectionReveal =
    content.creativePolish?.sectionReveal ?? motionOn;
  const hoverEffects =
    content.creativePolish?.hoverEffects ?? motionOn;

  return (
    <div
      className="site-canvas flex min-h-full flex-1 flex-col"
      style={themeStyle}
      data-template={template.id}
      data-motion={motionOn ? "on" : "off"}
      data-motion-preset={content.creativePolish?.motionPreset ?? (motionOn ? "subtle" : "none")}
      data-section-reveal={sectionReveal ? "on" : "off"}
      data-hover-effects={hoverEffects ? "on" : "off"}
      data-hierarchy={content.creativePolish?.visualHierarchy ? "on" : "off"}
      data-spacing={content.creativePolish?.spacing ?? "default"}
    >
      <WebsiteRenderer content={content} template={template} />
      <PreviewActions />
    </div>
  );
}
