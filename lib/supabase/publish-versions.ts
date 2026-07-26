import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/supabase/errors";
import {
  PUBLISH_VERSION_PAGE_SIZE as PAGE_SIZE,
  type CreatePublishVersionInput,
  type PublishVersion,
  type PublishVersionInsert,
  type PublishVersionPage,
  type PublishVersionResult,
  type PublishVersionRow,
  type PublishVersionSummary,
  type PublishVersionSummaryRow,
} from "@/lib/publishing/publish-version-types";
import type { PublishSnapshot } from "@/types/publishing";

const SUMMARY_COLUMNS =
  "id, project_id, owner_id, version_number, artifact_fingerprint, deployment_provider, deployment_id, preview_url, deployment_status, created_at";

function getVersionErrorMessage(error: unknown): string {
  const message = getAuthErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("you must be signed in") ||
    lower.includes("not authenticated") ||
    lower.includes("jwt") ||
    lower.includes("session")
  ) {
    return "Please sign in to save publish history, then try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("permission denied") ||
    lower.includes("42501")
  ) {
    return "You don't have permission to save publish history for this project.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch failed")
  ) {
    return "Could not save publish history. Check your connection and try again.";
  }
  if (lower.includes("immutable")) {
    return "Publish versions cannot be modified once saved.";
  }

  return message || "Could not save publish history. Please try again.";
}

function fail<T>(error: unknown): PublishVersionResult<T> {
  return { ok: false, error: getVersionErrorMessage(error) };
}

function ok<T>(data: T): PublishVersionResult<T> {
  return { ok: true, data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strip publish recursion and reject accidental HTML/credential fields. */
export function sanitizeProjectSnapshot(
  snapshot: PublishSnapshot,
): PublishSnapshot {
  const clone = structuredClone(snapshot) as PublishSnapshot &
    Record<string, unknown>;
  clone.publish = null;

  // Never persist generated site payloads or secret-looking keys.
  delete clone.html;
  delete clone.indexHtml;
  delete clone.artifact;
  delete clone.files;
  for (const key of Object.keys(clone)) {
    if (/token|secret|password|credential|vercel_token/i.test(key)) {
      delete clone[key];
    }
  }

  return clone;
}

export function rowToPublishVersionSummary(
  row: PublishVersionSummaryRow,
): PublishVersionSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    versionNumber: row.version_number,
    artifactFingerprint: row.artifact_fingerprint,
    deploymentProvider: row.deployment_provider,
    deploymentId: row.deployment_id,
    previewUrl: row.preview_url,
    deploymentStatus: row.deployment_status,
    createdAt: row.created_at,
  };
}

export function rowToPublishVersion(row: PublishVersionRow): PublishVersion {
  return {
    ...rowToPublishVersionSummary(row),
    projectSnapshot: row.project_snapshot,
  };
}

export type ListVersionSummariesOptions = {
  limit?: number;
  offset?: number;
};

/**
 * Injectable gateway for tests / alternate clients.
 * Production uses the browser Supabase client + RLS.
 */
export type PublishVersionsGateway = {
  getUserId(): Promise<string | null>;
  assertProjectOwned(projectId: string, userId: string): Promise<boolean>;
  getMaxVersionNumber(projectId: string): Promise<number>;
  insertVersion(row: PublishVersionInsert): Promise<PublishVersionRow>;
  /** Slim list (no project_snapshot) for history UI. */
  listVersionSummaries(
    projectId: string,
    options?: ListVersionSummariesOptions,
  ): Promise<PublishVersionSummaryRow[]>;
  /** Full row including snapshot — used only when restoring. */
  getVersion(versionId: string): Promise<PublishVersionRow | null>;
};

export function createSupabasePublishVersionsGateway(): PublishVersionsGateway {
  return {
    async getUserId() {
      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user?.id ?? null;
    },

    async assertProjectOwned(projectId, userId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data?.id);
    },

    async getMaxVersionNumber(projectId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("publish_versions")
        .select("version_number")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const n = data?.version_number;
      return typeof n === "number" && Number.isFinite(n) ? n : 0;
    },

    async insertVersion(row) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("publish_versions")
        .insert(row)
        .select("*")
        .single();
      if (error) throw error;
      if (!data || !isRecord(data)) {
        throw new Error("Publish version insert returned no row.");
      }
      return data as unknown as PublishVersionRow;
    },

    async listVersionSummaries(projectId, options = {}) {
      const limit = options.limit ?? PAGE_SIZE;
      const offset = options.offset ?? 0;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("publish_versions")
        .select(SUMMARY_COLUMNS)
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []) as unknown as PublishVersionSummaryRow[];
    },

    async getVersion(versionId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("publish_versions")
        .select("*")
        .eq("id", versionId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PublishVersionRow | null) ?? null;
    },
  };
}

