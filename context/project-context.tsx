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
  getProject,
  listProjects,
  renameProject as renameProjectRow,
  updateProjectRecord,
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
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  setProject: (project: BusinessProject) => void;
  updateProject: (partial: Partial<BusinessProject>) => void;
  resetProject: () => void;
  refreshProjects: () => Promise<void>;
  createProject: (
    name: string,
    data?: BusinessProject,
  ) => Promise<ProjectListItem>;
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
      return;
    }
    const items = await listProjects();
    setProjects(items);
  }, [user, isConfigured]);

  const openProject = useCallback(async (id: string) => {
    skipAutosaveRef.current = true;
    const row = await getProject(id);
    setProjectState(row.data);
    setProjectId(row.id);
    writeStoredActiveId(row.id);
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
      setProjectId(null);
      writeStoredActiveId(null);
      setProjectState(initialProject);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const items = await listProjects();
        if (cancelled) return;
        setProjects(items);

        const preferred = readStoredActiveId();
        const targetId =
          (preferred && items.some((item) => item.id === preferred)
            ? preferred
            : null) ?? items[0]?.id ?? null;

        if (targetId) {
          const row = await getProject(targetId);
          if (cancelled) return;
          skipAutosaveRef.current = true;
          setProjectState(row.data);
          setProjectId(row.id);
          writeStoredActiveId(row.id);
          window.setTimeout(() => {
            skipAutosaveRef.current = false;
          }, 0);
        } else {
          setProjectId(null);
          writeStoredActiveId(null);
          setProjectState(initialProject);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
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
      const row = await updateProjectRecord({
        id,
        data: projectRef.current,
        name: projectRef.current.businessName || "Untitled project",
        status: projectRef.current.status,
      });
      setProjects((current) =>
        current
          .map((item) =>
            item.id === row.id
              ? {
                  id: row.id,
                  name: row.name,
                  status: row.status,
                  businessType: row.data?.businessType || "",
                  updatedAt: row.updated_at,
                  createdAt: row.created_at,
                }
              : item,
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
      if (!user) throw new Error("You must be signed in to create a project.");

      const seeded: BusinessProject = {
        ...data,
        businessName: name.trim() || data.businessName || "Untitled project",
      };

      const row = await createProjectRow({
        userId: user.id,
        name: seeded.businessName,
        data: seeded,
      });

      const item: ProjectListItem = {
        id: row.id,
        name: row.name,
        status: row.status,
        businessType: row.data?.businessType || "",
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      };

      skipAutosaveRef.current = true;
      setProjects((current) => [item, ...current.filter((p) => p.id !== item.id)]);
      setProjectState(row.data);
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

    const row = await renameProjectRow(id, trimmed);
    setProjects((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, name: row.name, updatedAt: row.updated_at }
          : item,
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
      await deleteProjectRow(id);
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
