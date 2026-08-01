"use client";

import EditorPublishPanel from "@/components/publishing/editor-publish-panel";
import SeoPanel from "@/components/seo/seo-panel";
import type { BusinessProject } from "@/types/business-project";

type EditorSiteSettingsPanelProps = {
  project: BusinessProject;
  onChange: (partial: Partial<BusinessProject>) => void;
  onPublishToProduction: () => void;
};

/**
 * Site settings — SEO + domain/versions. Publish CTA stays in the top bar.
 */
export default function EditorSiteSettingsPanel({
  project,
  onChange,
  onPublishToProduction,
}: EditorSiteSettingsPanelProps) {
  return (
    <div
      className="flex w-full flex-col gap-4"
      data-testid="editor-site-settings-panel"
    >
      <SeoPanel project={project} onChange={onChange} />
      <EditorPublishPanel onPublishToProduction={onPublishToProduction} />
    </div>
  );
}
