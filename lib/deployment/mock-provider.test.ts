import { describe, expect, it } from "vitest";
import {
  buildDeploymentId,
  buildDeploymentPreviewUrl,
  MockDeploymentProvider,
} from "@/lib/deployment";
import type {
  DeploymentProgressEvent,
  DeploymentStatus,
} from "@/lib/deployment";
import type { PublishArtifact } from "@/lib/publishing/types";

function makeArtifact(fingerprint = "abc12345"): PublishArtifact {
  return {
    version: 1,
    slug: "olive-branch",
    templateId: "modern",
    fingerprint,
    files: [
      {
        path: "index.html",
        content: "<!DOCTYPE html><html><body>Hi</body></html>\n",
        contentType: "text/html; charset=utf-8",
      },
      {
        path: "styles.css",
        content: "body{margin:0}\n",
        contentType: "text/css; charset=utf-8",
      },
    ],
    assets: [],
  };
}

describe("MockDeploymentProvider", () => {
  it("successfully deploys an artifact with a stable id and preview URL", async () => {
    const fixed = new Date("2026-07-24T12:00:00.000Z");
    const provider = new MockDeploymentProvider({
      stepDelayMs: 0,
      now: () => fixed,
    });
    const artifact = makeArtifact("fp001");

    const result = await provider.deploy({
      slug: "olive-branch",
      artifact,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.deployment.status).toBe("ready");
    expect(result.deployment.id).toBe(
      buildDeploymentId("olive-branch", "fp001"),
    );
    expect(result.deployment.previewUrl).toBe(
      buildDeploymentPreviewUrl("olive-branch"),
    );
    expect(result.deployment.artifactFingerprint).toBe("fp001");
    expect(result.deployment.provider).toBe("mock-local");
    expect(result.deployment.createdAt).toBe(fixed.toISOString());
    expect(result.deployment.readyAt).toBe(fixed.toISOString());
    expect(result.deployment.error).toBeNull();
    expect(result.deployment.reused).toBe(false);

    // Same inputs → same deployment id (stable).
    const again = await provider.deploy({
      slug: "olive-branch",
      artifact,
      force: true,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.deployment.id).toBe(result.deployment.id);
  });

  it("fails deployment at the upload stage with a typed error", async () => {
    const provider = new MockDeploymentProvider({
      stepDelayMs: 0,
      failAt: "uploading",
    });

    const statuses: DeploymentStatus[] = [];
    const result = await provider.deploy(
      { slug: "olive-branch", artifact: makeArtifact() },
      (event) => {
        statuses.push(event.status);
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("upload_failed");
    expect(result.error.retryable).toBe(true);
    expect(result.deployment?.status).toBe("failed");
    expect(result.deployment?.error?.code).toBe("upload_failed");
    expect(statuses).toContain("queued");
    expect(statuses).toContain("uploading");
    expect(statuses).not.toContain("ready");
  });

  it("reuses the latest successful deployment when fingerprints match", async () => {
    const provider = new MockDeploymentProvider({ stepDelayMs: 0 });
    const artifact = makeArtifact("same-fp");

    const first = await provider.deploy({
      slug: "olive-branch",
      artifact,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const events: DeploymentProgressEvent[] = [];
    const second = await provider.deploy(
      {
        slug: "olive-branch",
        artifact,
        previousDeployment: {
          id: first.deployment.id,
          previewUrl: first.deployment.previewUrl,
          artifactFingerprint: first.deployment.artifactFingerprint,
          createdAt: first.deployment.createdAt,
          updatedAt: first.deployment.updatedAt,
          readyAt: first.deployment.readyAt,
        },
      },
      (event) => {
        events.push(event);
      },
    );

    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.deployment.reused).toBe(true);
    expect(second.deployment.id).toBe(first.deployment.id);
    expect(second.deployment.status).toBe("ready");
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("ready");
    expect(events[0]?.label).toMatch(/no changes/i);

    // force=true bypasses duplicate short-circuit.
    const forcedEvents: DeploymentStatus[] = [];
    const forced = await provider.deploy(
      {
        slug: "olive-branch",
        artifact,
        previousDeployment: {
          id: first.deployment.id,
          previewUrl: first.deployment.previewUrl,
          artifactFingerprint: first.deployment.artifactFingerprint,
          createdAt: first.deployment.createdAt,
          updatedAt: first.deployment.updatedAt,
          readyAt: first.deployment.readyAt,
        },
        force: true,
      },
      (event) => {
        forcedEvents.push(event.status);
      },
    );

    expect(forced.ok).toBe(true);
    if (!forced.ok) return;
    expect(forced.deployment.reused).toBe(false);
    expect(forcedEvents).toEqual([
      "queued",
      "uploading",
      "deploying",
      "ready",
    ]);
  });

  it("emits status transitions in order: queued → uploading → deploying → ready", async () => {
    const provider = new MockDeploymentProvider({ stepDelayMs: 0 });
    const statuses: DeploymentStatus[] = [];
    const progresses: number[] = [];

    const result = await provider.deploy(
      { slug: "olive-branch", artifact: makeArtifact("transitions") },
      (event) => {
        statuses.push(event.status);
        progresses.push(event.progress);
      },
    );

    expect(result.ok).toBe(true);
    expect(statuses).toEqual(["queued", "uploading", "deploying", "ready"]);
    expect(progresses[0]).toBeLessThan(progresses[1]!);
    expect(progresses[1]).toBeLessThan(progresses[2]!);
    expect(progresses[3]).toBe(100);
  });

  it("rejects an invalid artifact", async () => {
    const provider = new MockDeploymentProvider({ stepDelayMs: 0 });
    const result = await provider.deploy({
      slug: "olive-branch",
      artifact: {
        ...makeArtifact(),
        fingerprint: "",
        files: [],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_artifact");
  });
});
