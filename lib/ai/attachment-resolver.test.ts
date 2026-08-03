import { describe, expect, it } from "vitest";
import { resolveAttachmentImageRequest } from "@/lib/ai/attachment-resolver";
import { runImageAgent } from "@/lib/ai/image-agent";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { AttachmentContext } from "@/lib/ai/conversation-attachments";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

function asset(id: string, name = `${id}.jpg`): MediaAsset {
  return {
    id,
    name,
    filename: name,
    url: `https://example.com/${name}`,
    storagePath: `user/proj/${name}`,
    mimeType: "image/jpeg",
    size: 1024,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    title: name,
    description: "",
    alt: name,
  };
}

function ctx(
  id: string,
  assetId: string,
  position: number,
  type: "image" | "logo" = "image",
): AttachmentContext {
  return {
    attachmentId: id,
    assetId,
    type,
    filename: `${assetId}.jpg`,
    position,
  };
}

function projectWith(...assets: MediaAsset[]): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    mediaLibrary: assets,
    heroImageId: null,
    galleryImageIds: [],
    logoAssetId: null,
    logo: null,
    sectionImages: {},
  };
}

describe("attachment resolver", () => {
  it("uses a single attachment as the hero", () => {
    const project = projectWith(asset("a1"));
    const result = resolveAttachmentImageRequest({
      request: "Use this as the hero image.",
      attachments: [ctx("att1", "a1", 0)],
      project,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.operations).toEqual([
        { operation: "replaceHeroImage", assetId: "a1" },
      ]);
    }
  });

  it("uses the second image as the hero", () => {
    const project = projectWith(asset("a1"), asset("a2"));
    const result = resolveAttachmentImageRequest({
      request: "Use the second image as the hero.",
      attachments: [ctx("att1", "a1", 0), ctx("att2", "a2", 1)],
      project,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.operations[0]).toEqual({
        operation: "replaceHeroImage",
        assetId: "a2",
      });
    }
  });

  it("clarifies when multiple attachments and vague reference", () => {
    const project = projectWith(asset("a1"), asset("a2"));
    const result = resolveAttachmentImageRequest({
      request: "Use this as the hero image.",
      attachments: [ctx("att1", "a1", 0), ctx("att2", "a2", 1)],
      project,
    });
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.needsClarification).toBe(true);
      expect(result.explanation).toMatch(/first or second/i);
    }
  });

  it("sets logo from logo attachment", () => {
    const project = projectWith(asset("logo1", "logo.png"));
    const result = resolveAttachmentImageRequest({
      request: "Use this as our logo.",
      attachments: [ctx("att1", "logo1", 0, "logo")],
      project,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.operations).toEqual([
        { operation: "setLogo", assetId: "logo1" },
      ]);
    }
  });

  it("adds photos to the gallery", () => {
    const project = projectWith(asset("a1"), asset("a2"), asset("a3"));
    const result = resolveAttachmentImageRequest({
      request: "Add these to the gallery.",
      attachments: [
        ctx("att1", "a1", 0),
        ctx("att2", "a2", 1),
        ctx("att3", "a3", 2),
      ],
      project,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.operations).toHaveLength(3);
      expect(result.operations.every((op) => op.operation === "insertImage")).toBe(
        true,
      );
    }
  });

  it("places photo in About", () => {
    const project = projectWith(asset("a1"));
    const result = resolveAttachmentImageRequest({
      request: "Put this next to the About section.",
      attachments: [ctx("att1", "a1", 0)],
      project,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.operations).toEqual([
        { operation: "setSectionImage", section: "about", assetId: "a1" },
      ]);
    }
  });
});

describe("image agent + attachments", () => {
  it("applies hero placement and verifies asset id", () => {
    const project = projectWith(asset("hero-asset"));
    const result = runImageAgent({
      project,
      request: "Use this as the hero image.",
      attachmentContexts: [ctx("att1", "hero-asset", 0)],
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.heroImageId).toBe("hero-asset");
    expect(result.explanation).toMatch(/hero/i);
    expect(result.explanation).not.toMatch(/^Done\.$/);
  });

  it("applies logo placement", () => {
    const project = projectWith(asset("logo-asset", "logo.png"));
    const result = runImageAgent({
      project,
      request: "Use this as our logo.",
      attachmentContexts: [ctx("att1", "logo-asset", 0, "logo")],
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.project.logoAssetId).toBe("logo-asset");
  });

  it("asks for clarification instead of guessing", () => {
    const project = projectWith(asset("a1"), asset("a2"));
    const result = runImageAgent({
      project,
      request: "Use this as the hero image.",
      attachmentContexts: [ctx("att1", "a1", 0), ctx("att2", "a2", 1)],
    });
    expect(result.applyStatus).toBe("needs_clarification");
    expect(result.project.heroImageId).toBeNull();
  });
});