let defaultGateway: PublishVersionsGateway | null = null;

function gatewayOrDefault(
  gateway?: PublishVersionsGateway,
): PublishVersionsGateway {
  if (gateway) return gateway;
  if (!defaultGateway) {
    defaultGateway = createSupabasePublishVersionsGateway();
  }
  return defaultGateway;
}

/**
 * Create an immutable publish version for a project the user owns.
 */
export async function createPublishVersion(
  input: CreatePublishVersionInput,
  gateway?: PublishVersionsGateway,
): Promise<PublishVersionResult<PublishVersion>> {
  const g = gatewayOrDefault(gateway);

  try {
    const userId = await g.getUserId();
    if (!userId) {
      return fail(new Error("You must be signed in."));
    }

    const owned = await g.assertProjectOwned(input.projectId, userId);
    if (!owned) {
      return fail(
        new Error(
          "You don't have permission to save publish history for this project.",
        ),
      );
    }

    if (!input.artifactFingerprint?.trim()) {
      return fail(new Error("Missing artifact fingerprint for publish version."));
    }
    if (!input.deploymentId?.trim()) {
      return fail(new Error("Missing deployment id for publish version."));
    }
    if (!input.previewUrl?.trim()) {
      return fail(new Error("Missing preview URL for publish version."));
    }
    if (input.deploymentStatus !== "ready") {
      return fail(
        new Error("Publish versions are only created for ready deployments."),
      );
    }

    const max = await g.getMaxVersionNumber(input.projectId);
    const versionNumber = max + 1;
    const snapshot = sanitizeProjectSnapshot(input.projectSnapshot);

    const row = await g.insertVersion({
      project_id: input.projectId,
      owner_id: userId,
      version_number: versionNumber,
      artifact_fingerprint: input.artifactFingerprint,
      deployment_provider: input.deploymentProvider,
      deployment_id: input.deploymentId,
      preview_url: input.previewUrl,
      deployment_status: input.deploymentStatus,
      project_snapshot: snapshot,
    });

    return ok(rowToPublishVersion(row));
  } catch (error) {
    return fail(error);
  }
}

/**
 * Paginated version history (newest first), without snapshots.
 * Snapshots are loaded only via {@link getPublishVersion} on restore.
 */
