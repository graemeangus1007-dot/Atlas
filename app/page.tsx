import Cta from "@/components/cta";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import PlaceholderSection from "@/components/placeholder-section";

/**
 * Atlas landing page.
 * Composition: sticky nav → hero → features → placeholders → CTA → footer.
 */
export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      {/* Sticky top navigation */}
      <Navbar />

      <main className="flex flex-1 flex-col">
        {/* Hero with CSS geometric background */}
        <Hero />

        {/* Product pillars — #features */}
        <Features />

        {/* Nav scroll targets (content expands in later sprints) */}
        <PlaceholderSection
          id="pricing"
          title="Pricing"
          description="Simple plans for every stage of your business. Full pricing details are coming soon."
        />
        <PlaceholderSection
          id="about"
          title="About Atlas"
          description="We're building the easiest way for small businesses to launch professional websites with AI."
        />
        <PlaceholderSection
          id="demo"
          title="Watch Demo"
          description="A product walkthrough will live here. For now, start building to explore the Atlas flow."
        />

        {/* Closing conversion section */}
        <Cta />
      </main>

      {/* Site footer — also #contact scroll target */}
      <Footer />
    </div>
  );
}
