import { describe, expect, it, vi } from "vitest";
import {
  deployViaServerApi,
  fetchActiveDeploymentProvider,
} from "@/lib/deployment/deploy-client";
import type { PublishArtifact } from "@/lib/publishing/types";

function makeArtifact(): PublishArtifact {
  return {
    version: 1,
    slug: "demo",
    templateId: "modern",
    fingerprint: "fp1",
    files: [
      {
        path: "index.html",
        content: "<html></html>",
        contentType: "text/html",
      },
    ],
    assets: [],
  };
}

describe("deploy-client", () => {
  it("loads active provider info from the server", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        provider: "vercel",
        id: "vercel",
        label: "Vercel preview hosting",
      }),
    );

    const info = await fetchActiveDeploymentProvider(fetchImpl);
    expect(info.provider).toBe("vercel");
    expect(info.label).toContain("Vercel");
  });

  it("streams NDJSON progress and returns the final result", async () => {
    const ndjson = [
      JSON.stringify({
        type: "progress",
        event: {
          deploymentId: "dep_1",
          status: "uploading",
          label: "Uploading",
          progress: 40,
        },
      }),
      JSON.stringify({
        type: "result",
        result: {
          ok: true,
          deployment: {
            id: "dep_1",
            status: "ready",
            slug: "demo",
            previewUrl: "https://demo.vercel.app",
            artifactFingerprint: "fp1",
            provider: "vercel",
            createdAt: "2026-07-25T00:00:00.000Z",
            updatedAt: "2026-07-25T00:00:00.000Z",
            readyAt: "2026-07-25T00:00:00.000Z",
            error: null,
          },
        },
      }),
    ].join("\n");

    const fetchImpl = vi.fn(async () =>
      new Response(ndjson, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }),
    );

    const statuses: string[] = [];
    const result = await deployViaServerApi(
      { slug: "demo", artifact: makeArtifact() },
      (e) => statuses.push(e.status),
      fetchImpl,
    );

    expect(statuses).toEqual(["uploading"]);
    expect(result.ok).toBe(true);
    expect(result.deployment?.previewUrl).toBe("https://demo.vercel.app");
  });
});
