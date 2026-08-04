/**
 * v1.3 — Gallery metadata quality + fullscreen lightbox.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  shouldExecuteActionMemory,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  registerEditorPlanner,
  runAtlasBrain,
} from "@/lib/ai/atlas-brain";
import { planEditOperations } from "@/lib/ai/editor-agent";
import { applyEditOperations } from "@/lib/ai/apply-edit-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import {
  isGalleryLightboxRequest,
  planGalleryLightboxOperations,
  readGalleryInteraction,
  verifyGalleryLightbox,
} from "@/lib/ai/gallery-interaction";
import {
  isGalleryMetadataRequest,
  planGalleryMetadataOperations,
} from "@/lib/ai/gallery-metadata";
import {
  deriveDisplayTitle,
  isOpaqueMediaLabel,
  normalizeOpaqueMediaMetadata,
  publicGalleryTitle,
} from "@/lib/media-titles";
import { buildStaticSite } from "@/lib/publishing/build-static-site";
import { generateWebsiteContent } from "@/lib/website-generator";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";

beforeAll(() => {
  registerEditorPlanner(planEditOperations);
});

function asset(
  partial: Partial<MediaAsset> & Pick<MediaAsset, "id" | "name" | "title">,
): MediaAsset {
  return {
    filename: partial.filename ?? partial.name,
    url: `https://cdn.example.com/${partial.id}.jpg`,
    storagePath: `user/proj/${partial.id}.jpg`,
    mimeType: "image/jpeg",
    size: 1200,
    sizeLabel: "1 KB",
    createdAt: Date.now(),
    description: "",
    alt: partial.alt ?? partial.title,
    unavailable: false,
    ...partial,
  };
}

function projectWithGallery(
  overrides: Partial<BusinessProject> = {},
): BusinessProject {
  const a1 = asset({
    id: "a1",
    name: "133989754380766849.jpg",
    title: "133989754380766849",
    alt: "133989754380766849",
  });
  const a2 = asset({
    id: "a2",
    name: "front-yard-after.jpg",
    title: "front yard after",
    alt: "front yard after",
  });
  const a3 = asset({
    id: "a3",
    name: "IMG_4821.jpg",
    title: "IMG_4821",
    alt: "IMG_4821",
  });
  const a4 = asset({
    id: "a4",
    name: "patio-evening.jpg",
    title: "Patio Evening",
    alt: "Patio Evening",
  });
  return {
    ...MOCK_BUSINESS_PROJECT,
    mediaLibrary: [a1, a2, a3, a4],
    galleryImageIds: ["a1", "a2", "a3", "a4"],
    atlasActionMemory: undefined,
    ...overrides,
  };
}

describe("title normalization", () => {
  it("turns numeric filenames into Photo N", () => {
    expect(deriveDisplayTitle("133989754380766849.jpg", 0)).toBe("Photo 1");
    expect(deriveDisplayTitle("IMG_4821.jpg", 2)).toBe("Photo 3");
    expect(isOpaqueMediaLabel("133989754380766849")).toBe(true);
  });

  it("title-cases meaningful filenames", () => {
    expect(deriveDisplayTitle("front-yard-after.jpg", 0)).toBe(
      "Front Yard After",
    );
  });

  it("never treats UUID/storage paths as public titles", () => {
    expect(
      isOpaqueMediaLabel("9f3c2a1b-4d5e-6789-abcd-ef0123456789"),
    ).toBe(true);
    expect(isOpaqueMediaLabel("user/proj/uuid-file.webp")).toBe(true);
    expect(publicGalleryTitle("Photo 1")).toBe("");
    expect(publicGalleryTitle("Patio Installation")).toBe("Patio Installation");
  });

  it("assigns deterministic Photo N for four unnamed uploads", () => {
    const library = [
      asset({
        id: "1",
        name: "111.jpg",
        title: "111",
      }),
      asset({
        id: "2",
        name: "222.jpg",
        title: "222",
      }),
      asset({
        id: "3",
        name: "333.jpg",
        title: "333",
      }),
      asset({
        id: "4",
        name: "444.jpg",
        title: "444",
      }),
    ];
    const normalized = normalizeOpaqueMediaMetadata(library, [
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(normalized.map((a) => a.title)).toEqual([
      "Photo 1",
      "Photo 2",
      "Photo 3",
      "Photo 4",
    ]);
  });

  it("hides meaningless titles on public gallery tiles", () => {
    const content = generateWebsiteContent(projectWithGallery());
    const titles = content.gallery.map((g) => g.title);
    expect(titles.some((t) => /\d{8,}/.test(t))).toBe(false);
    expect(titles).not.toContain("133989754380766849");
    expect(titles).not.toContain("IMG_4821");
    // Meaningful title preserved when already human
    expect(content.gallery[3]?.title).toMatch(/Patio/i);
    // Opaque slot is image-only publicly
    expect(content.gallery[0]?.showTitle).toBe(false);
  });

  it("migration is idempotent and preserves captions", () => {
    const library = [
      asset({
        id: "x",
        name: "999999999.jpg",
        title: "999999999",
        description: "Keep this caption",
      }),
    ];
    const once = normalizeOpaqueMediaMetadata(library, ["x"]);
    const twice = normalizeOpaqueMediaMetadata(once, ["x"]);
    expect(once[0]?.title).toBe("Photo 1");
    expect(twice[0]?.title).toBe("Photo 1");
    expect(twice[0]?.description).toBe("Keep this caption");
  });
});

describe("gallery metadata NL edits", () => {
  it("renames the first gallery image", async () => {
    expect(
      isGalleryMetadataRequest(
        "Rename the first gallery image to Front Yard Renovation.",
      ),
    ).toBe(true);
    const result = await runAtlasBrain({
      project: projectWithGallery(),
      request: "Rename the first gallery image to Front Yard Renovation.",
    });
    expect(result.applyStatus).toBe("applied");
    const first = result.project.mediaLibrary.find((a) => a.id === "a1");
    expect(first?.title).toBe("Front Yard Renovation");
  });

  it("removes all gallery titles", async () => {
    const result = await runAtlasBrain({
      project: projectWithGallery(),
      request: "Remove the titles from the gallery.",
    });
    expect(result.applyStatus).toBe("applied");
    for (const id of result.project.galleryImageIds) {
      const assetRow = result.project.mediaLibrary.find((a) => a.id === id);
      expect(assetRow?.title).toBe("");
    }
    const content = generateWebsiteContent(result.project);
    expect(content.gallery.every((g) => !g.showTitle)).toBe(true);
  });

  it("calls the second photo by name", () => {
    const plan = planGalleryMetadataOperations({
      project: projectWithGallery(),
      request: "Call the second photo Patio Installation.",
    });
    expect(plan.operations[0]).toMatchObject({
      operation: "updateGalleryItemMetadata",
      galleryIndex: 1,
      title: "Patio Installation",
    });
  });
});

describe("gallery lightbox", () => {
  it("recognizes natural-language lightbox requests", () => {
    expect(
      isGalleryLightboxRequest(
        "I want to be able to view the entire picture when I click one of the photos.",
      ),
    ).toBe(true);
    expect(
      isGalleryLightboxRequest("Let people click photos to see the full image."),
    ).toBe(true);
    expect(isGalleryLightboxRequest("Add a lightbox to the gallery.")).toBe(
      true,
    );
    expect(
      isGalleryLightboxRequest("Let visitors swipe through the photos."),
    ).toBe(true);
  });

  it("Action Memory never intercepts lightbox requests", () => {
    const memory = storeRecommendations(undefined, {
      creative: [
        {
          id: "visual.icons",
          kind: "visual",
          title: "Add icons",
          explanation: "Icons",
          impact: "high",
          impactScore: 90,
          confidence: 0.9,
          operations: [{ operation: "setCreativePolish", serviceIcons: true }],
          capabilityIds: [],
          applyable: true,
          estimatedTime: "1s",
        },
      ],
    });
    expect(
      shouldExecuteActionMemory(
        "Let people click photos to see the full image.",
        memory,
      ),
    ).toBe(false);
  });

  it("enables lightbox with verification and publish parity", async () => {
    const before = projectWithGallery();
    const result = await runAtlasBrain({
      project: before,
      request:
        "I want to be able to view the entire picture when I click one of the photos.",
    });
    expect(result.applyStatus).toBe("applied");
    expect(result.explanation).toMatch(/full-screen viewer|complete photo/i);
    expect(readGalleryInteraction(result.project).mode).toBe("lightbox");
    expect(result.project.creativePolish?.serviceIcons).not.toBe(true);

    const artifact = buildStaticSite(result.project, {
      atlasOrigin: "https://atlas.example",
      projectId: "proj-1",
    });
    const html = artifact.files.find((f) => f.path === "index.html")?.content;
    const css = artifact.files.find((f) => f.path === "styles.css")?.content;
    expect(html).toMatch(/data-gallery-lightbox-trigger/);
    expect(html).toMatch(/data-atlas-gallery-lightbox/);
    expect(html).toMatch(/data-atlas-gallery-lightbox-runtime|data-lightbox-img/);
    expect(html).toMatch(/object-fit:\s*contain|atlas-lightbox-image/);
    expect(css).toMatch(/atlas-lightbox-image/);
    expect(css).toMatch(/object-fit:\s*contain/);
  });

  it("fails truthfully when a full-size asset is missing", () => {
    const broken = projectWithGallery({
      mediaLibrary: [
        asset({
          id: "a1",
          name: "x.jpg",
          title: "X",
          url: "",
          unavailable: true,
        }),
      ],
      galleryImageIds: ["a1", "", "", ""],
    });
    const planned = planGalleryLightboxOperations();
    const ops = validateEditOperations(planned.operations);
    const after = applyEditOperations(broken, ops).project;
    const check = verifyGalleryLightbox({
      before: broken,
      after,
      galleryAssetIds: after.galleryImageIds,
    });
    expect(check.verified).toBe(false);
    expect(check.failures.some((f) => f.startsWith("missing_full_size"))).toBe(
      true,
    );
  });

  it("refresh persistence keeps galleryInteraction", async () => {
    const result = await runAtlasBrain({
      project: projectWithGallery(),
      request: "Add a photo viewer.",
    });
    expect(result.project.galleryInteraction?.mode).toBe("lightbox");
    const content = generateWebsiteContent(result.project);
    expect(content.galleryInteraction?.mode).toBe("lightbox");
  });
});
