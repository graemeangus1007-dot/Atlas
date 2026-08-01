/**
 * DesignCritique → validated EditOperation / ImageOperation[] (Sprint 28.0A).
 * Never trusts LLM JSON — validates kinds and clamps values.
 */

import type {
  CritiqueImprovement,
  DesignCritique,
  ProposedChange,
  ProposedChangeKind,
} from "@/lib/ai/design-critique-types";
import { PROPOSED_CHANGE_KINDS } from "@/lib/ai/design-critique-types";
import type {
  CreativeDirectorRecommendation,
  CritiqueSupportStatus,
  CreativeRecommendationKind,
} from "@/lib/ai/creative-director-types";
import { matchPrinciplesToText } from "@/lib/ai/design-knowledge";
import { sanitizeDesignKnowledgeUserText } from "@/lib/ai/design-knowledge/explain";
import {
  EDIT_TEXT_TARGETS,
  INSERTABLE_SECTION_TYPES,
  type EditOperation,
  type EditTextTarget,
  type InsertableSectionType,
} from "@/lib/ai/edit-operations";
import type { ImageOperation } from "@/lib/ai/image-operations";
import { SECTION_IMAGE_SLOTS } from "@/lib/ai/image-operations";
import { validateEditOperations } from "@/lib/ai/validate-edit-operations";
import { validateImageOperations } from "@/lib/ai/validate-image-operations";
import {
  BODY_FONTS,
  BUTTON_STYLES,
  HEADING_FONTS,
  SITE_THEMES,
  SITE_WIDTHS,
  type BodyFontId,
  type ButtonStyleId,
  type HeadingFontId,
  type SiteThemeId,
  type SiteWidthId,
} from "@/data/design-options";
import { isEditOperationKind } from "@/lib/ai/edit-operations";
import { isImageOperationKind } from "@/lib/ai/image-operations";
import type { TemplateId } from "@/lib/templates/types";
import { TEMPLATE_IDS } from "@/lib/templates/types";
import type { BusinessProject } from "@/types/business-project";
import { sanitizePlainText } from "@/lib/leads/sanitize";

const KIND_SET = new Set<string>(PROPOSED_CHANGE_KINDS);
const TEXT_TARGET_SET = new Set<string>(EDIT_TEXT_TARGETS);
const SECTION_SET = new Set<string>(INSERTABLE_SECTION_TYPES);
const HEADING_SET = new Set<string>(HEADING_FONTS.map((f) => f.id));
const BODY_SET = new Set<string>(BODY_FONTS.map((f) => f.id));
const BUTTON_SET = new Set<string>(BUTTON_STYLES.map((f) => f.id));
const WIDTH_SET = new Set<string>(SITE_WIDTHS.map((f) => f.id));
const THEME_SET = new Set<string>(SITE_THEMES.map((f) => f.id));
const SLOT_SET = new Set<string>(SECTION_IMAGE_SLOTS);
const TEMPLATE_SET = new Set<string>(TEMPLATE_IDS as readonly string[]);

function text(value: string, max: number): string {
  return sanitizePlainText(value ?? "", { maxLength: max, trimEnds: true });
}

function nonempty(value: string): boolean {
  return Boolean(value && value.trim());
}

function mapImpactScore(impact: "high" | "medium" | "low"): number {
  if (impact === "high") return 90;
  if (impact === "medium") return 70;
  return 45;
}

function inferKind(areas: string[]): CreativeRecommendationKind {
  const joined = areas.join(" ").toLowerCase();
  if (/cta|conversion|lead|book|contact/.test(joined)) return "conversion";
  if (/motion|animation/.test(joined)) return "motion";
  if (/brand|color|logo|identity/.test(joined)) return "brand";
  if (/copy|message|headline|faq|seo|content/.test(joined)) return "content";
  return "visual";
}

function resolveAssetId(
  project: BusinessProject,
  hint: string,
): string | null {
  const library = project.mediaLibrary.filter((a) => !a.unavailable);
  if (library.length === 0) return null;
  const h = hint.trim().toLowerCase();
  if (h) {
    const match = library.find((a) =>
      `${a.title} ${a.name} ${a.alt} ${a.description}`
        .toLowerCase()
        .includes(h),
    );
    if (match) return match.id;
  }
  return library[0]?.id ?? null;
}

