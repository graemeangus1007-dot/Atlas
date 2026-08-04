/**
 * Persist Atlas AI Design Assistant conversation + revisions per project.
 * Conversation/meta also mirrors onto BusinessProject for Supabase autosave.
 * Full undo snapshots stay in localStorage (too large for content JSON).
 */

import type { DesignAssistantPersistedMeta } from "@/lib/ai/editor-assistant-types";
import type { EditChangeSummary } from "@/lib/ai/edit-operations";
import {
  createEmptyEditorConversation,
  type EditorConversation,
  type EditorConversationMessage,
} from "@/lib/ai/editor-conversation";
import {
  type EditorRevision,
  type EditorRevisionStack,
} from "@/lib/ai/editor-revisions";
import type { BusinessProject } from "@/types/business-project";

export type { DesignAssistantPersistedMeta };

export type DesignAssistantLocalStore = DesignAssistantPersistedMeta & {
  /** Full undo/redo snapshots for this browser. */
  snapshots: Array<{
    id: string;
    before: BusinessProject;
    after: BusinessProject;
  }>;
};

const STORAGE_PREFIX = "atlas:design-assistant:v1:";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function createEmptyDesignAssistantMeta(): DesignAssistantPersistedMeta {
  return {
    version: 1,
    conversation: createEmptyEditorConversation(),
    revisions: [],
    revisionIndex: -1,
    lastChanges: null,
    updatedAt: new Date().toISOString(),
  };
}

export function readDesignAssistantLocal(
  projectId: string | null | undefined,
): DesignAssistantLocalStore | null {
  if (!projectId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignAssistantLocalStore;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDesignAssistantLocal(
  projectId: string | null | undefined,
  store: DesignAssistantLocalStore,
): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(store));
  } catch {
    // Quota / private mode — conversation still lives on the project for autosave.
  }
}

export function buildDesignAssistantMeta(input: {
  conversation: EditorConversation;
  revisionStack: EditorRevisionStack;
  lastChanges: EditChangeSummary[] | null;
}): DesignAssistantPersistedMeta {
  return {
    version: 1,
    conversation: {
      messages: input.conversation.messages.map(slimMessage),
    },
    revisions: input.revisionStack.revisions.map((rev) => ({
      id: rev.id,
      createdAt: rev.createdAt,
      prompt: rev.prompt,
      changes: rev.changes,
      operations: rev.operations,
    })),
    revisionIndex: input.revisionStack.index,
    lastChanges: input.lastChanges,
    updatedAt: new Date().toISOString(),
  };
}

function slimMessage(message: EditorConversationMessage): EditorConversationMessage {
  const attachments = message.attachments
    ?.map((att) => ({
      id: att.id,
      type: att.type === "document" ? ("image" as const) : att.type,
      projectId: att.projectId,
      assetId: att.assetId,
      storagePath: att.storagePath,
      filename: att.filename,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      width: att.width,
      height: att.height,
      altText: att.altText,
      status: att.status,
      createdAt: att.createdAt,
      // Never persist ephemeral blob: / local object URLs.
    }))
    .filter((att) => att.status === "uploaded" && Boolean(att.assetId));

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.changes ? { changes: message.changes } : {}),
    ...(message.operations ? { operations: message.operations } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
}

export function toLocalStore(
  meta: DesignAssistantPersistedMeta,
  stack: EditorRevisionStack,
): DesignAssistantLocalStore {
  return {
    ...meta,
    snapshots: stack.revisions.map((rev) => ({
      id: rev.id,
      before: rev.before,
      after: rev.after,
    })),
  };
}

/**
 * Restore conversation + revision stack from project meta and/or localStorage.
 * Prefer the newer updatedAt; always prefer local snapshots for undo when present.
 */
