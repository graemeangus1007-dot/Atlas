import type { ProjectListItem } from "@/lib/supabase/types";
import type { ProjectStatus } from "@/types/business-project";

/** Status filter options shown in the project list controls. */
export type ProjectStatusFilter = "all" | "draft" | "published";

/** Sort options for the project list. */
export type ProjectSortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";

export type ProjectListQuery = {
  search: string;
  status: ProjectStatusFilter;
  sort: ProjectSortOption;
};

export const DEFAULT_PROJECT_LIST_QUERY: ProjectListQuery = {
  search: "",
  status: "all",
  sort: "updated_desc",
};

export const PROJECT_STATUS_FILTER_OPTIONS: {
  value: ProjectStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

export const PROJECT_SORT_OPTIONS: {
  value: ProjectSortOption;
  label: string;
}[] = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Oldest updated" },
  { value: "created_desc", label: "Newest created" },
  { value: "created_asc", label: "Oldest created" },
  { value: "name_asc", label: "Project name A–Z" },
  { value: "name_desc", label: "Project name Z–A" },
];

const PREFS_STORAGE_KEY = "atlas:projectListPrefs";

type StoredProjectListPrefs = {
  status: ProjectStatusFilter;
  sort: ProjectSortOption;
};

function isStatusFilter(value: unknown): value is ProjectStatusFilter {
  return value === "all" || value === "draft" || value === "published";
}

function isSortOption(value: unknown): value is ProjectSortOption {
  return (
    value === "updated_desc" ||
    value === "updated_asc" ||
    value === "created_desc" ||
    value === "created_asc" ||
    value === "name_asc" ||
    value === "name_desc"
  );
}

/** Safe localStorage read for status + sort preferences (never search). */
export function readProjectListPrefs(): Pick<
  ProjectListQuery,
  "status" | "sort"
> {
  if (typeof window === "undefined") {
    return {
      status: DEFAULT_PROJECT_LIST_QUERY.status,
      sort: DEFAULT_PROJECT_LIST_QUERY.sort,
    };
  }

  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) {
      return {
        status: DEFAULT_PROJECT_LIST_QUERY.status,
        sort: DEFAULT_PROJECT_LIST_QUERY.sort,
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredProjectListPrefs>;
    return {
      status: isStatusFilter(parsed.status)
        ? parsed.status
        : DEFAULT_PROJECT_LIST_QUERY.status,
      sort: isSortOption(parsed.sort)
        ? parsed.sort
        : DEFAULT_PROJECT_LIST_QUERY.sort,
    };
  } catch {
    return {
      status: DEFAULT_PROJECT_LIST_QUERY.status,
      sort: DEFAULT_PROJECT_LIST_QUERY.sort,
    };
  }
}

/** Persist status + sort only (search is session-only). */
export function writeProjectListPrefs(
  prefs: Pick<ProjectListQuery, "status" | "sort">,
): void {
  if (typeof window === "undefined") return;

  try {
    const payload: StoredProjectListPrefs = {
      status: prefs.status,
      sort: prefs.sort,
    };
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function matchesSearch(project: ProjectListItem, query: string): boolean {
  if (!query) return true;

  const haystack = [
    project.name,
    project.businessName,
    project.businessType,
    project.description,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesStatus(
  status: ProjectStatus,
  filter: ProjectStatusFilter,
): boolean {
  if (filter === "all") return true;
  return status === filter;
}

function compareProjects(
  a: ProjectListItem,
  b: ProjectListItem,
  sort: ProjectSortOption,
): number {
  switch (sort) {
    case "updated_desc":
      return b.updatedAt.localeCompare(a.updatedAt);
    case "updated_asc":
      return a.updatedAt.localeCompare(b.updatedAt);
    case "created_desc":
      return b.createdAt.localeCompare(a.createdAt);
    case "created_asc":
      return a.createdAt.localeCompare(b.createdAt);
    case "name_asc":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "name_desc":
      return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
    default:
      return 0;
  }
}

/**
 * Filter + sort projects in memory (no network).
 * Search is trimmed and case-insensitive.
 */
export function applyProjectListQuery(
  projects: ProjectListItem[],
  query: ProjectListQuery,
): ProjectListItem[] {
  const search = query.search.trim().toLowerCase();

  return projects
    .filter(
      (project) =>
        matchesSearch(project, search) &&
        matchesStatus(project.status, query.status),
    )
    .slice()
    .sort((a, b) => compareProjects(a, b, query.sort));
}

/** Whether any control differs from the empty/default search+filter baseline. */
export function isProjectListQueryActive(query: ProjectListQuery): boolean {
  return (
    query.search.trim().length > 0 ||
    query.status !== "all" ||
    query.sort !== DEFAULT_PROJECT_LIST_QUERY.sort
  );
}

/** Results count copy: "1 project" | "5 projects" | "3 of 12 projects". */
export function formatProjectResultsCount(
  visibleCount: number,
  totalCount: number,
  query: ProjectListQuery,
): string {
  const controlsNarrow =
    query.search.trim().length > 0 || query.status !== "all";

  if (controlsNarrow && visibleCount !== totalCount) {
    return `${visibleCount} of ${totalCount} project${totalCount === 1 ? "" : "s"}`;
  }

  return `${visibleCount} project${visibleCount === 1 ? "" : "s"}`;
}
