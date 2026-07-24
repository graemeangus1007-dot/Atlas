"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  createProject as createProjectRow,
  deleteProject as deleteProjectRow,
  getProjectById,
  getProjects,
  rowToBusinessProject,
  toProjectListItem,
  updateProject as updateProjectRow,
  type ProjectListItem,
} from "@/lib/supabase";
import type { BusinessProject } from "@/types/business-project";

const ACTIVE_PROJECT_KEY = "atlas:activeProjectId";
const AUTOSAVE_DELAY_MS = 900;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type ProjectContextValue = {
  project: BusinessProject;
  projectId: string | null;
  projects: ProjectListItem[];
  isLoading: boolean;
  listError: string | null;
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  setProject: (project: BusinessProject) => void;
  updateProject: (partial: Partial<BusinessProject>) => void;
  resetProject: () => void;
  /** Reload the project list via getProjects(). */
  refreshProjects: () => Promise<void>;
  createProject: (
    name: string,
    data?: BusinessProject,
  ) => Promise<ProjectListItem>;
  /** Load a project with getProjectById() into Context and store the active id. */
  openProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  /** Persist current in-memory project immediately (also used by manual Save). */
  saveNow: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

type ProjectProviderProps = {
  children: ReactNode;
  initialProject?: BusinessProject;
};

function readStoredActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    // ignore storage failures
  }
}

/**
 * Active BusinessProject store with Supabase multi-project persistence + autosave.
 */
