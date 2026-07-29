/**
 * Sprint 24.0A — Atlas Visual Designer / Image Agent regression tests.
 */

import { describe, expect, it } from "vitest";
import { applyImageOperations } from "@/lib/ai/apply-image-operations";
import {
  canRedoEditorRevision,
  canUndoEditorRevision,
  createEmptyRevisionStack,
  pushEditorRevision,
  redoEditorRevision,
  undoEditorRevision,
} from "@/lib/ai/editor-revisions";
import {
  isImageEditRequest,
  planImageOperations,
  runImageAgent,
  tryRunImageAgent,
} from "@/lib/ai/image-agent";
import { runEditorAgent } from "@/lib/ai/editor-agent";
import { validateImageOperations } from "@/lib/ai/validate-image-operations";
import { AiError } from "@/lib/ai/errors";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { generateWebsiteContent } from "@/lib/website-generator";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function mockAsset(
  id: string,
  title: string,
  extras: Partial<MediaAsset> = {},
): MediaAsset {
  return {
    id,
    name: `${title}.jpg`,
    filename: `${id}.jpg`,
    url: `https://cdn.example.com/${id}.jpg`,
    storagePath: `user/proj/${id}.jpg`,
    mimeType: "image/jpeg",
    size: 12000,
    sizeLabel: "12 KB",
    createdAt: Date.now(),
    title,
    description: title,
    alt: title,
    unavailable: false,
    ...extras,
  };
}

function sampleProject(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  const cookies = mockAsset("asset-cookies", "fresh cookies");
  const bakery = mockAsset("asset-bakery", "bakery storefront");
  const team = mockAsset("asset-team", "team photo");
  const logo = mockAsset("asset-logo", "logo");

  return {
    ...MOCK_BUSINESS_PROJECT,
    businessName: "Linda's Cookies",
    mediaLibrary: [cookies, bakery, team, logo],
    heroImageId: null,
    galleryImageIds: ["", "", "", ""],
    sectionImages: {},
    sectionOrder: undefined,
    logoAssetId: null,
    logo: null,
    designSections: {
      enabled: ["testimonials"],
      testimonials: [
        { quote: "Great cookies", author: "Alex", role: "Customer" },
      ],
    },
    publish: null,
    ...overrides,
  };
}

describe("image intent detection", () => {
  it("recognizes visual designer requests", async () => {
    expect(isImageEditRequest("Replace the hero image.")).toBe(true);
    expect(isImageEditRequest("Move the gallery above Testimonials.")).toBe(
      true,
    );
    expect(isImageEditRequest("Update the FAQ answer to hello")).toBe(false);
  });
});

