/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasComposer from "@/components/editor/atlas-composer";
import type { ConversationAttachment } from "@/lib/ai/conversation-attachments";

vi.mock("@/components/ui/button", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

function uploaded(id: string): ConversationAttachment {
  return {
    id,
    type: "image",
    projectId: "p1",
    assetId: `asset-${id}`,
    storagePath: `user/p1/${id}.jpg`,
    filename: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1000,
    status: "uploaded",
    createdAt: new Date().toISOString(),
    previewUrl: `https://example.com/${id}.jpg`,
  };
}

describe("AtlasComposer attachments", () => {
  it("opens and closes the attach menu with keyboard", async () => {
    render(
      <AtlasComposer
        draft=""
        onDraftChange={() => {}}
        onSubmit={() => {}}
        sending={false}
        onUploadPhotos={() => {}}
        onUploadLogo={() => {}}
        onAttachExisting={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
      />,
    );

    const plus = screen.getByTestId("composer-attach-button");
    plus.focus();
    fireEvent.click(plus);
    expect(screen.getByTestId("composer-attach-menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("composer-attach-menu")).toBeNull();
    });
  });

  it("opens file picker for upload photo", () => {
    const onUploadPhotos = vi.fn();
    render(
      <AtlasComposer
        draft=""
        onDraftChange={() => {}}
        onSubmit={() => {}}
        sending={false}
        onUploadPhotos={onUploadPhotos}
        onUploadLogo={() => {}}
        onAttachExisting={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("composer-attach-button"));
    fireEvent.click(screen.getByTestId("composer-attach-upload-photo"));
    const input = screen.getByTestId("composer-photo-input") as HTMLInputElement;
    const file = new File([new Uint8Array(8)], "photo.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUploadPhotos).toHaveBeenCalledWith([file]);
  });

  it("shows attachment tray and removes before send", () => {
    const onRemove = vi.fn();
    const onSubmit = vi.fn();
    render(
      <AtlasComposer
        draft="Use this as the hero image."
        onDraftChange={() => {}}
        onSubmit={onSubmit}
        sending={false}
        attachments={[uploaded("one")]}
        onUploadPhotos={() => {}}
        onRemoveAttachment={onRemove}
        onRetryAttachment={() => {}}
        attachmentsReady
      />,
    );
    expect(screen.getByTestId("composer-attachment-tray")).toBeTruthy();
    fireEvent.click(screen.getByTestId("composer-attachment-remove-one"));
    expect(onRemove).toHaveBeenCalledWith("one");
  });

  it("blocks send while attachments are uploading", () => {
    const onSubmit = vi.fn();
    render(
      <AtlasComposer
        draft="Use this as the hero image."
        onDraftChange={() => {}}
        onSubmit={onSubmit}
        sending={false}
        attachments={[
          {
            ...uploaded("one"),
            status: "uploading",
            assetId: undefined,
          },
        ]}
        onUploadPhotos={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
        attachmentsReady={false}
        attachmentsUploading
      />,
    );
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ingests dropped files on the composer", () => {
    const onIngest = vi.fn();
    render(
      <AtlasComposer
        draft="keep typing"
        onDraftChange={() => {}}
        onSubmit={() => {}}
        sending={false}
        onUploadPhotos={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
        onIngestFiles={onIngest}
      />,
    );
    const region = screen.getByTestId("atlas-prompt-region");
    const file = new File([new Uint8Array(8)], "drop.jpg", {
      type: "image/jpeg",
    });
    fireEvent.drop(region, {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    expect(onIngest).toHaveBeenCalled();
    expect(screen.getByTestId("atlas-prompt-input")).toHaveProperty(
      "value",
      "keep typing",
    );
  });

  it("pastes clipboard images without dropping typed draft", () => {
    const onIngest = vi.fn();
    const onDraftChange = vi.fn();
    render(
      <AtlasComposer
        draft="Hello "
        onDraftChange={onDraftChange}
        onSubmit={() => {}}
        sending={false}
        onUploadPhotos={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
        onIngestFiles={onIngest}
      />,
    );
    const input = screen.getByTestId("atlas-prompt-input");
    const file = new File([new Uint8Array(8)], "clip.png", {
      type: "image/png",
    });
    const item = {
      kind: "file",
      type: "image/png",
      getAsFile: () => file,
    };
    fireEvent.paste(input, {
      clipboardData: {
        items: [item],
        getData: () => "",
      },
    });
    expect(onIngest).toHaveBeenCalled();
  });

  it("opens choose existing picker", () => {
    render(
      <AtlasComposer
        draft=""
        onDraftChange={() => {}}
        onSubmit={() => {}}
        sending={false}
        onUploadPhotos={() => {}}
        onUploadLogo={() => {}}
        onAttachExisting={() => {}}
        onRemoveAttachment={() => {}}
        onRetryAttachment={() => {}}
        projectMedia={[
          {
            id: "m1",
            name: "Existing.jpg",
            filename: "Existing.jpg",
            url: "https://example.com/e.jpg",
            storagePath: "u/p/e.jpg",
            mimeType: "image/jpeg",
            size: 10,
            sizeLabel: "10 B",
            createdAt: 1,
            title: "Existing",
            description: "",
            alt: "Existing",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("composer-attach-button"));
    fireEvent.click(screen.getByTestId("composer-attach-choose-existing"));
    expect(screen.getByTestId("composer-existing-image-picker")).toBeTruthy();
  });
});
