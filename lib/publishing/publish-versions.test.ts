import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MockDeploymentProvider } from "@/lib/deployment";
import { AtlasWebsitePublisher } from "@/lib/publishing/publisher";
import {
  recordPublishVersionAfterDeploy,
  shouldCreatePublishVersion,
} from "@/lib/publishing/record-publish-version";
import {
  createMemoryPublishVersionsGateway,
  createPublishVersion,
  getPublishVersion,
  listPublishVersions,
  sanitizeProjectSnapshot,
} from "@/lib/supabase/publish-versions";
import { toPublishRecord } from "@/types/publishing";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { DeploymentRecord } from "@/lib/deployment/types";

const PROJECT_ID = "project-1";

function readyDeployment(
  overrides: Partial<DeploymentRecord> = {},
): DeploymentRecord {
  return {
    id: "dep_1",
    status: "ready",
    slug: "olive-branch",
    previewUrl: "https://olive-branch.preview.atlas.site",
    artifactFingerprint: "fp1",
    provider: "mock-local",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    readyAt: "2026-07-26T00:00:00.000Z",
    error: null,
    reused: false,
    ...overrides,
  };
}

describe("publish version history foundation", () => {
  it("creates the first version as v1 after a ready deployment", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const deployment = new MockDeploymentProvider({ stepDelayMs: 0 });
    const publisher = new AtlasWebsitePublisher(deployment);
    const result = await publisher.publish(
      { ...MOCK_BUSINESS_PROJECT, businessName: "Olive Branch Cafe" },
      undefined,
      { deployment, projectId: PROJECT_ID },
    );

    const outcome = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result,
      gateway,
    });

    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") return;
    expect(outcome.version.versionNumber).toBe(1);
    expect(outcome.version.projectId).toBe(PROJECT_ID);
    expect(outcome.version.artifactFingerprint).toBe(
      result.deployment.artifactFingerprint,
    );
    expect(outcome.version.deploymentId).toBe(result.deployment.id);
    expect(outcome.version.previewUrl).toBe(result.deployment.previewUrl);
    expect(outcome.version.deploymentStatus).toBe("ready");
    expect(outcome.version.projectSnapshot.publish).toBeNull();
    expect(JSON.stringify(outcome.version)).not.toContain("<!DOCTYPE html>");
  });

  it("increments version numbers per project", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });

    const first = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp-a",
        deploymentProvider: "mock-local",
        deploymentId: "dep_a",
        previewUrl: "https://a.example",
        deploymentStatus: "ready",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      gateway,
    );
    const second = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp-b",
        deploymentProvider: "mock-local",
        deploymentId: "dep_b",
        previewUrl: "https://b.example",
        deploymentStatus: "ready",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      gateway,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.versionNumber).toBe(1);
    expect(second.data.versionNumber).toBe(2);

    const listed = await listPublishVersions(PROJECT_ID, gateway);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((v) => v.versionNumber)).toEqual([2, 1]);
  });

  it("first publish displays v1; deduplicated publish still displays v1", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const deployment = new MockDeploymentProvider({ stepDelayMs: 0 });
    const publisher = new AtlasWebsitePublisher(deployment);
    const project = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Olive Branch Cafe",
    };

    const first = await publisher.publish(project, undefined, {
      deployment,
      projectId: PROJECT_ID,
    });
    const created = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: first,
      gateway,
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    expect(created.version.versionNumber).toBe(1);

    // Preview URL lands in SEO output on the next build → new artifact + v2.
    const published = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(first),
    };
    const second = await publisher.publish(published, undefined, {
      deployment,
      projectId: PROJECT_ID,
    });
    expect(second.deployment.reused).toBe(false);
    const createdV2 = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: second,
      gateway,
    });
    expect(createdV2.status).toBe("created");
    if (createdV2.status !== "created") return;
    expect(createdV2.version.versionNumber).toBe(2);

    // Identical SEO URL + content → reuse; still display v2.
    const publishedAgain = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(second),
    };
    const third = await publisher.publish(publishedAgain, undefined, {
      deployment,
      projectId: PROJECT_ID,
    });
    expect(third.deployment.reused).toBe(true);
    expect(shouldCreatePublishVersion(third.deployment)).toBe(false);

    const existing = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: third,
      gateway,
    });
    expect(existing.status).toBe("existing");
    if (existing.status !== "existing") return;
    expect(existing.version.versionNumber).toBe(2);
    expect(existing.version.id).toBe(createdV2.version.id);
    expect(gateway.rows).toHaveLength(2);
  });

  it("legacy reused deployment with no history does not show a fake version", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const reused = readyDeployment({ reused: true });
    const result = {
      slug: "olive-branch",
      url: reused.previewUrl,
      publishedAt: reused.readyAt!,
      snapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      artifact: {
        version: 1 as const,
        slug: "olive-branch",
        templateId: "modern" as const,
        fingerprint: reused.artifactFingerprint,
        files: [],
        assets: [],
      },
      deployment: reused,
    };

    const outcome = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result,
      gateway,
    });
    expect(outcome).toEqual({
      status: "skipped",
      reason: "reused_deployment",
    });
    expect(gateway.rows).toHaveLength(0);
  });

  it("creates a new version on Force Redeploy even with identical content", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const deployment = new MockDeploymentProvider({ stepDelayMs: 0 });
    const publisher = new AtlasWebsitePublisher(deployment);
    const project = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Olive Branch Cafe",
    };

    const first = await publisher.publish(project, undefined, {
      deployment,
      projectId: PROJECT_ID,
    });
    await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: first,
      gateway,
    });

    // Stabilize SEO absolute URLs (preview host) before force-redeploy compare.
    const published = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(first),
    };
    const second = await publisher.publish(published, undefined, {
      deployment,
      projectId: PROJECT_ID,
    });
    await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: second,
      gateway,
    });

    const publishedAgain = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(second),
    };
    const forced = await publisher.publish(publishedAgain, undefined, {
      deployment,
      projectId: PROJECT_ID,
      force: true,
    });
    expect(forced.deployment.reused).toBeFalsy();
    expect(forced.deployment.artifactFingerprint).toBe(
      second.deployment.artifactFingerprint,
    );

    const outcome = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result: forced,
      gateway,
    });
    expect(outcome.status).toBe("created");
    if (outcome.status !== "created") return;
    // Force Redeploy displays v3 (v1 first publish, v2 after preview URL in SEO).
    expect(outcome.version.versionNumber).toBe(3);
    expect(gateway.rows).toHaveLength(3);
  });

  it("does not create a version when deployment fails", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const deployment = new MockDeploymentProvider({
      stepDelayMs: 0,
      failAt: "uploading",
    });
    const publisher = new AtlasWebsitePublisher(deployment);

    await expect(
      publisher.publish(
        { ...MOCK_BUSINESS_PROJECT, businessName: "Olive Branch Cafe" },
        undefined,
        { deployment, projectId: PROJECT_ID },
      ),
    ).rejects.toThrow();

    expect(gateway.rows).toHaveLength(0);

    // Even if someone tries to record a failed deployment, createPublishVersion rejects.
    const rejected = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp",
        deploymentProvider: "mock-local",
        deploymentId: "dep_fail",
        previewUrl: "https://x.example",
        deploymentStatus: "failed",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      gateway,
    );
    expect(rejected.ok).toBe(false);
    expect(gateway.rows).toHaveLength(0);
  });

  it("enforces authorization boundaries (own projects only)", async () => {
    const ownerGateway = createMemoryPublishVersionsGateway({
      userId: "user-owner",
      ownedProjectIds: [PROJECT_ID],
    });
    const created = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp",
        deploymentProvider: "vercel",
        deploymentId: "dep_auth",
        previewUrl: "https://site.vercel.app",
        deploymentStatus: "ready",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      ownerGateway,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stranger = createMemoryPublishVersionsGateway({
      userId: "user-stranger",
      ownedProjectIds: ["other-project"],
    });
    // Share rows to simulate reading across tenants (RLS should block).
    stranger.rows.push(...ownerGateway.rows);

    const listDenied = await listPublishVersions(PROJECT_ID, stranger);
    expect(listDenied.ok).toBe(false);

    const insertDenied = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp2",
        deploymentProvider: "vercel",
        deploymentId: "dep_x",
        previewUrl: "https://x.vercel.app",
        deploymentStatus: "ready",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      stranger,
    );
    expect(insertDenied.ok).toBe(false);

    const getDenied = await getPublishVersion(created.data.id, stranger);
    expect(getDenied.ok).toBe(false);

    const unsigned = createMemoryPublishVersionsGateway({
      userId: null,
      ownedProjectIds: [PROJECT_ID],
    });
    const noAuth = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: "fp3",
        deploymentProvider: "vercel",
        deploymentId: "dep_y",
        previewUrl: "https://y.vercel.app",
        deploymentStatus: "ready",
        projectSnapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      },
      unsigned,
    );
    expect(noAuth.ok).toBe(false);
  });

  it("surfaces a recoverable warning when version persistence fails after deploy", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [], // project not owned → insert fails after "ready"
      userId: "user-owner",
    });
    const deployment = readyDeployment();
    const result = {
      slug: "olive-branch",
      url: deployment.previewUrl,
      publishedAt: deployment.readyAt!,
      snapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
      artifact: {
        version: 1 as const,
        slug: "olive-branch",
        templateId: "modern" as const,
        fingerprint: deployment.artifactFingerprint,
        files: [],
        assets: [],
      },
      deployment,
    };

    const outcome = await recordPublishVersionAfterDeploy({
      projectId: PROJECT_ID,
      result,
      gateway,
    });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.warning).toMatch(/deployed/i);
    expect(outcome.warning).toMatch(/history could not be saved/i);
  });

  it("sanitizes snapshots so HTML and credential-like keys are not stored", () => {
    const dirty = {
      ...MOCK_BUSINESS_PROJECT,
      publish: toPublishRecord({
        slug: "x",
        url: "https://x",
        publishedAt: "2026-07-26T00:00:00.000Z",
        snapshot: { ...MOCK_BUSINESS_PROJECT, publish: null },
        artifact: {
          version: 1 as const,
          slug: "x",
          templateId: "modern" as const,
          fingerprint: "fp",
          files: [
            {
              path: "index.html",
              content: "<!DOCTYPE html><html></html>",
              contentType: "text/html",
            },
          ],
          assets: [],
        },
        deployment: readyDeployment(),
      }),
      vercel_token: "secret",
      html: "<!DOCTYPE html>",
    } as typeof MOCK_BUSINESS_PROJECT & {
      vercel_token: string;
      html: string;
    };

    const clean = sanitizeProjectSnapshot(dirty);
    expect(clean.publish).toBeNull();
    expect(
      (clean as Record<string, unknown>).vercel_token,
    ).toBeUndefined();
    expect((clean as Record<string, unknown>).html).toBeUndefined();
  });

  it("migration enables RLS, immutability, and ownership policies", () => {
    const source = readFileSync(
      resolve(
        __dirname,
        "../../supabase/migrations/20260726_publish_versions.sql",
      ),
      "utf8",
    );
    expect(source).toContain("create table if not exists public.publish_versions");
    expect(source).toContain("enable row level security");
    expect(source).toContain("Users can select own publish versions");
    expect(source).toContain("Users can insert own publish versions");
    expect(source).toContain("publish_versions rows are immutable");
    expect(source).toContain("unique (project_id, version_number)");
    expect(source).not.toMatch(/for update/i);
    expect(source).not.toMatch(/for delete/i);
  });
});
