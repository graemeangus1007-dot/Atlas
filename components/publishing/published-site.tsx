"use client";

import Link from "next/link";
import { useMemo } from "react";
import WebsiteRenderer from "@/components/templates/website-renderer";
import { useProject } from "@/context/project-context";
import { buildSiteDesignStyle } from "@/lib/design-theme";
import { getTemplate } from "@/lib/templates";
import "@/lib/templates";
import { generateWebsiteContent } from "@/lib/website-generator";

type PublishedSiteProps = {
  slug: string;
};

/**
 * Read-only published site — renders the frozen publish snapshot.
 * No editor chrome; content/images/branding/template from last publish.
 */
export default function PublishedSite({ slug }: PublishedSiteProps) {
  const { project } = useProject();
  const record = project.publish;
  const matches = record !== null && record.slug === slug;

  const snapshot = matches ? record.snapshot : null;

  const content = useMemo(
    () => (snapshot ? generateWebsiteContent(snapshot) : null),
    [snapshot],
  );
  const themeStyle = useMemo(
    () => (snapshot ? buildSiteDesignStyle(snapshot) : undefined),
    [snapshot],
  );
  const template = snapshot ? getTemplate(snapshot.templateId) : null;

  if (!matches || !snapshot || !content || !template) {
    return (
      <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold text-foreground">
          Site not published
        </h1>
        <p className="max-w-md text-sm text-muted">
          No published site matches{" "}
          <span className="font-mono text-foreground">/{slug}</span>. Publish
          from the dashboard or editor first.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Back to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border bg-background/90 px-4 py-2 text-center text-xs text-muted backdrop-blur-xl">
        Published preview · read-only ·{" "}
        <span className="font-mono text-foreground">{record.url}</span>
        {" · "}
        <Link
          href="/dashboard"
          className="font-medium text-accent hover:text-accent-hover"
        >
          Dashboard
        </Link>
      </div>
      <div
        className="site-canvas flex min-h-0 flex-1 flex-col"
        style={themeStyle}
        data-template={template.id}
        data-motion={content.creativePolish?.motion ? "on" : "off"}
        data-motion-preset={
          content.creativePolish?.motionPreset ??
          (content.creativePolish?.motion ? "subtle" : "none")
        }
        data-section-reveal={
          (content.creativePolish?.sectionReveal ??
          content.creativePolish?.motion)
            ? "on"
            : "off"
        }
        data-hover-effects={
          (content.creativePolish?.hoverEffects ??
          content.creativePolish?.motion)
            ? "on"
            : "off"
        }
        data-hierarchy={content.creativePolish?.visualHierarchy ? "on" : "off"}
        data-spacing={content.creativePolish?.spacing ?? "default"}
      >
        <WebsiteRenderer content={content} template={template} />
      </div>
    </div>
  );
}