function proposedChangeToOperations(
  change: ProposedChange,
  project: BusinessProject,
): Array<EditOperation | ImageOperation> {
  if (!KIND_SET.has(change.kind)) return [];
  const kind = change.kind as ProposedChangeKind;

  switch (kind) {
    case "replaceText": {
      const target = change.target.trim();
      // Map hero.description → hero.subheadline alias
      const normalized =
        target === "hero.description" ? "hero.subheadline" : target;
      if (!TEXT_TARGET_SET.has(normalized)) return [];
      const value = text(change.value, 2000);
      if (!value) return [];
      return [
        {
          operation: "replaceText",
          target: normalized as EditTextTarget,
          value,
        },
      ];
    }
    case "changeTheme": {
      const op: EditOperation = { operation: "changeTheme" };
      if (nonempty(change.primary)) op.primary = text(change.primary, 40);
      if (nonempty(change.secondary)) op.secondary = text(change.secondary, 40);
      if (nonempty(change.accent)) op.accent = text(change.accent, 40);
      if (nonempty(change.background))
        op.background = text(change.background, 40);
      if (nonempty(change.theme) && THEME_SET.has(change.theme)) {
        op.theme = change.theme as SiteThemeId;
      }
      if (
        !op.primary &&
        !op.secondary &&
        !op.accent &&
        !op.background &&
        !op.theme
      ) {
        return [];
      }
      return [op];
    }
    case "setTypography": {
      const headingFont = change.headingFont.trim();
      const bodyFont = change.bodyFont.trim();
      if (!HEADING_SET.has(headingFont) && !BODY_SET.has(bodyFont)) return [];
      return [
        {
          operation: "setTypography",
          ...(HEADING_SET.has(headingFont)
            ? { headingFont: headingFont as HeadingFontId }
            : {}),
          ...(BODY_SET.has(bodyFont)
            ? { bodyFont: bodyFont as BodyFontId }
            : {}),
        },
      ];
    }
    case "setButtonStyle": {
      const value = change.buttonStyle.trim() || change.value.trim();
      if (!BUTTON_SET.has(value)) return [];
      return [
        { operation: "setButtonStyle", value: value as ButtonStyleId },
      ];
    }
    case "setSiteWidth": {
      const value = change.siteWidth.trim() || change.value.trim();
      if (!WIDTH_SET.has(value)) return [];
      return [{ operation: "setSiteWidth", value: value as SiteWidthId }];
    }
    case "setTemplate": {
      const value = change.templateId.trim() || change.value.trim();
      if (!TEMPLATE_SET.has(value)) return [];
      return [{ operation: "setTemplate", value: value as TemplateId }];
    }
    case "insertSection": {
      const type = change.sectionType.trim() || change.value.trim();
      if (!SECTION_SET.has(type)) return [];
      return [
        {
          operation: "insertSection",
          type: type as InsertableSectionType,
        },
      ];
    }
    case "removeSection": {
      const type = change.sectionType.trim() || change.value.trim();
      if (!SECTION_SET.has(type)) return [];
      return [
        {
          operation: "removeSection",
          type: type as InsertableSectionType,
        },
      ];
    }
    case "updateSeo": {
      const siteTitle = text(change.siteTitle || change.value, 120);
      const metaDescription = text(change.metaDescription, 320);
      if (!siteTitle && !metaDescription) return [];
      return [
        {
          operation: "updateSeo",
          ...(siteTitle ? { siteTitle } : {}),
          ...(metaDescription ? { metaDescription } : {}),
        },
      ];
    }
    case "rewriteServices": {
      let services: Array<{ title: string; description: string }> = [];
      try {
        const parsed = JSON.parse(change.servicesJson || "[]") as unknown;
        if (Array.isArray(parsed)) {
          services = parsed
            .filter(
              (s): s is { title: string; description: string } =>
                Boolean(
                  s &&
                    typeof s === "object" &&
                    typeof (s as { title?: unknown }).title === "string" &&
                    typeof (s as { description?: unknown }).description ===
                      "string",
                ),
            )
            .slice(0, 8)
            .map((s) => ({
              title: text(s.title, 80),
              description: text(s.description, 400),
            }))
            .filter((s) => s.title && s.description);
        }
      } catch {
        return [];
      }
      if (services.length < 2) return [];
      return [{ operation: "rewriteServices", services }];
    }
    case "setCreativePolish": {
      const spacing = change.spacing.trim();
      const spacingOk =
        spacing === "default" ||
        spacing === "comfortable" ||
        spacing === "airy";
      if (
        !change.serviceIcons &&
        !change.motion &&
        !change.visualHierarchy &&
        !change.contactFormEnabled &&
        !spacingOk
      ) {
        // Default coordinated polish when LLM requests polish without flags
        return [
          {
            operation: "setCreativePolish",
            visualHierarchy: true,
            spacing: "comfortable",
            motion: true,
          },
        ];
      }
      return [
        {
          operation: "setCreativePolish",
          ...(change.serviceIcons ? { serviceIcons: true } : {}),
          ...(change.motion ? { motion: true } : {}),
          ...(change.visualHierarchy ? { visualHierarchy: true } : {}),
          ...(change.contactFormEnabled ? { contactFormEnabled: true } : {}),
          ...(spacingOk
            ? { spacing: spacing as "default" | "comfortable" | "airy" }
            : {}),
        },
      ];
    }
    case "replaceColors": {
      const from = text(change.fromColor, 40);
      const to = text(change.toColor || change.value, 40);
      if (!from || !to) return [];
      return [{ operation: "replaceColors", from, to }];
    }
    case "shortenNavigation": {
      return [{ operation: "shortenNavigation", maxLabelLength: 12 }];
    }
    case "replaceHeroImage": {
      const assetId = resolveAssetId(project, change.assetHint || change.value);
      if (!assetId) return [];
      return [{ operation: "replaceHeroImage", assetId }];
    }
    case "setSectionImage": {
      const section = change.sectionSlot.trim() || change.target.trim();
      if (!SLOT_SET.has(section)) return [];
      const assetId = resolveAssetId(project, change.assetHint || change.value);
      if (!assetId) return [];
      return [
        {
          operation: "setSectionImage",
          section: section as (typeof SECTION_IMAGE_SLOTS)[number],
          assetId,
        },
      ];
    }
    case "replacePlaceholder": {
      const assetId = resolveAssetId(project, change.assetHint || change.value);
      if (!assetId) return [];
      const placeholder = change.target.trim() || "hero";
      return [
        {
          operation: "replacePlaceholder",
          placeholder: placeholder as "hero",
          assetId,
        },
      ];
    }
    default:
      return [];
  }
}

