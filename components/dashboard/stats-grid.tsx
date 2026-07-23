"use client";

import StatCard from "@/components/dashboard/stat-card";
import { useProject } from "@/context/project-context";
import { getDashboardStats } from "@/lib/project";

/**
 * Four-up statistics overview derived from BusinessProject.
 */
export default function StatsGrid() {
  const { project } = useProject();
  const stats = getDashboardStats(project);

  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="sr-only">
        Website statistics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
          />
        ))}
      </div>
    </section>
  );
}
