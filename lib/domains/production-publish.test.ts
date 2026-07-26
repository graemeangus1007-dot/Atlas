import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canPublishToLinkedProduction,
  isPreviewOnlyDeployTarget,
  matchesProductionPublishConfirmation,
} from "@/lib/domains/production-publish";

describe("production publish safety helpers", () => {
  it("matches typed hostname or linked project name", () => {
    expect(
      matchesProductionPublishConfirmation({
        confirmation: "www.Example.com",
        hostname: "www.example.com",
        linkedProjectName: "my-prod",
      }),
    ).toBe(true);
    expect(
      matchesProductionPublishConfirmation({
        confirmation: "my-prod",
        hostname: "www.example.com",
        linkedProjectName: "my-prod",
      }),
    ).toBe(true);
    expect(
      matchesProductionPublishConfirmation({
        confirmation: "nope",
        hostname: "www.example.com",
        linkedProjectName: "my-prod",
      }),
    ).toBe(false);
  });

  it("treats preview as the only default deploy target", () => {
    expect(isPreviewOnlyDeployTarget("preview")).toBe(true);
    expect(isPreviewOnlyDeployTarget(undefined)).toBe(true);
    expect(isPreviewOnlyDeployTarget("production")).toBe(false);
    expect(canPublishToLinkedProduction("linked", "prj_x")).toBe(true);
    expect(canPublishToLinkedProduction("detected", "prj_x")).toBe(false);
  });

  it("UI and publisher never let Force Redeploy hit production", () => {
    const modal = readFileSync(
      resolve(__dirname, "../../components/publishing/publish-modal.tsx"),
      "utf8",
    );
    expect(modal).toContain("Publish to Production");
    expect(modal).toContain("This replaces the live website");
    expect(modal).toContain('force: true, deployTarget: "preview"');
    expect(modal).toContain("Atlas preview (.vercel.app)");
    expect(modal).toContain("Production custom domain");

    const publisher = readFileSync(
      resolve(__dirname, "../publishing/publisher.ts"),
      "utf8",
    );
    expect(publisher).toContain("options.force");
    expect(publisher).toContain('? "preview"');

    const panel = readFileSync(
      resolve(__dirname, "../../components/publishing/editor-publish-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("Publish to Production");
    expect(panel).toContain("Atlas preview (.vercel.app)");
  });
});
