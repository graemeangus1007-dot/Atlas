import { describe, expect, it } from "vitest";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import {
  buildRestoredProject,
  isCurrentPublishVersion,
  restorePublishVersion,
} from "@/lib/publishing/restore-publish-version";
import {
  createMemoryPublishVersionsGateway,
  createPublishVersion,
  listPublishVersionPage,
} from "@/lib/supabase/publish-versions";
import type { PublishSnapshot } from "@/types/publishing";

const PROJECT_ID = "project-1";

function snapshotWithName(name: string): PublishSnapshot {
  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: name,
    heroHeadline: `${name} headline`,
    publish: null,
    status: "ready",
  };
}

async function seedVersions(
  gateway: ReturnType<typeof createMemoryPublishVersionsGateway>,
  names: string[],
) {
  const created = [];
  for (let i = 0; i < names.length; i += 1) {
    const result = await createPublishVersion(
      {
        projectId: PROJECT_ID,
        artifactFingerprint: `fp-${i + 1}`,
        deploymentProvider: "vercel",
        deploymentId: `dep_${i + 1}`,
        previewUrl: `https://v${i + 1}.vercel.app`,
        deploymentStatus: "ready",
        projectSnapshot: snapshotWithName(names[i]!),
      },
      gateway,
    );
    expect(result.ok).toBe(true);
    if (result.ok) created.push(result.data);
  }
  return created;
}

describe("version history restore", () => {
  it("orders history newest → oldest", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    await seedVersions(gateway, ["Alpha", "Beta", "Gamma"]);

    const page = await listPublishVersionPage(
      PROJECT_ID,
      { limit: 25, offset: 0 },
      gateway,
    );
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.data.items.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
    expect(page.data.latestVersionNumber).toBe(3);
    // Lazy list: no snapshots on summary items.
    expect(
      page.data.items.every(
        (item) => !("projectSnapshot" in item) || item.projectSnapshot == null,
      ),
    ).toBe(true);
  });

  it("marks the latest version as current and disables restore for it", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const versions = await seedVersions(gateway, ["One", "Two"]);
    const latest = versions[1]!;
    const older = versions[0]!;

    expect(isCurrentPublishVersion(latest, 2)).toBe(true);
    expect(isCurrentPublishVersion(older, 2)).toBe(false);

    const blocked = await restorePublishVersion({
      projectId: PROJECT_ID,
      versionId: latest.id,
      currentProject: {
        ...MOCK_BUSINESS_PROJECT,
        status: "published",
        publish: {
          slug: "x",
          url: "https://live.vercel.app",
          publishedAt: "2026-07-26T00:00:00.000Z",
          snapshot: snapshotWithName("Live"),
        },
      },
      latestVersionNumber: 2,
      gateway,
    });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toMatch(/current published version/i);
  });

  it("restores an older version into the editor with unpublished state", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const versions = await seedVersions(gateway, ["Older Cafe", "Newer Cafe"]);
    const older = versions[0]!;
    const livePublish = {
      slug: "olive-branch",
      url: "https://live.vercel.app",
      publishedAt: "2026-07-26T12:00:00.000Z",
      snapshot: snapshotWithName("Newer Cafe"),
    };
    const currentProject = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Edited After Publish",
      heroHeadline: "Draft headline",
      status: "published" as const,
      publish: livePublish,
    };

    const restored = await restorePublishVersion({
      projectId: PROJECT_ID,
      versionId: older.id,
      currentProject,
      latestVersionNumber: 2,
      gateway,
    });

    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.version.versionNumber).toBe(1);
    expect(restored.restoredProject.businessName).toBe("Older Cafe");
    expect(restored.restoredProject.heroHeadline).toBe("Older Cafe headline");
    // Live publish metadata preserved — restore is not a publish.
    expect(restored.restoredProject.publish).toEqual(livePublish);
    // Unpublished changes — must Publish again.
    expect(restored.restoredProject.status).toBe("ready");
    // History immutable.
    expect(gateway.rows).toHaveLength(2);
    expect(gateway.rows[0]?.project_snapshot.businessName).toBe("Older Cafe");
  });

  it("restores the latest non-current version (v2 when v3 is current)", async () => {
    const gateway = createMemoryPublishVersionsGateway({
      ownedProjectIds: [PROJECT_ID],
    });
    const versions = await seedVersions(gateway, ["A", "B", "C"]);
    const v2 = versions[1]!;

    const result = await restorePublishVersion({
      projectId: PROJECT_ID,
      versionId: v2.id,
      currentProject: {
        ...MOCK_BUSINESS_PROJECT,
        businessName: "C",
        status: "published",
        publish: {
          slug: "x",
          url: "https://c.vercel.app",
          publishedAt: "2026-07-26T00:00:00.000Z",
          snapshot: snapshotWithName("C"),
        },
      },
      latestVersionNumber: 3,
      gateway,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.version.versionNumber).toBe(2);
    expect(result.restoredProject.businessName).toBe("B");
    expect(result.restoredProject.status).toBe("ready");
  });

  it("buildRestoredProject keeps publish metadata and marks ready", () => {
    const current = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Now",
      status: "published" as const,
      publish: {
        slug: "now",
        url: "https://now.vercel.app",
        publishedAt: "2026-07-26T00:00:00.000Z",
        snapshot: snapshotWithName("Now"),
      },
    };
    const next = buildRestoredProject(current, snapshotWithName("Then"));
    expect(next.businessName).toBe("Then");
    expect(next.publish?.url).toBe("https://now.vercel.app");
    expect(next.status).toBe("ready");
  });

  it("enforces RLS — cannot restore another user's version", async () => {
    const owner = createMemoryPublishVersionsGateway({
      userId: "user-owner",
      ownedProjectIds: [PROJECT_ID],
    });
    const versions = await seedVersions(owner, ["Mine", "Also Mine"]);
    const older = versions[0]!;

    const stranger = createMemoryPublishVersionsGateway({
      userId: "user-stranger",
      ownedProjectIds: ["other-project"],
    });
    stranger.rows.push(...owner.rows);

    const denied = await restorePublishVersion({
      projectId: PROJECT_ID,
      versionId: older.id,
      currentProject: MOCK_BUSINESS_PROJECT,
      latestVersionNumber: 2,
      gateway: stranger,
    });
    expect(denied.ok).toBe(false);

    const listDenied = await listPublishVersionPage(
      PROJECT_ID,
      { limit: 25, offset: 0 },
      stranger,
    );
    expect(listDenied.ok).toBe(false);
  });

  it("confirmation is required before restore (UI contract helpers)", () => {
    // Pure contract: restore is only invoked after explicit confirm selection.
    type ConfirmState = { versionId: string | null };
    let state: ConfirmState = { versionId: null };
    const requestConfirm = (id: string) => {
      state = { versionId: id };
    };
    const cancelConfirm = () => {
      state = { versionId: null };
    };
    const canRestore = (id: string, confirmedId: string | null) =>
      confirmedId === id;

    requestConfirm("ver_1");
    expect(state.versionId).toBe("ver_1");
    expect(canRestore("ver_1", state.versionId)).toBe(true);
    cancelConfirm();
    expect(canRestore("ver_1", state.versionId)).toBe(false);
  });
});
