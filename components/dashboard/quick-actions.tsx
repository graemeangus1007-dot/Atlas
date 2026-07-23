"use client";

import Button from "@/components/ui/button";

type QuickActionsProps = {
  onGenerateAiContent: () => void;
  onPublish: () => void;
};

/**
 * Primary shortcuts for the most common dashboard tasks.
 */
export default function QuickActions({
  onGenerateAiContent,
  onPublish,
}: QuickActionsProps) {
  return (
    <section
      aria-labelledby="actions-heading"
      className="rounded-2xl border border-border bg-surface/60 p-6"
    >
      <h2
        id="actions-heading"
        className="font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground"
      >
        Quick Actions
      </h2>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button href="/editor" className="w-full sm:w-auto">
          Edit Website
        </Button>
        <Button href="/preview" variant="secondary" className="w-full sm:w-auto">
          Preview Website
        </Button>
        <Button
          href="#generate-ai"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={(event) => {
            event.preventDefault();
            onGenerateAiContent();
          }}
        >
          Generate AI Content
        </Button>
        <Button
          href="#publish"
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={(event) => {
            event.preventDefault();
            onPublish();
          }}
        >
          Publish Website
        </Button>
      </div>
    </section>
  );
}
