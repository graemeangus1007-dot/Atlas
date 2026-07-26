import { describe, expect, it } from "vitest";
import {
  assertNoAppSourceFiles,
  buildStaticSiteCreateDeploymentBody,
  buildStaticSiteVercelJson,
  isStaticNoFrameworkDeployment,
  STATIC_SITE_PROJECT_SETTINGS,
} from "@/lib/deployment/vercel-static-deployment";

describe("static customer-site create-deployment payload", () => {
  it("forces Other/no-framework settings that cannot trigger a Next.js build", () => {
    const body = buildStaticSiteCreateDeploymentBody({
      slug: "olive-branch",
      projectId: "prj_customer_static",
      files: [
        { file: "index.html", sha: "a".repeat(40), size: 120 },
        { file: "styles.css", sha: "b".repeat(40), size: 40 },
        { file: "assets/hero.jpg", sha: "c".repeat(40), size: 2048 },
        { file: "vercel.json", sha: "d".repeat(40), size: 80 },
      ],
    });

    expect(body.projectSettings).toEqual(STATIC_SITE_PROJECT_SETTINGS);
    expect(body.projectSettings.framework).toBeNull();
    expect(body.projectSettings.buildCommand).toBe("");
    expect(body.projectSettings.installCommand).toBe("");
    expect(body.projectSettings.outputDirectory).toBe("");
    // null would mean auto-detect for build/install — empty string disables them.
    expect(body.projectSettings.buildCommand).not.toBeNull();
    expect(body.projectSettings.framework).not.toBe("nextjs");
    expect(JSON.stringify(body)).not.toMatch(/nextjs/i);
    expect(isStaticNoFrameworkDeployment(body)).toBe(true);

    for (const file of body.files) {
      expect(file).not.toHaveProperty("data");
      expect(file).not.toHaveProperty("encoding");
    }
  });

  it("rejects Atlas / Next.js source files from the deployment file list", () => {
    expect(() => assertNoAppSourceFiles(["index.html", "package.json"])).toThrow(
      /application source file/i,
    );
    expect(() =>
      buildStaticSiteCreateDeploymentBody({
        slug: "demo",
        projectId: "prj_x",
        files: [
          { file: "index.html", sha: "a".repeat(40), size: 10 },
          { file: "package.json", sha: "b".repeat(40), size: 10 },
        ],
      }),
    ).toThrow(/package\.json/);
  });

  it("embeds static framework settings in vercel.json for clean / routing", () => {
    const json = JSON.parse(buildStaticSiteVercelJson()) as {
      framework: null;
      buildCommand: string;
      cleanUrls: boolean;
    };
    expect(json.framework).toBeNull();
    expect(json.buildCommand).toBe("");
    expect(json.cleanUrls).toBe(true);
  });
});
