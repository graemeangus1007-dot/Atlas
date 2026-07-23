import SectionHeading from "@/components/preview/section-heading";
import PreviewSection from "@/components/preview/section";
import { cardStyleClass } from "@/lib/templates";
import type { CardStyle } from "@/lib/templates";
import type { GeneratedWebsiteContent } from "@/types/website-content";

type PreviewAboutProps = {
  businessName: string;
  about: GeneratedWebsiteContent["about"];
  cardStyle?: CardStyle;
};

/**
 * About section — description card style from the active template.
 */
export default function PreviewAbout({
  businessName,
  about,
  cardStyle = "elevated",
}: PreviewAboutProps) {
  return (
    <PreviewSection id="about">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          eyebrow="About"
          title={about.title}
          align="left"
          accentClassName="text-[color:var(--site-accent)]"
        />
        <div
          className={`rounded-3xl border p-6 sm:p-8 ${cardStyleClass(cardStyle)}`}
        >
          <p className="text-base leading-relaxed text-muted sm:text-lg">
            {about.description}
          </p>
          <p className="mt-6 text-sm text-foreground/80">
            — The team at {businessName}
          </p>
        </div>
      </div>
    </PreviewSection>
  );
}