/** Stable fingerprint for operation dedupe. */
export function fingerprintOperation(
  op: EditOperation | ImageOperation,
): string {
  return JSON.stringify(op);
}

/**
 * Deduplicate operations while preserving order (first wins).
 */
export function dedupeOperations(
  ops: Array<EditOperation | ImageOperation>,
): Array<EditOperation | ImageOperation> {
  const seen = new Set<string>();
  const out: Array<EditOperation | ImageOperation> = [];
  for (const op of ops) {
    const key = fingerprintOperation(op);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(op);
  }
  return out;
}

/**
 * Deduplicate improvements by normalized title / observation.
 */
export function dedupeImprovements(
  improvements: CritiqueImprovement[],
): CritiqueImprovement[] {
  const seen = new Set<string>();
  const out: CritiqueImprovement[] = [];
  for (const item of improvements) {
    const key = `${item.title}|${item.observation}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(key)) continue;
    // Near-duplicate title
    const titleKey = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if ([...seen].some((s) => s.startsWith(`${titleKey}|`))) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 5);
}

const IMAGE_KINDS = new Set<ProposedChangeKind>([
  "replaceHeroImage",
  "setSectionImage",
  "replacePlaceholder",
]);

function resolveSupportStatus(
  improvement: CritiqueImprovement,
  project: BusinessProject,
  ops: Array<EditOperation | ImageOperation>,
): { supportStatus: CritiqueSupportStatus; blockedReason?: string } {
  if (ops.length > 0) {
    return { supportStatus: "supported" };
  }

  const kinds = improvement.proposedChanges.map((c) => c.kind);
  const wantsImage = kinds.some((k) => IMAGE_KINDS.has(k));
  const areas = improvement.affectedAreas.join(" ").toLowerCase();
  const title = improvement.title.toLowerCase();
  const libraryCount =
    project.mediaLibrary?.filter((a) => !a.unavailable).length ?? 0;

  if (
    wantsImage ||
    /hero|gallery|image|photo|imagery|media/.test(`${areas} ${title}`)
  ) {
    if (libraryCount === 0) {
      return {
        supportStatus: "needs_images",
        blockedReason: "Requires uploaded images",
      };
    }
    return {
      supportStatus: "needs_images",
      blockedReason: "Requires uploaded images that match this section",
    };
  }

  if (
    /ai\s*image|generate\s+image|stock\s+photo|generate\s+hero/.test(
      `${title} ${improvement.observation}`,
    )
  ) {
    return {
      supportStatus: "coming_soon",
      blockedReason: "AI image generation coming soon",
    };
  }

  return {
    supportStatus: "coming_soon",
    blockedReason: "Coming soon",
  };
}

function validateOps(
  ops: Array<EditOperation | ImageOperation>,
  project: BusinessProject,
): Array<EditOperation | ImageOperation> {
  const edits = ops.filter((op): op is EditOperation =>
    isEditOperationKind(op.operation),
  );
  const images = ops.filter((op): op is ImageOperation =>
    isImageOperationKind(op.operation),
  );

  const out: Array<EditOperation | ImageOperation> = [];
  if (edits.length > 0) {
    try {
      out.push(...validateEditOperations(edits));
    } catch {
      // Validate one-by-one so a single bad op doesn't discard the batch.
      for (const op of edits) {
        try {
          out.push(...validateEditOperations([op]));
        } catch {
          /* skip invalid */
        }
      }
    }
  }
  if (images.length > 0) {
    try {
      out.push(...validateImageOperations(images, project));
    } catch {
      for (const op of images) {
        try {
          out.push(...validateImageOperations([op], project));
        } catch {
          /* skip invalid */
        }
      }
    }
  }
  return out;
}

/**
 * Convert a validated DesignCritique into Creative Director–shaped recommendations
 * plus a flat deduped operation list.
 *
 * Sprint 28.1: also exported as `critiqueToOperations` — the only converter.
 */
export function critiqueToRecommendations(
  critique: DesignCritique,
  project: BusinessProject,
  options: { principleIds?: string[] } = {},
): {
  recommendations: CreativeDirectorRecommendation[];
  operations: Array<EditOperation | ImageOperation>;
} {
  const improvements = dedupeImprovements(critique.prioritizedImprovements);
  const recommendations: CreativeDirectorRecommendation[] = [];
  const allOps: Array<EditOperation | ImageOperation> = [];
  const principleIds = options.principleIds ?? [];

  for (const improvement of improvements) {
    const rawOps = improvement.proposedChanges.flatMap((change) =>
      proposedChangeToOperations(change, project),
    );
    const ops = dedupeOperations(validateOps(rawOps, project));
    allOps.push(...ops);

    const support = resolveSupportStatus(improvement, project, ops);
    const applyable = support.supportStatus === "supported" && ops.length > 0;
    const knowledgeEvidence =
      principleIds.length > 0
        ? matchPrinciplesToText(
            `${improvement.title} ${improvement.observation} ${improvement.rationale}`,
            principleIds,
            3,
          )
        : undefined;
    recommendations.push({
      id: `critique.${improvement.id}`,
      kind: inferKind(improvement.affectedAreas),
      title: text(improvement.title, 120) || "Design improvement",
      explanation: sanitizeDesignKnowledgeUserText(
        [
          text(improvement.observation, 400),
          text(improvement.rationale, 400),
          text(improvement.expectedBusinessOutcome, 300),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      impact: improvement.impact,
      impactScore: mapImpactScore(improvement.impact),
      confidence: Math.min(1, Math.max(0, critique.confidence)),
      operations: ops,
      capabilityIds: [],
      applyable,
      supportStatus: support.supportStatus,
      ...(applyable
        ? {}
        : {
            blockedReason: support.blockedReason ?? "Coming soon",
          }),
      estimatedTime: applyable ? "<15 seconds" : "—",
      ...(knowledgeEvidence?.length ? { knowledgeEvidence } : {}),
    });
  }

  return {
    recommendations,
    operations: dedupeOperations(allOps),
  };
}

/** Sprint 28.1 canonical name — identical to critiqueToRecommendations. */
export const critiqueToOperations = critiqueToRecommendations;

/** Format a planning checklist before / after Apply All. */
export function formatRecommendationSupportPlan(
  recommendations: CreativeDirectorRecommendation[],
): string {
  if (recommendations.length === 0) return "";
  const lines = recommendations.map((r) => {
    if (r.supportStatus === "supported" || r.applyable) {
      return `✓ ${r.title}`;
    }
    if (r.supportStatus === "needs_images") {
      return `⚠ ${r.title} — ${r.blockedReason ?? "Requires uploaded images"}`;
    }
    return `⚠ ${r.title} — ${r.blockedReason ?? "Coming soon"}`;
  });
  return ["Plan:", ...lines].join("\n");
}
