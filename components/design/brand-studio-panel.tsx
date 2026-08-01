"use client";

import ButtonStyleSelector from "@/components/design/button-style-selector";
import ColorPicker from "@/components/design/color-picker";
import FontSelector from "@/components/design/font-selector";
import OverlaySlider from "@/components/design/overlay-slider";
import SiteWidthSelector from "@/components/design/site-width-selector";
import {
  BODY_FONTS,
  BUTTON_STYLES,
  HEADING_FONTS,
  type BodyFontId,
  type ButtonStyleId,
  type HeadingFontId,
  type SiteWidthId,
} from "@/data/design-options";
import type { BusinessProject } from "@/types/business-project";

type BrandStudioPanelProps = {
  project: BusinessProject;
  onChange: (partial: Partial<BusinessProject>) => void;
};

/**
 * Design appearance controls that write into BusinessProject Context.
 */
export default function BrandStudioPanel({
  project,
  onChange,
}: BrandStudioPanelProps) {
  return (
    <aside
      className="flex h-full max-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface/70 backdrop-blur-xl lg:sticky lg:top-4 lg:rounded-2xl lg:rounded-r-none lg:border-r-0"
      aria-label="Design"
      data-testid="editor-brand-studio"
    >
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="font-[family-name:var(--font-atlas-display)] text-sm font-semibold text-foreground">
          Design
        </h2>
        <p className="mt-1 text-xs text-muted">
          Colors, type, buttons, overlay, and width.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-2" aria-labelledby="brand-colors-heading">
          <h3
            id="brand-colors-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Brand Colors
          </h3>
          <ColorPicker
            label="Primary Color"
            description="Navigation and brand moments"
            value={project.primaryColor}
            onChange={(primaryColor) => onChange({ primaryColor })}
          />
          <ColorPicker
            label="Secondary Color"
            description="Cards and supporting surfaces"
            value={project.secondaryColor}
            onChange={(secondaryColor) => onChange({ secondaryColor })}
          />
          <ColorPicker
            label="Accent Color"
            description="Buttons, links, and highlights"
            value={project.accentColor}
            onChange={(accentColor) => onChange({ accentColor })}
          />
          <ColorPicker
            label="Background Color"
            description="Page background and hero wash"
            value={project.backgroundColor}
            onChange={(backgroundColor) => onChange({ backgroundColor })}
          />
        </section>

        <section className="space-y-4" aria-labelledby="brand-type-heading">
          <h3
            id="brand-type-heading"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Typography
          </h3>
          <FontSelector
            label="Heading Font"
            value={project.headingFont}
            options={HEADING_FONTS}
            onChange={(id) => onChange({ headingFont: id as HeadingFontId })}
          />
          <FontSelector
            label="Body Font"
            value={project.bodyFont}
            options={BODY_FONTS}
            onChange={(id) => onChange({ bodyFont: id as BodyFontId })}
          />
        </section>

        <section aria-labelledby="brand-buttons-heading">
          <h3 id="brand-buttons-heading" className="sr-only">
            Button styles
          </h3>
          <ButtonStyleSelector
            value={project.buttonStyle}
            options={BUTTON_STYLES}
            onChange={(id) => onChange({ buttonStyle: id as ButtonStyleId })}
          />
        </section>

        <section aria-labelledby="brand-overlay-heading">
          <h3 id="brand-overlay-heading" className="sr-only">
            Hero overlay
          </h3>
          <OverlaySlider
            value={project.heroOverlay}
            onChange={(heroOverlay) => onChange({ heroOverlay })}
          />
        </section>

        <section aria-labelledby="brand-width-heading">
          <h3 id="brand-width-heading" className="sr-only">
            Website width
          </h3>
          <SiteWidthSelector
            value={project.siteWidth}
            onChange={(siteWidth: SiteWidthId) => onChange({ siteWidth })}
          />
        </section>
      </div>
    </aside>
  );
}
