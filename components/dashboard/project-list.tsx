"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { formatProjectStatus } from "@/lib/project";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

type BusyAction = "open" | "duplicate" | "delete" | "rename";

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function confirmDelete(projectName: string): boolean {
  return window.confirm(
    [
      `Delete “${projectName}”?`,
      "",
      "This permanently removes the project from your account.",
      "This action cannot be undone.",
      "",
      "Click OK to delete, or Cancel to keep the project.",
    ].join("\n"),
  );
}

/**
 * Real Supabase project list — open, duplicate, delete (also create/rename).
 * Used on /dashboard and /projects.
 */
export default function ProjectList() {
  const router = useRouter();
  const {
    projects,
    activeProjectId,
    isLoading,
    error,
    retry,
    refreshProjects,
    createProject,
    openProject,
    renameProject,
    duplicateProject,
    deleteProject,
  } = useProjects();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  function showSuccess(message: string) {
    setSuccessMessage(message);
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  }

  async function handleCreate() {
    setActionError(null);
    setCreating(true);
    try {
      await createProject("Untitled project", {
        ...MOCK_BUSINESS_PROJECT,
        businessName: "Untitled project",
        status: "draft",
      });
      router.push("/onboarding");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not create project.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(id: string) {
    setActionError(null);
    setBusyId(id);
    setBusyAction("open");
    try {
      await openProject(id);
      router.push("/editor");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not open project.",
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleDuplicate(id: string, name: string) {
    setActionError(null);
    setBusyId(id);
    setBusyAction("duplicate");
    try {
      const copy = await duplicateProject(id);
      await refreshProjects().catch(() => {
        // List already includes the optimistic copy from Context.
      });
      showSuccess(`Duplicated “${name}” as “${copy.name}”.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not duplicate project.",
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleRename(id: string) {
    setActionError(null);
    setBusyId(id);
    setBusyAction("rename");
    try {
      await renameProject(id, renameValue);
      setRenamingId(null);
      showSuccess("Project renamed.");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not rename project.",
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirmDelete(name)) return;

    setActionError(null);
    setBusyId(id);
    setBusyAction("delete");
    try {
      await deleteProject(id);
      showSuccess(`Deleted “${name}”.`);
    } catch (err) {
      // Card stays in the list — Context only removes after success.
      setActionError(
        err instanceof Error ? err.message : "Could not delete project.",
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  const displayError = actionError || error;
  const anyBusy = busyId !== null || creating;

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
          disabled={creating || isLoading}
        >
          {creating ? "Creating…" : "Create Project"}
        </Button>
      </div>

      {successMessage ? (
        <div
          className="mt-4 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div
          className="mt-6 flex items-center gap-3 rounded-xl border border-border/80 bg-background/40 px-4 py-8 text-sm text-muted"
          role="status"
        >
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
            aria-hidden="true"
          />
          Loading your projects…
        </div>
      ) : error && projects.length === 0 ? (
        <div
          className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center"
          role="alert"
        >
          <p className="text-sm text-red-200">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 px-4 py-2 text-sm"
            onClick={() => void retry()}
          >
            Retry
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-sm text-muted">
            Create a project to start building your website.
          </p>
          <Button
            type="button"
            className="mt-4 px-4 py-2 text-sm"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create your first project"}
          </Button>
        </div>
      ) : (
        <>
          {displayError ? (
            <div
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
              role="alert"
            >
              <p className="text-sm text-red-200">{displayError}</p>
              {error && !actionError ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => void retry()}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}

          <ul className="mt-5 space-y-3">
            {projects.map((item) => {
              const isActive = item.id === activeProjectId;
              const isBusy = busyId === item.id;
              const isRenaming = renamingId === item.id;
              const openLabel =
                isBusy && busyAction === "open" ? "Opening…" : "Open Project";
              const duplicateLabel =
                isBusy && busyAction === "duplicate"
                  ? "Duplicating..."
                  : "Duplicate";
              const deleteLabel =
                isBusy && busyAction === "delete" ? "Deleting..." : "Delete";

              return (
                <li
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isActive
                      ? "border-accent/50 bg-accent-soft/40"
                      : "border-border bg-background/40"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      {isRenaming ? (
                        <input
                          value={renameValue}
                          onChange={(event) =>
                            setRenameValue(event.target.value)
                          }
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

                      <p className="truncate text-sm text-foreground/80">
                        {item.businessName || "Untitled business"}
                      </p>

                      <p className="text-xs text-muted">
                        {item.businessType ? `${item.businessType} · ` : ""}
                        {formatProjectStatus(item.status)}
                        {" · Updated "}
                        {formatUpdatedAt(item.updatedAt)}
                      </p>

                      {item.publishedUrl ? (
                        <a
                          href={item.publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block truncate text-xs text-accent hover:underline"
                        >
                          {item.publishedUrl}
                        </a>
                      ) : null}
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
                            {isBusy && busyAction === "rename"
                              ? "Saving…"
                              : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-3 py-1.5 text-xs"
                            disabled={isBusy}
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
                            disabled={anyBusy}
                            onClick={() => void handleOpen(item.id)}
                          >
                            {openLabel}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            disabled={anyBusy}
                            onClick={() =>
                              void handleDuplicate(item.id, item.name)
                            }
                          >
                            {duplicateLabel}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-3 py-1.5 text-xs"
                            disabled={anyBusy}
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
                            disabled={anyBusy}
                            onClick={() =>
                              void handleDelete(item.id, item.name)
                            }
                          >
                            {deleteLabel}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
