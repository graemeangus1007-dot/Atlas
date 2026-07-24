"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyProjectListQuery,
  DEFAULT_PROJECT_LIST_QUERY,
  formatProjectResultsCount,
  isProjectListQueryActive,
  readProjectListPrefs,
  writeProjectListPrefs,
  type ProjectListQuery,
  type ProjectSortOption,
  type ProjectStatusFilter,
} from "@/lib/project-list-query";
import type { ProjectListItem } from "@/lib/supabase/types";

/**
 * Client-side search / filter / sort for an already-loaded project list.
 * Status + sort persist in localStorage; search does not.
 */
export function useProjectListQuery(projects: ProjectListItem[]) {
  const [query, setQuery] = useState<ProjectListQuery>(DEFAULT_PROJECT_LIST_QUERY);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    const prefs = readProjectListPrefs();
    setQuery((current) => ({
      ...current,
      status: prefs.status,
      sort: prefs.sort,
    }));
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    writeProjectListPrefs({ status: query.status, sort: query.sort });
  }, [query.status, query.sort, prefsReady]);

  const setSearch = useCallback((search: string) => {
    setQuery((current) => ({ ...current, search }));
  }, []);

  const setStatus = useCallback((status: ProjectStatusFilter) => {
    setQuery((current) => ({ ...current, status }));
  }, []);

  const setSort = useCallback((sort: ProjectSortOption) => {
    setQuery((current) => ({ ...current, sort }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery((current) => ({
      ...current,
      search: "",
      status: "all",
      sort: DEFAULT_PROJECT_LIST_QUERY.sort,
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setQuery((current) => ({ ...current, search: "" }));
  }, []);

  const visibleProjects = useMemo(
    () => applyProjectListQuery(projects, query),
    [projects, query],
  );

  const controlsActive = isProjectListQueryActive(query);
  const resultsLabel = formatProjectResultsCount(
    visibleProjects.length,
    projects.length,
    query,
  );

  return {
    query,
    visibleProjects,
    resultsLabel,
    controlsActive,
    setSearch,
    setStatus,
    setSort,
    clearFilters,
    clearSearch,
  };
}