export function restoreDesignAssistantState(input: {
  projectId: string | null;
  projectMeta?: DesignAssistantPersistedMeta | null;
}): {
  conversation: EditorConversation;
  revisionStack: EditorRevisionStack;
  lastChanges: EditChangeSummary[] | null;
} {
  const local = readDesignAssistantLocal(input.projectId);
  const fromProject = input.projectMeta?.version === 1 ? input.projectMeta : null;

  let meta: DesignAssistantPersistedMeta =
    fromProject ?? local ?? createEmptyDesignAssistantMeta();

  if (fromProject && local) {
    const projectTs = Date.parse(fromProject.updatedAt || "") || 0;
    const localTs = Date.parse(local.updatedAt || "") || 0;
    meta = localTs > projectTs ? local : fromProject;
  }

  const snapshotMap = new Map(
    (local?.snapshots ?? []).map((s) => [s.id, s] as const),
  );

  const revisions: EditorRevision[] = meta.revisions.map((entry) => {
    const snap = snapshotMap.get(entry.id);
    const placeholder = {
      // Undo without snapshot falls back to current project at call time;
      // keep a typed shell so stack shape stays valid.
    } as BusinessProject;
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      prompt: entry.prompt,
      changes: entry.changes,
      operations: entry.operations,
      before: snap?.before ?? placeholder,
      after: snap?.after ?? placeholder,
    };
  });

  const index = Math.min(
    Math.max(meta.revisionIndex, -1),
    revisions.length - 1,
  );

  return {
    conversation: meta.conversation?.messages
      ? { messages: meta.conversation.messages }
      : createEmptyEditorConversation(),
    revisionStack: {
      revisions,
      index: revisions.length === 0 ? -1 : index,
    },
    lastChanges: meta.lastChanges ?? null,
  };
}

/** Compare fields the Design Assistant is allowed to change. */
export function hasMeaningfulProjectDiff(
  before: BusinessProject,
  after: BusinessProject,
): boolean {
  const pick = (p: BusinessProject) => ({
    businessName: p.businessName,
    businessType: p.businessType,
    description: p.description,
    heroEyebrow: p.heroEyebrow ?? "",
    heroHeadline: p.heroHeadline,
    heroSubheadline: p.heroSubheadline,
    primaryCta: p.primaryCta,
    secondaryCta: p.secondaryCta ?? "",
    aboutTitle: p.aboutTitle ?? "",
    services: p.services,
    contact: {
      title: p.contact.title,
      description: p.contact.description,
      buttonText: p.contact.buttonText ?? "",
    },
    seo: p.seo
      ? {
          siteTitle: p.seo.siteTitle,
          metaDescription: p.seo.metaDescription,
          socialTitle: p.seo.socialTitle,
          socialDescription: p.seo.socialDescription,
          robotsIndex: p.seo.robotsIndex,
        }
      : null,
    templateId: p.templateId,
    primaryColor: p.primaryColor,
    secondaryColor: p.secondaryColor,
    accentColor: p.accentColor,
    backgroundColor: p.backgroundColor,
    headingFont: p.headingFont,
    bodyFont: p.bodyFont,
    buttonStyle: p.buttonStyle,
    heroOverlay: p.heroOverlay,
    siteWidth: p.siteWidth,
    theme: p.theme,
    pages: p.pages.map((page) => ({ id: page.id, title: page.title })),
    designSections: p.designSections ?? null,
    // Sprint 24.0A — Visual Designer image assignments
    heroImageId: p.heroImageId ?? null,
    galleryImageIds: p.galleryImageIds ?? [],
    sectionImages: p.sectionImages ?? null,
    sectionOrder: p.sectionOrder ?? null,
    logoAssetId: p.logoAssetId ?? null,
    logo: p.logo ?? null,
    // Sprint 25.0A — Creative Director polish
    creativePolish: p.creativePolish ?? null,
    // Sprint 27.0A — Design System Intelligence
    designSystem: p.designSystem ?? null,
    // v1.3 — Gallery lightbox / interaction
    galleryInteraction: p.galleryInteraction ?? null,
    heroImagePresentation: p.heroImagePresentation ?? null,
    heroTreatment: p.heroTreatment ?? null,
  });

  return JSON.stringify(pick(before)) !== JSON.stringify(pick(after));
}

export function logDesignAssistantDiagnostic(input: {
  requestId: string;
  projectId: string | null;
  operationCount: number;
  applyResult: "applied" | "no_changes" | "failed";
  ok: boolean;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  console.info("[atlas.ai.edit]", {
    requestId: input.requestId,
    projectId: input.projectId ? "[set]" : null,
    operationCount: input.operationCount,
    applyResult: input.applyResult,
    ok: input.ok,
  });
}
