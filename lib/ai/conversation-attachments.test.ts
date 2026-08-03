import { describe, expect, it } from "vitest";
import {
  attachmentsToContext,
  createQueuedAttachment,
  formatAttachmentsForAgentPrompt,
  isAttachmentPlacementRequest,
  isComposerImageMime,
  toPersistedAttachment,
  validateComposerImageFile,
} from "@/lib/ai/conversation-attachments";

function fakeFile(
  name: string,
  type: string,
  size = 1024,
): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("conversation attachments", () => {
  it("accepts jpeg/png/webp and rejects others", () => {
    expect(isComposerImageMime("image/jpeg")).toBe(true);
    expect(isComposerImageMime("image/png")).toBe(true);
    expect(isComposerImageMime("image/webp")).toBe(true);
    expect(isComposerImageMime("image/gif")).toBe(false);
    expect(isComposerImageMime("application/pdf")).toBe(false);

    expect(validateComposerImageFile(fakeFile("a.jpg", "image/jpeg")).ok).toBe(
      true,
    );
    expect(validateComposerImageFile(fakeFile("a.gif", "image/gif")).ok).toBe(
      false,
    );
    expect(validateComposerImageFile(fakeFile("a.pdf", "application/pdf")).ok).toBe(
      false,
    );
  });

  it("rejects empty and oversized files", () => {
    const empty = fakeFile("empty.jpg", "image/jpeg", 0);
    expect(validateComposerImageFile(empty).ok).toBe(false);

    const huge = fakeFile("huge.jpg", "image/jpeg", 6 * 1024 * 1024);
    const result = validateComposerImageFile(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too large/i);
    }
  });

  it("never persists blob: URLs", () => {
    const file = fakeFile("hero.jpg", "image/jpeg");
    const queued = createQueuedAttachment({
      file,
      projectId: "proj-1",
      type: "image",
    });
    expect(queued.previewUrl?.startsWith("blob:") || !queued.previewUrl).toBe(
      true,
    );
    expect(toPersistedAttachment(queued)).toBeNull();

    const uploaded = {
      ...queued,
      status: "uploaded" as const,
      assetId: "asset-1",
      storagePath: "user/proj/file.jpg",
      previewUrl: "blob:http://localhost/x",
      localObjectUrl: "blob:http://localhost/x",
    };
    const persisted = toPersistedAttachment(uploaded);
    expect(persisted).not.toBeNull();
    expect(persisted?.previewUrl).toBeUndefined();
    expect(persisted?.localObjectUrl).toBeUndefined();
    expect(persisted?.assetId).toBe("asset-1");
  });

  it("builds attachment context aliases for the agent", () => {
    const contexts = attachmentsToContext([
      {
        id: "a1",
        type: "image",
        projectId: "p",
        assetId: "asset-a",
        filename: "one.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10,
        status: "uploaded",
        createdAt: new Date().toISOString(),
      },
      {
        id: "a2",
        type: "logo",
        projectId: "p",
        assetId: "asset-logo",
        filename: "logo.png",
        mimeType: "image/png",
        sizeBytes: 10,
        status: "uploaded",
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(contexts).toHaveLength(2);
    const prompt = formatAttachmentsForAgentPrompt(contexts);
    expect(prompt).toContain("attachment[0]");
    expect(prompt).toContain("logoAttachment");
    expect(prompt).toContain("asset-a");
  });

  it("detects attachment placement phrases", () => {
    expect(isAttachmentPlacementRequest("Use this as the hero image.")).toBe(
      true,
    );
    expect(isAttachmentPlacementRequest("Use this as our logo.")).toBe(true);
    expect(isAttachmentPlacementRequest("Add these to the gallery.")).toBe(
      true,
    );
    expect(isAttachmentPlacementRequest("Make the hero more modern")).toBe(
      false,
    );
  });
});
