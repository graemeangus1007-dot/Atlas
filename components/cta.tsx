import Button from "@/components/ui/button";

/**
 * Closing conversion band before the footer.
 */
export default function Cta() {
  return (
    <section
      id="get-started"
      className="scroll-mt-20 border-t border-border px-5 py-24 sm:px-8 sm:py-28"
    >
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-surface/80 px-6 py-16 text-center sm:px-12 sm:py-20">
        {/* Soft accent glow behind the CTA panel */}
        <div
          className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_center,rgba(61,184,168,0.12),transparent_65%)]"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <h2 className="font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Ready to Grow Your Business?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted sm:text-lg">
            Launch a polished site today — no designers, developers, or
            complicated tools required.
          </p>
          <div className="mt-10">
            <Button href="/onboarding" className="px-8 py-3.5">
              Create Your Website
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