export async function listPublishVersionPage(
  projectId: string,
  options?: { limit?: number; offset?: number },
  gateway?: PublishVersionsGateway,
): Promise<PublishVersionResult<PublishVersionPage>> {
  const g = gatewayOrDefault(gateway);
  const limit = options?.limit ?? PAGE_SIZE;
  const offset = options?.offset ?? 0;

  try {
    const userId = await g.getUserId();
    if (!userId) {
      return fail(new Error("You must be signed in."));
    }
    const owned = await g.assertProjectOwned(projectId, userId);
    if (!owned) {
      return fail(
        new Error("You don't have permission to view publish history."),
      );
    }

    // Fetch limit+1 to detect a following page without a separate count query.
    const rows = await g.listVersionSummaries(projectId, {
      limit: limit + 1,
      offset,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const latestVersionNumber = await g.getMaxVersionNumber(projectId);

    return ok({
      items: pageRows.map(rowToPublishVersionSummary),
      nextOffset: hasMore ? offset + limit : null,
      latestVersionNumber: latestVersionNumber > 0 ? latestVersionNumber : null,
    });
  } catch (error) {
    return fail(error);
  }
}

/** @deprecated Prefer {@link listPublishVersionPage}. */
export async function listPublishVersions(
  projectId: string,
  gateway?: PublishVersionsGateway,
): Promise<PublishVersionResult<PublishVersionSummary[]>> {
  const page = await listPublishVersionPage(
    projectId,
    { limit: 1000, offset: 0 },
    gateway,
  );
  if (!page.ok) return page;
  return ok(page.data.items);
}

/** Fetch a full version (with snapshot) by id — for restore only. */
export async function getPublishVersion(
  versionId: string,
  gateway?: PublishVersionsGateway,
): Promise<PublishVersionResult<PublishVersion | null>> {
  const g = gatewayOrDefault(gateway);
  try {
    const userId = await g.getUserId();
    if (!userId) {
      return fail(new Error("You must be signed in."));
    }
    const row = await g.getVersion(versionId);
    if (!row) return ok(null);
    if (row.owner_id !== userId) {
      return fail(
        new Error("You don't have permission to view this publish version."),
      );
    }
    return ok(rowToPublishVersion(row));
  } catch (error) {
    return fail(error);
  }
}

/**
 * Latest publish version summary (no snapshot), or null.
 * Used when a fingerprint-deduped publish should still show Version: vN.
 */
export async function getLatestPublishVersion(
  projectId: string,
  gateway?: PublishVersionsGateway,
): Promise<PublishVersionResult<PublishVersionSummary | null>> {
  const page = await listPublishVersionPage(
    projectId,
    { limit: 1, offset: 0 },
    gateway,
  );
  if (!page.ok) return page;
  return ok(page.data.items[0] ?? null);
}

/** In-memory gateway for unit tests (simulates per-user ownership). */
export function createMemoryPublishVersionsGateway(options?: {
  userId?: string | null;
  ownedProjectIds?: string[];
}): PublishVersionsGateway & { rows: PublishVersionRow[] } {
  const rows: PublishVersionRow[] = [];
  let userId: string | null =
    options && "userId" in options ? (options.userId ?? null) : "user-owner";
  const owned = new Set(options?.ownedProjectIds ?? ["project-1"]);

  const gateway: PublishVersionsGateway & { rows: PublishVersionRow[] } = {
    rows,
    async getUserId() {
      return userId;
    },
    async assertProjectOwned(projectId, uid) {
      return uid === userId && owned.has(projectId);
    },
    async getMaxVersionNumber(projectId) {
      return rows
        .filter((r) => r.project_id === projectId)
        .reduce((max, r) => Math.max(max, r.version_number), 0);
    },
    async insertVersion(row) {
      if (!userId) throw new Error("not authenticated");
      if (row.owner_id !== userId) {
        throw new Error("row-level security policy violation");
      }
      if (!owned.has(row.project_id)) {
        throw new Error("row-level security policy violation");
      }
      const versionNumber =
        row.version_number && row.version_number > 0
          ? row.version_number
          : (await gateway.getMaxVersionNumber(row.project_id)) + 1;
      if (
        rows.some(
          (r) =>
            r.project_id === row.project_id &&
            r.version_number === versionNumber,
        )
      ) {
        throw new Error("duplicate key value violates unique constraint");
      }
      const inserted: PublishVersionRow = {
        id: row.id ?? `ver_${rows.length + 1}`,
        project_id: row.project_id,
        owner_id: row.owner_id,
        version_number: versionNumber,
        artifact_fingerprint: row.artifact_fingerprint,
        deployment_provider: row.deployment_provider,
        deployment_id: row.deployment_id,
        preview_url: row.preview_url,
        deployment_status: String(row.deployment_status),
        project_snapshot: row.project_snapshot,
        created_at: row.created_at ?? new Date().toISOString(),
      };
      rows.push(inserted);
      return inserted;
    },
    async listVersionSummaries(projectId, options = {}) {
      if (!userId) throw new Error("not authenticated");
      if (!owned.has(projectId)) {
        throw new Error("row-level security policy violation");
      }
      const limit = options.limit ?? PAGE_SIZE;
      const offset = options.offset ?? 0;
      const sorted = rows
        .filter((r) => r.project_id === projectId && r.owner_id === userId)
        .sort((a, b) => b.version_number - a.version_number);
      return sorted.slice(offset, offset + limit).map((row) => {
        const { project_snapshot: _snap, ...summary } = row;
        return summary;
      });
    },
    async getVersion(versionId) {
      if (!userId) throw new Error("not authenticated");
      const row = rows.find((r) => r.id === versionId) ?? null;
      if (row && row.owner_id !== userId) {
        throw new Error("row-level security policy violation");
      }
      return row;
    },
  };

  return gateway;
}
