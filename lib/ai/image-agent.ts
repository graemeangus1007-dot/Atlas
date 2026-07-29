/**
 * Atlas Visual Designer — Image Agent (Sprint 24.0A).
 * Natural language → validated image operations → updated project.
 * Never mutates project JSON directly; never returns arbitrary code.
 *
 * Future (24.0B): drag-drop uploads, generation, crop, style transfer plug into
 * the same ImageOperation model without changing apply/validate.
 */

import { applyImageOperations } from "@/lib/ai/apply-image-operations";
import { hasMeaningfulProjectDiff } from "@/lib/ai/editor-assistant-persistence";
import type {
  ImageChangeSummary,
  ImageOperation,
  ImagePlaceholderKind,
  ImageRelativePosition,
  ImageTargetRef,
  SectionImageSlot,
} from "@/lib/ai/image-operations";
import { validateImageOperations } from "@/lib/ai/validate-image-operations";
import { AiError } from "@/lib/ai/errors";
import { imageryKeywordsForProject } from "@/lib/ai/design-system-intelligence";
import type { BusinessProject } from "@/types/business-project";
import type { MediaAsset } from "@/types/media";
import { GALLERY_SLOT_COUNT } from "@/types/media";

export type ImageAgentHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

/** Lightweight editor cues for resolving “this / that / previous”. */
export type ImageEditorState = {
  lastImageRef?: ImageTargetRef | null;
  selectedImageRef?: ImageTargetRef | null;
};

export type ImageAgentInput = {
  project: BusinessProject;
  request: string;
  history?: ImageAgentHistoryItem[];
  editorState?: ImageEditorState | null;
};

export type ImageAgentApplyStatus =
  | "applied"
  | "no_changes"
  | "needs_clarification";

export type ImageAgentResult = {
  ok: true;
  explanation: string;
  operations: ImageOperation[];
  changes: ImageChangeSummary[];
  project: BusinessProject;
  applyStatus: ImageAgentApplyStatus;
  /** Updated cue for follow-up conversational references. */
  editorState?: ImageEditorState;
};

export type ImageAgentFailure = {
  ok: false;
  code: string;
  message: string;
};

export type ImagePlanResult = {
  operations: ImageOperation[];
  explanation: string;
  needsClarification?: boolean;
  editorState?: ImageEditorState;
};

const IMAGE_INTENT =
  /\b(image|images|photo|photos|picture|pictures|gallery|logo|hero\s+image|placeholder|storefront|team\s+photo|bakery\s+photo)\b/i;

const IMAGE_ACTION =
  /\b(replace|swap|change|use|put|place|move|remove|delete|clear|insert|add|set)\b/i;

/** True when the request should be handled by the Image Agent. */
export function isImageEditRequest(request: string): boolean {
  const text = request.trim();
  if (!text) return false;

  // Copy / text edits — never Visual Designer (even if they mention “hero”).
  if (
    /\b(headline|subheadline|button\s+text|cta|faq|question|answer|eyebrow)\b/i.test(
      text,
    ) &&
    !/\b(image|photo|picture|logo|placeholder)\b/i.test(text)
  ) {
    return false;
  }

  if (IMAGE_INTENT.test(text) && IMAGE_ACTION.test(text)) return true;
  if (/\b(replace|remove|clear)\s+(every\s+)?placeholder/i.test(text)) {
    return true;
  }
  // Bare hero/gallery/logo only with clear visual verbs — not “make the hero modern”.
  if (
    /\b(replace|swap|remove|delete|clear)\s+(?:the\s+)?(hero|gallery|logo)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\b(use|set|put)\s+(?:our\s+|the\s+)?logo\b/i.test(text)) return true;
  if (/\bmove\s+(?:the\s+)?gallery\b/i.test(text)) return true;
  return false;
}

function recentContext(history: ImageAgentHistoryItem[]): string {
  return history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .toLowerCase();
}