describe("replace hero image", () => {
  it("sets heroImageId from the library", async () => {
    const project = sampleProject();
    const result = runImageAgent({
      project,
      request: "Replace the hero image with fresh cookies",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroImageId).toBe("asset-cookies");
    expect(result.explanation).toMatch(/hero image/i);
  });
});

describe("replace gallery image", () => {
  it("fills the requested gallery slot", async () => {
    const result = runImageAgent({
      project: sampleProject(),
      request: "Replace the first gallery image with the bakery storefront",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.galleryImageIds[0]).toBe("asset-bakery");
  });
});

describe("move image", () => {
  it("moves the first image into a gallery slot", async () => {
    const project = sampleProject({ heroImageId: "asset-cookies" });
    const result = runImageAgent({
      project,
      request: "Move the first image below Services",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.operations.some((op) => op.operation === "moveImage")).toBe(
      true,
    );
  });
});

describe("insert image", () => {
  it("places a team photo on the About section", async () => {
    const result = runImageAgent({
      project: sampleProject(),
      request: "Put a team photo next to the About section",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.sectionImages?.about).toBe("asset-team");
  });
});

describe("delete image", () => {
  it("clears the hero image", async () => {
    const result = runImageAgent({
      project: sampleProject({ heroImageId: "asset-cookies" }),
      request: "Remove the hero image",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroImageId).toBeNull();
  });
});

describe("move gallery", () => {
  it("reorders sectionOrder above testimonials", async () => {
    const result = runImageAgent({
      project: sampleProject(),
      request: "Move the gallery above Testimonials",
    });
    expect(result.applyStatus).toBe("applied");
    const order = result.project.sectionOrder ?? [];
    expect(order.indexOf("gallery")).toBeLessThan(order.indexOf("testimonials"));
  });
});

describe("replace placeholder", () => {
  it("replaces every placeholder with a library asset", async () => {
    const result = runImageAgent({
      project: sampleProject(),
      request: "Replace every placeholder image with fresh cookies",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroImageId).toBe("asset-cookies");
    expect(result.project.galleryImageIds.every((id) => id === "asset-cookies")).toBe(
      true,
    );
  });
});

describe("conversational references", () => {
  it("resolves this image from editor state", async () => {
    const project = sampleProject({ heroImageId: "asset-bakery" });
    const result = runImageAgent({
      project,
      request: "Remove this image",
      editorState: { lastImageRef: { kind: "hero" } },
    });
    expect(result.project.heroImageId).toBeNull();
  });
});

describe("section references", () => {
  it("sets a section image beside About", async () => {
    const planned = planImageOperations({
      project: sampleProject(),
      request: "Put our team photo next to About",
    });
    expect(planned.operations[0]?.operation).toBe("setSectionImage");
  });
});

describe("validation failures", () => {
  it("rejects unknown asset ids", async () => {
    expect(() =>
      validateImageOperations(
        [{ operation: "replaceHeroImage", assetId: "missing" }],
        sampleProject(),
      ),
    ).toThrow(AiError);
  });

  it("asks a follow-up when the replace target is ambiguous", async () => {
    const result = runImageAgent({
      project: sampleProject(),
      request: "Replace the image with fresh cookies",
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.explanation).toMatch(/hero image|gallery image/i);
  });
});

describe("undo and redo", () => {
  it("restores image assignments through the revision stack", async () => {
    const before = sampleProject();
    const applied = runImageAgent({
      project: before,
      request: "Replace the hero image with fresh cookies",
    });
    let stack = createEmptyRevisionStack();
    stack = pushEditorRevision(stack, {
      before,
      after: applied.project,
      operations: applied.operations,
      changes: applied.changes,
      prompt: "Replace the hero image with fresh cookies",
    });
    expect(canUndoEditorRevision(stack)).toBe(true);
    const undone = undoEditorRevision(stack)!;
    expect(undone.project.heroImageId).toBeNull();
    const redone = redoEditorRevision(undone.stack)!;
    expect(canRedoEditorRevision(undone.stack)).toBe(true);
    expect(redone.project.heroImageId).toBe("asset-cookies");
  });
});

describe("persistence after refresh", () => {
  it("keeps hero and section images through JSON round-trip", async () => {
    const applied = applyImageOperations(sampleProject(), [
      { operation: "replaceHeroImage", assetId: "asset-cookies" },
      { operation: "setSectionImage", section: "about", assetId: "asset-team" },
    ]).project;
    const persisted = JSON.parse(JSON.stringify(applied)) as BusinessProject;
    expect(persisted.heroImageId).toBe("asset-cookies");
    expect(persisted.sectionImages?.about).toBe("asset-team");
  });
});

describe("preview and published rendering", () => {
  it("includes hero and about images in generated + published HTML", async () => {
    const project = applyImageOperations(sampleProject(), [
      { operation: "replaceHeroImage", assetId: "asset-cookies" },
      { operation: "setSectionImage", section: "about", assetId: "asset-team" },
      { operation: "setLogo", assetId: "asset-logo" },
    ]).project;

    const content = generateWebsiteContent(project);
    expect(content.hero.isPlaceholder).toBe(false);
    expect(content.hero.imageUrl).toContain("asset-cookies");
    expect(content.about.imageUrl).toContain("asset-team");
    expect(content.logoUrl).toContain("asset-logo");

    const artifact = buildStaticSite(project);
    const html =
      artifact.files.find((f) => f.path === "index.html")?.content ?? "";
    // Publish remaps library URLs to stable relative asset paths.
    expect(html).toMatch(/assets\/hero\.jpg/);
    expect(html).toMatch(/assets\/about\.jpg/);
    expect(html).toMatch(/assets\/logo\.jpg/);
  });
});

describe("editor agent integration", () => {
  it("routes image language through the image agent", async () => {
    const result = await runEditorAgent({
      project: sampleProject(),
      request: "Use our logo in the navigation",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.logoAssetId).toBe("asset-logo");
  });
});

describe("tryRunImageAgent", () => {
  it("returns a safe failure for invalid project input", async () => {
    const result = tryRunImageAgent({
      project: null as unknown as BusinessProject,
      request: "Replace the hero image",
    });
    expect(result.ok).toBe(false);
  });
});
