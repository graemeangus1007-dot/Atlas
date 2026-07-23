"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { formatProjectStatus } from "@/lib/project";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Real user project list — create, open, rename, delete.
 */
export default function ProjectList() {
  const router = useRouter();
  const {
    projects,
    activeProjectId,
    isLoading,
    createProject,
    openProject,
    renameProject,
    deleteProject,
  } = useProjects();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      await createProject("Untitled project", {
        ...MOCK_BUSINESS_PROJECT,
        businessName: "Untitled project",
        status: "draft",
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await openProject(id);
      router.push("/editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open project.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await renameProject(id, renameValue);
      setRenamingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename project.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete “${name}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setBusyId(id);
    try {
      await deleteProject(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-labelledby="projects-heading"
      className="rounded-2xl border border-border bg-surface/60 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="projects-heading"
            className="font-[family-name:var(--font-atlas-display)] text-lg font-semibold tracking-tight text-foreground"
          >
            Your Projects
          </h2>
          <p className="mt-1 text-sm text-muted">
            Create and manage multiple websites under your account.
          </p>
        </div>
        <Button
          type="button"
          className="px-4 py-2 text-sm"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create Project"}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted">
            No projects yet. Create one to start building.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {projects.map((item) => {
            const isActive = item.id === activeProjectId;
            const isBusy = busyId === item.id;
            const isRenaming = renamingId === item.id;

            return (
              <li
                key={item.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isActive
                    ? "border-accent/50 bg-accent-soft/40"
                    : "border-border bg-background/40"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {isRenaming ? (
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        aria-label="Project name"
                      />
                    ) : (
                      <p className="truncate font-medium text-foreground">
                        {item.name}
                        {isActive ? (
                          <span className="ml-2 text-xs font-normal text-accent">
                            Active
                          </span>
                        ) : null}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {formatProjectStatus(item.status)}
                      {item.businessType ? ` · ${item.businessType}` : ""}
                      {" · Updated "}
                      {formatUpdatedAt(item.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isRenaming ? (
                      <>
                        <Button
                          type="button"
                          className="px-3 py-1.5 text-xs"
                          disabled={isBusy}
                          onClick={() => void handleRename(item.id)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          className="px-3 py-1.5 text-xs"
                          disabled={isBusy}
                          onClick={() => void handleOpen(item.id)}
                        >
                          Open
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-3 py-1.5 text-xs"
                          disabled={isBusy}
                          onClick={() => {
                            setRenamingId(item.id);
                            setRenameValue(item.name);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-3 py-1.5 text-xs"
                          disabled={isBusy}
                          onClick={() => void handleDelete(item.id, item.name)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
