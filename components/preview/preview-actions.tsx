import Button from "@/components/ui/button";

/**
 * Actions under the site preview — continue editing, not a second create path.
 */
export default function PreviewActions() {
  return (
    <section className="border-t border-border bg-surface/40 px-5 py-12 sm:px-8 sm:py-14">
      <div className="mx-auto flex max-w-5xl flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
        <Button href="/editor" className="px-8 py-4 text-base">
          Back to Editor
        </Button>
        <Button href="/projects" variant="secondary" className="px-8 py-4 text-base">
          Projects
        </Button>
      </div>
    </section>
  );
}