export function ProjectProvider({
  children,
  initialProject = MOCK_BUSINESS_PROJECT,
}: ProjectProviderProps) {
  const { user, isConfigured, isLoading: authLoading } = useAuth();
  const [project, setProjectState] = useState<BusinessProject>(initialProject);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const projectRef = useRef(project);
  const projectIdRef = useRef(projectId);
  const skipAutosaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const refreshProjects = useCallback(async () => {
    if (!user || !isConfigured) {
      setProjects([]);
      setListError(null);
      return;
    }

    setListError(null);
    const result = await getProjects();
    if (!result.ok) {
      setListError(result.error);
      throw new Error(result.error);
    }
    setProjects(result.data);
  }, [user, isConfigured]);

  const openProject = useCallback(async (id: string) => {
    skipAutosaveRef.current = true;
    const result = await getProjectById(id);
    if (!result.ok) throw new Error(result.error);
    setProjectState(rowToBusinessProject(result.data));
    setProjectId(result.data.id);
    writeStoredActiveId(result.data.id);
    setSaveStatus("idle");
    setSaveError(null);
    window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
  }, []);

  // Load the user's projects when auth is ready.
  useEffect(() => {
    if (authLoading) return;

    if (!user || !isConfigured) {
      setProjects([]);
      setListError(null);
      setProjectId(null);
      writeStoredActiveId(null);
      setProjectState(initialProject);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      setListError(null);
      try {
        const listResult = await getProjects();
        if (cancelled) return;
        if (!listResult.ok) {
          setProjects([]);
          setListError(listResult.error);
          return;
        }
        setProjects(listResult.data);

        const preferred = readStoredActiveId();
        const targetId =
          (preferred && listResult.data.some((item) => item.id === preferred)
            ? preferred
            : null) ?? listResult.data[0]?.id ?? null;

        if (targetId) {
          const projectResult = await getProjectById(targetId);
          if (cancelled) return;
          if (!projectResult.ok) {
            setProjectId(null);
            writeStoredActiveId(null);
            setProjectState(initialProject);
            return;
          }
          skipAutosaveRef.current = true;
          setProjectState(rowToBusinessProject(projectResult.data));
          setProjectId(projectResult.data.id);
          writeStoredActiveId(projectResult.data.id);
          window.setTimeout(() => {
            skipAutosaveRef.current = false;
          }, 0);
        } else {
          setProjectId(null);
          writeStoredActiveId(null);
          setProjectState(initialProject);
        }
      } catch (err) {
        if (!cancelled) {
          setProjects([]);
          setListError(
            err instanceof Error
              ? err.message
              : "Could not load your projects. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [user, isConfigured, authLoading, initialProject]);

  const persistProject = useCallback(async () => {
    const id = projectIdRef.current;
    if (!id || !user || !isConfigured) return;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const result = await updateProjectRow({
        id,
        project: projectRef.current,
        name: projectRef.current.businessName || "Untitled project",
        status: projectRef.current.status,
      });
      if (!result.ok) {
        setSaveStatus("error");
        setSaveError(result.error);
        return;
      }
      const row = result.data;
      setProjects((current) =>
        current
          .map((item) =>
            item.id === row.id ? toProjectListItem(row) : item,
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
      setSaveStatus("saved");
      if (savedResetTimerRef.current) {
        window.clearTimeout(savedResetTimerRef.current);
      }
      savedResetTimerRef.current = window.setTimeout(() => {
        setSaveStatus((status) => (status === "saved" ? "idle" : status));
      }, 1800);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
  }, [user, isConfigured]);

  // Debounced autosave whenever the active project changes.
  useEffect(() => {
    if (!projectId || !user || !isConfigured) return;
    if (skipAutosaveRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistProject();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [project, projectId, user, isConfigured, persistProject]);

  const setProject = useCallback((next: BusinessProject) => {
    setProjectState(next);
  }, []);

  const updateProject = useCallback((partial: Partial<BusinessProject>) => {
    setProjectState((current) => ({ ...current, ...partial }));
  }, []);

  const resetProject = useCallback(() => {
    skipAutosaveRef.current = true;
    setProjectState(MOCK_BUSINESS_PROJECT);
    setProjectId(null);
    writeStoredActiveId(null);
    setSaveStatus("idle");
    window.setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
  }, []);

  const createProject = useCallback(
    async (name: string, data: BusinessProject = MOCK_BUSINESS_PROJECT) => {
      if (!user) {
        throw new Error("Please sign in to save your project, then try again.");
      }

      const seeded: BusinessProject = {
        ...data,
        businessName: name.trim() || data.businessName || "Untitled project",
      };

      const result = await createProjectRow({
        name: seeded.businessName,
        project: seeded,
      });
      if (!result.ok) throw new Error(result.error);

      const row = result.data;
      const item = toProjectListItem(row);

      skipAutosaveRef.current = true;
      setListError(null);
      setProjects((current) => [item, ...current.filter((p) => p.id !== item.id)]);
      setProjectState(rowToBusinessProject(row));
      setProjectId(row.id);
      writeStoredActiveId(row.id);
      setSaveStatus("saved");
      window.setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);

      return item;
    },
    [user],
  );

  const renameProject = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Project name cannot be empty.");

    const result = await updateProjectRow({
      id,
      name: trimmed,
      businessName: trimmed,
    });
    if (!result.ok) throw new Error(result.error);

    const row = result.data;
    setProjects((current) =>
      current.map((item) =>
        item.id === id ? toProjectListItem(row) : item,
      ),
    );

    if (projectIdRef.current === id) {
      skipAutosaveRef.current = true;
      setProjectState((current) => ({
        ...current,
        businessName: trimmed,
      }));
      window.setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 0);
    }
  }, []);

  const deleteProject = useCallback(
    async (id: string) => {
      const result = await deleteProjectRow(id);
      if (!result.ok) throw new Error(result.error);

      const remaining = projects.filter((item) => item.id !== id);
      setProjects(remaining);

      if (projectIdRef.current === id) {
        if (remaining[0]) {
          await openProject(remaining[0].id);
        } else {
          resetProject();
        }
      }
    },
    [projects, openProject, resetProject],
  );

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persistProject();
  }, [persistProject]);

  const value = useMemo(
    () => ({
      project,
      projectId,
      projects,
      isLoading,
      listError,
      isSaving: saveStatus === "saving",
      saveStatus,
      saveError,
      setProject,
      updateProject,
      resetProject,
      refreshProjects,
      createProject,
      openProject,
      renameProject,
      deleteProject,
      saveNow,
    }),
    [
      project,
      projectId,
      projects,
      isLoading,
      listError,
      saveStatus,
      saveError,
      setProject,
      updateProject,
      resetProject,
      refreshProjects,
      createProject,
      openProject,
      renameProject,
      deleteProject,
      saveNow,
    ],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
