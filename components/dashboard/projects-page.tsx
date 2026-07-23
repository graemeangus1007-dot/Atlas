"use client";

import ProjectList from "@/components/dashboard/project-list";

/**
 * /projects — manage all website projects for the signed-in user.
 */
export default function ProjectsPage() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-[family-name:var(--font-atlas-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Create, open, rename, or delete your Atlas website projects.
          </p>
        </div>
        <ProjectList />
      </div>
    </main>
  );
}