function findLibraryAsset(
  library: MediaAsset[],
  hint: string,
  styleKeywords: string[] = [],
): MediaAsset | null {
  const needle = hint.toLowerCase().replace(/['"]/g, "").trim();
  if (!needle && styleKeywords.length === 0) return null;
  const scored = library
    .filter((asset) => !asset.unavailable)
    .map((asset) => {
      const hay = `${asset.title} ${asset.name} ${asset.alt} ${asset.description}`.toLowerCase();
      let score = 0;
      if (needle) {
        if (hay === needle) score = 100;
        else if (hay.includes(needle)) score = 80;
        else {
          const parts = needle.split(/\s+/).filter(Boolean);
          const hits = parts.filter((p) => hay.includes(p)).length;
          score = hits * 20;
        }
      }
      // Sprint 27.0A — bias toward Design System imagery language
      for (const keyword of styleKeywords) {
        const k = keyword.toLowerCase().trim();
        if (k && hay.includes(k)) score += 12;
      }
      return { asset, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.asset ?? null;
}

function firstLibraryAsset(project: BusinessProject): MediaAsset | null {
  return project.mediaLibrary.find((asset) => !asset.unavailable) ?? null;
}

function parseGalleryIndex(text: string): number | null {
  if (/\bfirst\b/.test(text)) return 0;
  if (/\bsecond\b/.test(text)) return 1;
  if (/\bthird\b/.test(text)) return 2;
  if (/\bfourth\b/.test(text)) return 3;
  const num = text.match(/\bgallery\s*(?:image\s*)?#?(\d+)\b/);
  if (num?.[1]) {
    const n = Number.parseInt(num[1], 10);
    if (n >= 1 && n <= GALLERY_SLOT_COUNT) return n - 1;
  }
  return null;
}

function parseSectionSlot(text: string): SectionImageSlot | null {
  if (/\babout\b/.test(text)) return "about";
  if (/\bservices?\b/.test(text)) return "services";
  if (/\bcontact\b/.test(text)) return "contact";
  if (/\bteam\b/.test(text)) return "team";
  if (/\btestimonials?\b/.test(text)) return "testimonials";
  if (/\bfeatures?\b/.test(text)) return "features";
  if (/\bhero\b/.test(text)) return "hero";
  if (/\bgallery\b/.test(text)) return "gallery";
  return null;
}

function parseRelativePosition(
  text: string,
): { position: ImageRelativePosition; relativeTo?: string } | null {
  if (/\bat\s+the\s+top\b|\bto\s+the\s+top\b/.test(text)) {
    return { position: "top" };
  }
  if (/\bat\s+the\s+bottom\b|\bto\s+the\s+bottom\b/.test(text)) {
    return { position: "bottom" };
  }
  const above = text.match(
    /\b(?:above|before)\s+(?:the\s+)?(about|services|contact|hero|gallery|testimonials|faq|features|team)\b/,
  );
  if (above?.[1]) {
    return { position: "above", relativeTo: above[1] };
  }
  const below = text.match(
    /\b(?:below|after|under)\s+(?:the\s+)?(about|services|contact|hero|gallery|testimonials|faq|features|team)\b/,
  );
  if (below?.[1]) {
    return { position: "below", relativeTo: below[1] };
  }
  const nextTo = text.match(
    /\b(?:next\s+to|beside|alongside)\s+(?:the\s+)?(about|services|contact|hero|gallery|testimonials|faq|features|team)\b/,
  );
  if (nextTo?.[1]) {
    return { position: "next_to", relativeTo: nextTo[1] };
  }
  const between = text.match(
    /\bbetween\s+(?:the\s+)?(hero|about|services|gallery|contact)\s+and\s+(?:the\s+)?(hero|about|services|gallery|contact|testimonials|faq)\b/,
  );
  if (between?.[2]) {
    return { position: "after", relativeTo: between[1] };
  }
  return null;
}

function resolveConversationalTarget(
  text: string,
  editorState?: ImageEditorState | null,
  history: ImageAgentHistoryItem[] = [],
): ImageTargetRef | null {
  if (/\b(this|that|the\s+previous)\s+(image|picture|photo)\b/.test(text)) {
    return (
      editorState?.selectedImageRef ??
      editorState?.lastImageRef ??
      inferLastFromHistory(history)
    );
  }
  if (/\bhero\b/.test(text)) return { kind: "hero" };
  if (/\blogo\b/.test(text)) return { kind: "logo" };
  const gIdx = parseGalleryIndex(text);
  if (gIdx !== null && /\bgallery\b/.test(text)) {
    return { kind: "gallery", index: gIdx };
  }
  if (/\b(first|1st)\s+(image|picture|photo)\b/.test(text)) {
    return { kind: "ordinal", ordinal: 1 };
  }
  if (/\b(second|2nd)\s+(image|picture|photo)\b/.test(text)) {
    return { kind: "ordinal", ordinal: 2 };
  }
  const section = parseSectionSlot(text);
  if (section && /\b(image|photo|picture)\b/.test(text)) {
    return { kind: "section", section };
  }
  return null;
}

function inferLastFromHistory(
  history: ImageAgentHistoryItem[],
): ImageTargetRef | null {
  const blob = recentContext(history);
  if (/\bhero\b/.test(blob)) return { kind: "hero" };
  if (/\bgallery\b/.test(blob)) return { kind: "gallery", index: 0 };
  if (/\blogo\b/.test(blob)) return { kind: "logo" };
  return null;
}

function extractAssetHint(request: string): string | null {
  const withPhoto = request.match(
    /\b(?:with|using|of)\s+(?:a\s+|an\s+|the\s+)?(?:picture\s+of\s+|photo\s+of\s+)?["']?([^"'\n.]+)["']?\s*$/i,
  );
  if (withPhoto?.[1]) return withPhoto[1].trim();
  const replaceWith = request.match(
    /\breplace\b[\s\S]+?\bwith\s+(?:a\s+|an\s+|the\s+)?(?:picture\s+of\s+|photo\s+of\s+)?["']?([^"'\n.]+)["']?/i,
  );
  if (replaceWith?.[1]) return replaceWith[1].trim();
  const useOur = request.match(
    /\buse\s+(?:our\s+|the\s+)?["']?([^"'\n.]+?)["']?\s+(?:in|for|as)\b/i,
  );
  if (useOur?.[1]) return useOur[1].trim();
  return null;
}

function requireAssetOrClarify(
  project: BusinessProject,
  hint: string | null,
): { asset: MediaAsset } | { clarify: string } {
  const styleKeywords = imageryKeywordsForProject(project);
  if (hint) {
    const found = findLibraryAsset(project.mediaLibrary, hint, styleKeywords);
    if (found) return { asset: found };
    const fallback = firstLibraryAsset(project);
    if (fallback && /this|that|it|our\s+image|the\s+image/i.test(hint)) {
      return { asset: fallback };
    }
    if (!project.mediaLibrary.length) {
      return {
        clarify:
          "I don’t see any images in your media library yet. Upload a photo first, then ask me to place it.",
      };
    }
    return {
      clarify: `I couldn’t find “${hint}” in your library. Which image should I use?`,
    };
  }
  const styled = findLibraryAsset(project.mediaLibrary, "", styleKeywords);
  const fallback = styled ?? firstLibraryAsset(project);
  if (!fallback) {
    return {
      clarify:
        "I don’t see any images in your media library yet. Upload a photo first, then ask me to place it.",
    };
  }
  return { asset: fallback };
}

/**
 * Plan structured image operations from a natural-language request.
 */
export function planImageOperations(input: ImageAgentInput): ImagePlanResult {
  const request = input.request.trim();
  if (!request) {
    throw new AiError("bad_request", "An image request is required.");
  }

  const text = request.toLowerCase();
  const history = input.history ?? [];
  const operations: ImageOperation[] = [];
  const notes: string[] = [];
  let editorState: ImageEditorState = {
    lastImageRef: input.editorState?.lastImageRef ?? null,
    selectedImageRef: input.editorState?.selectedImageRef ?? null,
  };

  // --- Move gallery ---
  if (/\bmove\b/.test(text) && /\bgallery\b/.test(text)) {
    const rel = parseRelativePosition(text);
    if (!rel) {
      return {
        operations: [],
        explanation:
          "Where should I move the gallery — above About, below Services, or to the top?",
        needsClarification: true,
      };
    }
    operations.push({
      operation: "moveGallery",
      position: rel.position,
      ...(rel.relativeTo
        ? {
            relativeTo: rel.relativeTo as Extract<
              ImageOperation,
              { operation: "moveGallery" }
            >["relativeTo"],
          }
        : {}),
    });
    notes.push(
      rel.relativeTo
        ? `I moved your gallery ${rel.position.replace("_", " ")} ${rel.relativeTo}.`
        : `I moved your gallery to the ${rel.position} of the page.`,
    );
    editorState = { ...editorState, lastImageRef: { kind: "gallery", index: 0 } };
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Remove / delete ---
  if (/\b(remove|delete|clear)\b/.test(text) && IMAGE_INTENT.test(text)) {
    const target =
      resolveConversationalTarget(text, input.editorState, history) ??
      (/\bplaceholder\b/.test(text)
        ? ({ kind: "placeholder", placeholder: "hero" } as const)
        : null);
    if (!target) {
      return {
        operations: [],
        explanation:
          "Which image should I remove — the hero image or the first gallery image?",
        needsClarification: true,
      };
    }
    if (target.kind === "section") {
      operations.push({
        operation: "removeSectionImage",
        section: target.section,
      });
    } else {
      operations.push({ operation: "deleteImage", target });
    }
    notes.push("I removed that image.");
    editorState = { ...editorState, lastImageRef: target, selectedImageRef: null };
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Logo ---
  if (/\blogo\b/.test(text) && /\b(use|set|put|replace|add)\b/.test(text)) {
    const hint = extractAssetHint(request) ?? "logo";
    const resolved = requireAssetOrClarify(input.project, hint);
    if ("clarify" in resolved) {
      return {
        operations: [],
        explanation: resolved.clarify,
        needsClarification: true,
      };
    }
    operations.push({ operation: "setLogo", assetId: resolved.asset.id });
    notes.push("I updated the logo.");
    editorState = { ...editorState, lastImageRef: { kind: "logo" } };
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Replace every placeholder ---
  if (/\breplace\b/.test(text) && /\bevery\s+placeholder|all\s+placeholders?\b/.test(text)) {
    const resolved = requireAssetOrClarify(
      input.project,
      extractAssetHint(request),
    );
    if ("clarify" in resolved) {
      return {
        operations: [],
        explanation: resolved.clarify,
        needsClarification: true,
      };
    }
    operations.push({
      operation: "replacePlaceholder",
      placeholder: "all",
      assetId: resolved.asset.id,
    });
    notes.push("I replaced every placeholder image.");
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Replace / put named placeholders ---
  if (
    /\b(replace|swap|change)\b/.test(text) &&
    /\bplaceholder\b/.test(text)
  ) {
    let placeholder: ImagePlaceholderKind | "all" = "hero";
    if (/\bgallery\b/.test(text)) {
      const idx = parseGalleryIndex(text) ?? 0;
      placeholder = `gallery-${idx}` as ImagePlaceholderKind;
    } else if (/\bteam\b/.test(text)) placeholder = "team";
    else if (/\btestimonial\b/.test(text)) placeholder = "testimonial";
    else if (/\bhero\b/.test(text)) placeholder = "hero";

    const resolved = requireAssetOrClarify(
      input.project,
      extractAssetHint(request),
    );
    if ("clarify" in resolved) {
      return {
        operations: [],
        explanation: resolved.clarify,
        needsClarification: true,
      };
    }
    operations.push({
      operation: "replacePlaceholder",
      placeholder,
      assetId: resolved.asset.id,
    });
    notes.push("I replaced the placeholder image.");
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Move image between slots ---
  if (/\bmove\b/.test(text) && /\b(image|picture|photo)\b/.test(text)) {
    const from =
      resolveConversationalTarget(text, input.editorState, history) ??
      (/\bfirst\b/.test(text) ? ({ kind: "ordinal", ordinal: 1 } as const) : null);
    const toSection = parseSectionSlot(text);
    const toGallery = parseGalleryIndex(text);
    let to: ImageTargetRef | null = null;
    if (/\bbelow\s+services\b/.test(text) || toSection === "services") {
      // Interpret “below Services” as gallery slot after services visually via moveGallery
      // for a single image, park it in gallery index 0 and move gallery below services.
      to = { kind: "gallery", index: 0 };
    } else if (toGallery !== null) {
      to = { kind: "gallery", index: toGallery };
    } else if (toSection) {
      to = { kind: "section", section: toSection };
    }
    if (!from || !to) {
      return {
        operations: [],
        explanation:
          "Which image should I move, and where — for example, the first image below Services?",
        needsClarification: true,
      };
    }
    operations.push({ operation: "moveImage", from, to });
    const rel = parseRelativePosition(text);
    if (rel && to.kind === "gallery") {
      operations.push({
        operation: "moveGallery",
        position: rel.position,
        ...(rel.relativeTo
          ? {
              relativeTo: rel.relativeTo as Extract<
                ImageOperation,
                { operation: "moveGallery" }
              >["relativeTo"],
            }
          : {}),
      });
    }
    notes.push("I moved that image.");
    editorState = { ...editorState, lastImageRef: to };
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Put / place image next to section ---
  if (/\b(put|place|add|insert)\b/.test(text) && IMAGE_INTENT.test(text)) {
    const resolved = requireAssetOrClarify(
      input.project,
      extractAssetHint(request) ??
        (/\bteam\s+photo\b/.test(text) ? "team" : null),
    );
    if ("clarify" in resolved) {
      return {
        operations: [],
        explanation: resolved.clarify,
        needsClarification: true,
      };
    }
    const section =
      parseSectionSlot(text) ??
      (/\bhomepage\b|\bhome\s+page\b/.test(text) ? "hero" : null);
    const rel = parseRelativePosition(text);
    if (section === "hero" || /\bhomepage\b|\bhome\s+page\b/.test(text)) {
      operations.push({
        operation: "replaceHeroImage",
        assetId: resolved.asset.id,
      });
      notes.push("I put that image on the homepage hero.");
      editorState = { ...editorState, lastImageRef: { kind: "hero" } };
      return { operations, explanation: notes.join(" "), editorState };
    }
    if (section && section !== "gallery") {
      operations.push({
        operation: "setSectionImage",
        section,
        assetId: resolved.asset.id,
      });
      notes.push(
        rel?.relativeTo
          ? `I placed the image ${rel.position.replace("_", " ")} the ${rel.relativeTo} section.`
          : `I updated the ${section} image.`,
      );
      editorState = {
        ...editorState,
        lastImageRef: { kind: "section", section },
      };
      return { operations, explanation: notes.join(" "), editorState };
    }
    const gIdx = parseGalleryIndex(text) ?? 0;
    operations.push({
      operation: "insertImage",
      assetId: resolved.asset.id,
      galleryIndex: gIdx,
    });
    notes.push("I added that image to the gallery.");
    editorState = {
      ...editorState,
      lastImageRef: { kind: "gallery", index: gIdx },
    };
    return { operations, explanation: notes.join(" "), editorState };
  }

  // --- Replace hero / gallery / section image ---
  if (/\b(replace|swap|change|update)\b/.test(text)) {
    const resolved = requireAssetOrClarify(
      input.project,
      extractAssetHint(request),
    );
    if ("clarify" in resolved) {
      return {
        operations: [],
        explanation: resolved.clarify,
        needsClarification: true,
      };
    }

    if (/\bhero\b/.test(text)) {
      operations.push({
        operation: "replaceHeroImage",
        assetId: resolved.asset.id,
      });
      notes.push("I replaced the hero image.");
      editorState = { ...editorState, lastImageRef: { kind: "hero" } };
      return { operations, explanation: notes.join(" "), editorState };
    }

    if (/\bgallery\b/.test(text)) {
      const idx = parseGalleryIndex(text) ?? 0;
      operations.push({
        operation: "replaceGalleryImage",
        index: idx,
        assetId: resolved.asset.id,
      });
      notes.push(`I replaced gallery image ${idx + 1}.`);
      editorState = {
        ...editorState,
        lastImageRef: { kind: "gallery", index: idx },
      };
      return { operations, explanation: notes.join(" "), editorState };
    }

    const section = parseSectionSlot(text);
    if (section) {
      operations.push({
        operation: "replaceSectionImage",
        section,
        assetId: resolved.asset.id,
      });
      notes.push(`I updated the ${section} image.`);
      editorState = {
        ...editorState,
        lastImageRef: { kind: "section", section },
      };
      return { operations, explanation: notes.join(" "), editorState };
    }

    // Ambiguous replace
    return {
      operations: [],
      explanation:
        "Which image did you mean? The hero image or the first gallery image?",
      needsClarification: true,
    };
  }

  return {
    operations: [],
    explanation:
      "Tell me what to do with an image — for example, “Replace the hero image” or “Move the gallery above Testimonials.”",
    needsClarification: true,
  };
}

/**
 * Plan → validate → apply image operations.
 */
export function runImageAgent(input: ImageAgentInput): ImageAgentResult {
  const request = input.request?.trim();
  if (!request) {
    throw new AiError("bad_request", "An image request is required.");
  }
  if (!input.project || typeof input.project !== "object") {
    throw new AiError("bad_request", "A current project is required.");
  }

  const planned = planImageOperations(input);
  if (planned.needsClarification || planned.operations.length === 0) {
    return {
      ok: true,
      explanation: planned.explanation,
      operations: [],
      changes: [],
      project: input.project,
      applyStatus: planned.needsClarification
        ? "needs_clarification"
        : "no_changes",
      editorState: planned.editorState,
    };
  }

  const operations = validateImageOperations(
    planned.operations,
    input.project,
  );
  const applied = applyImageOperations(input.project, operations);
  const changed = hasMeaningfulProjectDiff(input.project, applied.project);

  return {
    ok: true,
    explanation: changed
      ? planned.explanation
      : "No changes needed — the images already matched that request.",
    operations: changed ? operations : [],
    changes: changed ? applied.changes : [],
    project: changed ? applied.project : input.project,
    applyStatus: changed ? "applied" : "no_changes",
    editorState: planned.editorState,
  };
}

export function tryRunImageAgent(
  input: ImageAgentInput,
): ImageAgentResult | ImageAgentFailure {
  try {
    return runImageAgent(input);
  } catch (error) {
    if (error instanceof AiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: "provider_error",
      message: "Atlas AI could not apply that image request. Please try again.",
    };
  }
}
