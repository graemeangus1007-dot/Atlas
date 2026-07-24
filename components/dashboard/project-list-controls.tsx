"use client";

import {
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUS_FILTER_OPTIONS,
  type ProjectListQuery,
  type ProjectSortOption,
  type ProjectStatusFilter,
} from "@/lib/project-list-query";

type ProjectListControlsProps = {
  query: ProjectListQuery;
  resultsLabel: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onStatusChange: (value: ProjectStatusFilter) => void;
  onSortChange: (value: ProjectSortOption) => void;
};

/**
 * Search / status / sort controls for the shared project list.
 * Filtering runs in memory — no Supabase requests from these inputs.
 */
export default function ProjectListControls({
  query,
  resultsLabel,
  onSearchChange,
  onClearSearch,
  onStatusChange,
  onSortChange,
}: ProjectListControlsProps) {
  const hasSearch = query.search.length > 0;

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="project-search"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Search
          </label>
          <div className="relative mt-1.5">
            <input
              id="project-search"
              type="search"
              value={query.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, business, type, or description"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-3 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoComplete="off"
            />
            {hasSearch ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <span aria-hidden="true">✕</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[28rem]">
          <div>
            <label
              htmlFor="project-status-filter"
              className="text-xs font-medium uppercase tracking-wide text-muted"
            >
              Status
            </label>
            <select
              id="project-status-filter"
              value={query.status}
              onChange={(event) =>
                onStatusChange(event.target.value as ProjectStatusFilter)
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {PROJECT_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="project-sort"
              className="text-xs font-medium uppercase tracking-wide text-muted"
            >
              Sort
            </label>
            <select
              id="project-sort"
              value={query.sort}
              onChange={(event) =>
                onSortChange(event.target.value as ProjectSortOption)
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {PROJECT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {resultsLabel}
      </p>
    </div>
  );
}
