import SiteHero from "@/components/site/site-hero";
import type { HeroComposition } from "@/lib/hero-composition";
import type { HeroLayout } from "@/lib/templates";
import { inferLegacyHeroComposition } from "@/lib/hero-composition";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type PreviewHeroProps = {
  content: GeneratedWebsiteContent["hero"];
  /** Preferred: resolved composition from generateWebsiteContent. */
  composition?: HeroComposition;
  /** @deprecated Prefer composition — kept for call sites that only pass layout. */
  heroLayout?: HeroLayout;
};

/**
 * Generated homepage hero — layout from resolved HeroComposition.
 */
export default function PreviewHero({
  content,
  composition,
  heroLayout = "centered",
}: PreviewHeroProps) {
  const resolved =
    composition ??
    inferLegacyHeroComposition({
      heroLayout,
      heroOverlay: 50,
    });

  return (
    <SiteHero
      content={content}
      composition={resolved}
      testId="preview-hero"
    />
  );
}
