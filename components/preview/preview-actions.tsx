import Button from "@/components/ui/button";

/**
 * Atlas product actions sitting under the generated site preview.
 */
export default function PreviewActions() {
  return (
    <section className="border-t border-border bg-surface/40 px-5 py-12 sm:px-8 sm:py-14">
      <div className="mx-auto flex max-w-5xl flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
        <Button href="/editor" variant="secondary" className="px-8 py-4 text-base">
          Edit Website
        </Button>
        <Button href="/dashboard" className="px-8 py-4 text-base">
          Continue to Dashboard
        </Button>
      </div>
    </section>
  );
}
