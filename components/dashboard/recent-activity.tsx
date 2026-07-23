"use client";

import { useMemo } from "react";
import { useProject } from "@/context/project-context";
import { formatProjectStatus } from "@/lib/project";

/**
 * Recent activity derived from the active project / publish state.
 */
export default function RecentActivity() {
  const { project, projectId, projects } = useProject();

  const items = useMemo(() => {
    if (!projectId) {
      return [
        {
          id: "empty",
          title: "No active project yet",
          time: "Create a project to get started",
        },
      ];
    }

    const activity = [
      {
        id: "status",
        title: `Project status: ${formatProjectStatus(project.status)}`,
        time: project.businessName,
      },
      {
        id: "template",
        title: `Template: ${project.templateId}`,
        time: "Layout style",
      },
    ];

    if (project.publish) {
      activity.unshift({
        id: "publish",
        title: "Website published",
        time: project.publish.url,
      });
    }

    activity.push({
      id: "count",
      title: `${projects.length} project${projects.length === 1 ? "" : "s"} in your account`,
      time: "Workspace",
    });

    return activity;
  }, [project, projectId, projects.length]);

  return (
    <section
      aria-labelledby="activity-heading"
      className="rounded-2xl border border-border bg-surface/60 p-6"
    >
      <h2
        id="activity-heading"
        className="font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground"
      >
        Recent Activity
      </h2>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
