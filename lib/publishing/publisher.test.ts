import { describe, expect, it } from "vitest";
import { MockDeploymentProvider } from "@/lib/deployment";
import { AtlasWebsitePublisher } from "@/lib/publishing/publisher";
import { toPublishRecord } from "@/types/publishing";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";

describe("AtlasWebsitePublisher + deployment", () => {
  it("builds, deploys, and persists a slim record without HTML files", async () => {
    const deployment = new MockDeploymentProvider({
      stepDelayMs: 0,
      now: () => new Date("2026-07-24T15:00:00.000Z"),
    });
    const publisher = new AtlasWebsitePublisher(deployment);

    const steps: string[] = [];
    const result = await publisher.publish(
      { ...MOCK_BUSINESS_PROJECT, businessName: "Olive Branch Cafe" },
      (event) => {
        steps.push(event.step);
      },
      { deployment, atlasOrigin: "https://atlas.example.com" },
    );

    expect(result.deployment.status).toBe("ready");
    expect(result.artifact.files.some((f) => f.path === "index.html")).toBe(
      true,
    );

    const record = toPublishRecord(result);
    expect(record.deployment?.id).toBe(result.deployment.id);
    expect(record.artifactFingerprint).toBe(result.artifact.fingerprint);
    expect(record.url).toBe(result.deployment.previewUrl);
    // Ensure we never stuff file bodies onto the persisted record.
    expect(JSON.stringify(record)).not.toContain("<!DOCTYPE html>");
    expect(JSON.stringify(record)).not.toContain("styles.css");

    expect(steps).toContain("preparing");
    expect(steps).toContain("building");
    expect(steps).toContain("ready");
  });

  it("short-circuits when the project already has the same fingerprint", async () => {
    const deployment = new MockDeploymentProvider({ stepDelayMs: 0 });
    const publisher = new AtlasWebsitePublisher(deployment);
    const project = {
      ...MOCK_BUSINESS_PROJECT,
      businessName: "Olive Branch Cafe",
    };

    const publishOpts = {
      deployment,
      atlasOrigin: "https://atlas.example.com",
    } as const;

    // First publish has no preview URL yet — SEO absolute URLs are empty.
    const first = await publisher.publish(project, undefined, publishOpts);
    const published = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(first),
    };

    // Second publish embeds the preview URL into canonical/sitemap → new fingerprint.
    const second = await publisher.publish(published, undefined, publishOpts);
    expect(second.deployment.reused).toBe(false);
    expect(second.deployment.artifactFingerprint).not.toBe(
      first.deployment.artifactFingerprint,
    );

    // Third publish with the same preview URL reuses the deployment.
    const publishedAgain = {
      ...project,
      status: "published" as const,
      publish: toPublishRecord(second),
    };
    const third = await publisher.publish(publishedAgain, undefined, publishOpts);

    expect(third.deployment.reused).toBe(true);
    expect(third.deployment.id).toBe(second.deployment.id);
  });
});
