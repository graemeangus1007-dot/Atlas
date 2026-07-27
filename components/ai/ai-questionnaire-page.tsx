"use client";

import Link from "next/link";
import AiQuestionnaire from "@/components/ai/ai-questionnaire";
import { useProject } from "@/context/project-context";

/**
 * Dashboard host for the AI questionnaire — requires an active project.
 */
export default function AiQuestionnairePage() {
  const { projectId, project, isLoading } = useProject();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-atlas-display)] text-3xl font-semibold tracking-tight text-foreground">
          AI Website
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Answer a few questions about your business. Atlas will draft a
          homepage you can refine later.
        </p>
        {projectId && project.businessName ? (
          <p className="text-xs text-muted">
            Saving progress for{" "}
            <span className="text-foreground">{project.businessName}</span>
          </p>
        ) : null}
      </header>

      {isLoading ? (
        <p className="text-sm text-muted">Loading project…</p>
      ) : !projectId ? (
        <div className="rounded-2xl border border-border bg-surface/40 p-6 text-sm text-muted">
          <p>Select or create a project first, then return here to continue.</p>
          <Link
            href="/projects"
            className="mt-4 inline-flex text-accent underline-offset-2 hover:underline"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <AiQuestionnaire key={projectId} projectId={projectId} />
      )}
    </div>
  );
}
