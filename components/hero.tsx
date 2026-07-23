import Button from "@/components/ui/button";

/**
 * Hero — primary conversion surface with CSS-only geometric atmosphere.
 */
export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden px-5 pb-24 pt-20 text-center sm:px-8 sm:pb-32 sm:pt-28">
      {/* Decorative geometry — gradients + shapes, no images */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        {/* Soft color fields */}
        <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,184,168,0.18)_0%,transparent_65%)] blur-2xl" />
        <div className="absolute -left-24 top-32 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(90,130,200,0.14)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute -right-16 top-48 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(61,184,168,0.1)_0%,transparent_70%)] blur-3xl" />

        {/* Geometric rings / frames */}
        <div className="absolute left-1/2 top-16 h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-white/[0.06]" />
        <div className="absolute left-1/2 top-28 h-[300px] w-[300px] -translate-x-1/2 rounded-full border border-white/[0.04]" />
        <div className="absolute right-[8%] top-24 h-24 w-24 rotate-12 rounded-2xl border border-white/[0.08] bg-white/[0.02]" />
        <div className="absolute bottom-20 left-[10%] h-16 w-16 -rotate-6 rounded-full border border-accent/20 bg-accent/5" />
        <div className="absolute bottom-32 right-[14%] h-10 w-10 rotate-45 border border-white/[0.1]" />

        {/* Fine grid suggestion */}
        <div className="atlas-hero-grid absolute inset-0 opacity-[0.35]" />
      </div>

      {/* Eyebrow */}
      <p className="animate-fade-up mx-auto inline-flex items-center rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wide text-muted">
        AI-powered websites for small businesses
      </p>

      <h1 className="animate-fade-up-delay-1 mx-auto mt-6 max-w-4xl font-[family-name:var(--font-atlas-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
        Build a Professional Website in Minutes
      </h1>

      <p className="animate-fade-up-delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg md:text-xl">
        Create beautiful websites with AI. No coding required.
      </p>

      {/* Primary actions */}
      <div className="animate-fade-up-delay-3 mt-10 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
        <Button href="/onboarding" className="px-8 py-3.5">
          Start Building
        </Button>
        <Button href="#demo" variant="secondary" className="px-8 py-3.5">
          Watch Demo
        </Button>
      </div>
    </section>
  );
}
