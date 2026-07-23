"use client";

import { useState } from "react";
import AiSuggestions from "@/components/dashboard/ai-suggestions";
import GenerateAiModal from "@/components/dashboard/generate-ai-modal";
import ProjectList from "@/components/dashboard/project-list";
import QuickActions from "@/components/dashboard/quick-actions";
import RecentActivity from "@/components/dashboard/recent-activity";
import StatsGrid from "@/components/dashboard/stats-grid";
import PublishModal from "@/components/publishing/publish-modal";
import { useAuth } from "@/hooks/use-auth";
import { useProject } from "@/context/project-context";
import type { AiContentField } from "@/types/ai";

/**
 * Dashboard home — real projects + active project overview.
 */
export default function DashboardHome() {
  const { project, projectId, projects, isLoading } = useProject();
  const { isConfigured } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiField, setAiField] = useState<AiContentField>("heroHeadline");
  const [publishOpen, setPublishOpen] = useState(false);

  function openAiModal(field: AiContentField = "heroHeadline") {
    setAiField(field);
    setAiModalOpen(true);
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            {projectId
              ? `Working on ${project.businessName}. Manage projects, edit content, and publish when ready.`
              : "Create a project to start building your website."}
          </p>
        </div>

        {!isConfigured ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Supabase is not configured. Copy <code className="font-mono">.env.example</code>{" "}
            to <code className="font-mono">.env.local</code>, add your project URL and publishable
            key, then run the SQL in <code className="font-mono">supabase/migrations/</code>.
          </div>
        ) : null}

        <ProjectList />

        {isLoading ? (
          <p className="text-sm text-muted">Loading workspace…</p>
        ) : projectId || projects.length > 0 ? (
          <>
            <StatsGrid />

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <RecentActivity />
              </div>
              <div className="lg:col-span-2">
                <QuickActions
                  onGenerateAiContent={() => openAiModal()}
                  onPublish={() => setPublishOpen(true)}
                />
              </div>
            </div>

            <AiSuggestions onSelectSuggestion={openAiModal} />
          </>
        ) : null}
      </div>

      <GenerateAiModal
        open={aiModalOpen}
        initialField={aiField}
        onClose={() => setAiModalOpen(false)}
      />

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} />
    </main>
  );
}
