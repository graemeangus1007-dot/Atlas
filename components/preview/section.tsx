import type { ReactNode } from "react";

type PreviewSectionProps = {
  id: string;
  children: ReactNode;
  /** When false, omits the bottom border (e.g. final content section). */
  bordered?: boolean;
  className?: string;
};

/**
 * Shared page-section shell for the generated-site preview.
 */
export default function PreviewSection({
  id,
  children,
  bordered = true,
  className = "",
}: PreviewSectionProps) {
  return (
    <section
      id={id}
      className={`site-section scroll-mt-20 px-5 py-20 sm:px-8 sm:py-24 ${
        bordered ? "border-b border-border" : ""
      } ${className}`}
    >
      <div className="site-shell">{children}</div>
    </section>
  );
}
