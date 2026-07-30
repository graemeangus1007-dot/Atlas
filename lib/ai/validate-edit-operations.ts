/**
 * Validate Atlas AI edit operations before apply (Sprint 22.0A).
 */

import {
  BODY_FONTS,
  BUTTON_STYLES,
  HEADING_FONTS,
  SITE_THEMES,
  SITE_WIDTHS,
} from "@/data/design-options";
import { AiError } from "@/lib/ai/errors";
import {
  EDIT_OPERATION_KINDS,
  isEditOperationKind,
  isEditTextTarget,
  isInsertableSectionType,
  isRequiredSectionId,
  type EditOperation,
} from "@/lib/ai/edit-operations";
import { resolveSectionAlias } from "@/lib/ai/section-order";
import { MOTION_PRESETS } from "@/lib/ai/motion-model";
import { TEMPLATE_IDS } from "@/lib/templates/types";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_TEXT = 4000;
const MAX_OPS = 40;

function requireObject(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AiError("bad_request", `${label} must be an object.`);
  }
  return raw as Record<string, unknown>;
}

function optionalHex(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    throw new AiError(
      "bad_request",
      `Edit operation field "${field}" must be a hex color.`,
    );
  }
  return value.trim().toLowerCase();
}

function requireString(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string") {
    throw new AiError("bad_request", `Edit operation field "${field}" must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AiError("bad_request", `Edit operation field "${field}" is required.`);
  }
  if (trimmed.length > max) {
    throw new AiError(
      "bad_request",
      `Edit operation field "${field}" exceeds ${max} characters.`,
    );
  }
  return trimmed;
}

function validateOne(raw: unknown, index: number): EditOperation {
  const row = requireObject(raw, `operations[${index}]`);
  const kind = row.operation;

  if (!isEditOperationKind(kind)) {
    throw new AiError(
      "bad_request",
      `Unknown edit operation "${String(kind)}" at index ${index}. Allowed: ${EDIT_OPERATION_KINDS.join(", ")}.`,
    );
  }

  switch (kind) {
    case "replaceText": {
      if (!isEditTextTarget(row.target)) {
        throw new AiError(
          "bad_request",
          `Invalid replaceText target "${String(row.target)}" at index ${index}.`,
        );
      }
      return {
        operation: "replaceText",
        target: row.target,
        value: requireString(row.value, "value"),
      };
    }
    case "changeTheme": {
      const primary = optionalHex(row.primary, "primary");
      const secondary = optionalHex(row.secondary, "secondary");
      const accent = optionalHex(row.accent, "accent");
      const background = optionalHex(row.background, "background");
      let theme: ChangeThemeTheme | undefined;
      if (row.theme !== undefined) {
        const id = String(row.theme);
        if (!(SITE_THEMES as readonly { id: string }[]).some((t) => t.id === id)) {
          throw new AiError(
            "bad_request",
            `Invalid theme "${id}" at index ${index}.`,
          );
        }
        theme = id as ChangeThemeTheme;
      }
      if (!primary && !secondary && !accent && !background && !theme) {
        throw new AiError(
          "bad_request",
          `changeTheme at index ${index} requires at least one field.`,
        );
      }
      return {
        operation: "changeTheme",
        ...(primary ? { primary } : {}),
        ...(secondary ? { secondary } : {}),
        ...(accent ? { accent } : {}),
        ...(background ? { background } : {}),
        ...(theme ? { theme } : {}),
      };
    }
    case "setButtonStyle": {
      const value = String(row.value ?? "");
      if (!(BUTTON_STYLES as readonly { id: string }[]).some((b) => b.id === value)) {
        throw new AiError(
          "bad_request",
          `Invalid button style "${value}" at index ${index}.`,
        );
      }
      return {
        operation: "setButtonStyle",
        value: value as EditOperation extends never ? never : Extract<EditOperation, { operation: "setButtonStyle" }>["value"],
      };
    }
    case "setTypography": {
      const headingFont =
        row.headingFont === undefined
          ? undefined
          : String(row.headingFont);
      const bodyFont =
        row.bodyFont === undefined ? undefined : String(row.bodyFont);
      if (
        headingFont &&
        !(HEADING_FONTS as readonly { id: string }[]).some((f) => f.id === headingFont)
      ) {
        throw new AiError(
          "bad_request",
          `Invalid headingFont "${headingFont}" at index ${index}.`,
        );
      }
      if (
        bodyFont &&
        !(BODY_FONTS as readonly { id: string }[]).some((f) => f.id === bodyFont)
      ) {
        throw new AiError(
          "bad_request",
          `Invalid bodyFont "${bodyFont}" at index ${index}.`,
        );
      }
      if (!headingFont && !bodyFont) {
        throw new AiError(
          "bad_request",
          `setTypography at index ${index} requires headingFont or bodyFont.`,
        );
      }
      return {
        operation: "setTypography",
        ...(headingFont
          ? {
              headingFont:
                headingFont as Extract<
                  EditOperation,
                  { operation: "setTypography" }
                >["headingFont"],
            }
          : {}),
        ...(bodyFont
          ? {
              bodyFont: bodyFont as Extract<
                EditOperation,
                { operation: "setTypography" }
              >["bodyFont"],
            }
          : {}),
      };
    }
    case "setSiteWidth": {
      const value = String(row.value ?? "");
      if (!(SITE_WIDTHS as readonly { id: string }[]).some((w) => w.id === value)) {
        throw new AiError(
          "bad_request",
          `Invalid site width "${value}" at index ${index}.`,
        );
      }
      return {
        operation: "setSiteWidth",
        value: value as Extract<EditOperation, { operation: "setSiteWidth" }>["value"],
      };
    }
    case "setTemplate": {
      const value = String(row.value ?? "");
      if (!(TEMPLATE_IDS as readonly string[]).includes(value)) {
        throw new AiError(
          "bad_request",
          `Invalid template "${value}" at index ${index}.`,
        );
      }
      return {
        operation: "setTemplate",
        value: value as Extract<EditOperation, { operation: "setTemplate" }>["value"],
      };
    }
    case "insertSection": {
      if (!isInsertableSectionType(row.type)) {
        throw new AiError(
          "bad_request",
          `Invalid insertSection type "${String(row.type)}" at index ${index}.`,
        );
      }
      return {
        operation: "insertSection",
        type: row.type,
        ...(row.content !== undefined ? { content: row.content as never } : {}),
      };
    }
    case "removeSection": {
      if (!isInsertableSectionType(row.type)) {
        throw new AiError(
          "bad_request",
          `Invalid removeSection type "${String(row.type)}" at index ${index}.`,
        );
      }
      // Defense in depth — required core sections are never insertable, but reject aliases.
      if (isRequiredSectionId(row.type)) {
        throw new AiError(
          "bad_request",
          `Required section "${row.type}" cannot be deleted.`,
        );
      }
      return { operation: "removeSection", type: row.type };
    }
    case "updateSeo": {
      const siteTitle =
        row.siteTitle === undefined
          ? undefined
          : requireString(row.siteTitle, "siteTitle", 60);
      const metaDescription =
        row.metaDescription === undefined
          ? undefined
          : requireString(row.metaDescription, "metaDescription", 160);
      const socialTitle =
        row.socialTitle === undefined
          ? undefined
          : requireString(row.socialTitle, "socialTitle", 70);
      const socialDescription =
        row.socialDescription === undefined
          ? undefined
          : requireString(row.socialDescription, "socialDescription", 200);
      const robotsIndex =
        row.robotsIndex === undefined
          ? undefined
          : typeof row.robotsIndex === "boolean"
            ? row.robotsIndex
            : (() => {
                throw new AiError(
                  "bad_request",
                  `robotsIndex must be a boolean at index ${index}.`,
                );
              })();
      if (
        siteTitle === undefined &&
        metaDescription === undefined &&
        socialTitle === undefined &&
        socialDescription === undefined &&
        robotsIndex === undefined
      ) {
        throw new AiError(
          "bad_request",
          `updateSeo at index ${index} requires at least one field.`,
        );
      }
      return {
        operation: "updateSeo",
        ...(siteTitle ? { siteTitle } : {}),
        ...(metaDescription ? { metaDescription } : {}),
        ...(socialTitle ? { socialTitle } : {}),
        ...(socialDescription ? { socialDescription } : {}),
        ...(robotsIndex !== undefined ? { robotsIndex } : {}),
      };
    }
    case "rewriteServices": {
      if (!Array.isArray(row.services) || row.services.length < 1) {
        throw new AiError(
          "bad_request",
          `rewriteServices at index ${index} requires a non-empty services array.`,
        );
      }
      if (row.services.length > 8) {
        throw new AiError(
          "bad_request",
          `rewriteServices at index ${index} exceeds 8 services.`,
        );
      }
      const services = row.services.map((service, i) => {
        const s = requireObject(service, `operations[${index}].services[${i}]`);
        return {
          title: requireString(s.title, "title", 80),
          description: requireString(s.description, "description", 500),
        };
      });
      return { operation: "rewriteServices", services };
    }
    case "shortenNavigation": {
      const maxLabelLength =
        row.maxLabelLength === undefined
          ? 12
          : typeof row.maxLabelLength === "number" &&
              Number.isFinite(row.maxLabelLength) &&
              row.maxLabelLength >= 4 &&
              row.maxLabelLength <= 40
            ? Math.floor(row.maxLabelLength)
            : (() => {
                throw new AiError(
                  "bad_request",
                  `maxLabelLength must be 4–40 at index ${index}.`,
                );
              })();
      return { operation: "shortenNavigation", maxLabelLength };
    }
    case "replaceColors": {
      const from = requireString(row.from, "from", 40).toLowerCase();
      const to = optionalHex(row.to, "to");
      if (!to) {
        throw new AiError(
          "bad_request",
          `replaceColors "to" must be a hex color at index ${index}.`,
        );
      }
      return { operation: "replaceColors", from, to };
    }
    case "updateFaqAnswer": {
      const answer = requireString(row.answer, "answer", 2000);
      const matchQuestion =
        row.matchQuestion === undefined
          ? undefined
          : requireString(row.matchQuestion, "matchQuestion", 400);
      const faqIndex =
        row.index === undefined
          ? undefined
          : typeof row.index === "number" &&
              Number.isInteger(row.index) &&
              row.index >= 0
            ? row.index
            : (() => {
                throw new AiError(
                  "bad_request",
                  `updateFaqAnswer index must be a non-negative integer at index ${index}.`,
                );
              })();
      if (matchQuestion === undefined && faqIndex === undefined) {
        throw new AiError(
          "bad_request",
          `updateFaqAnswer at index ${index} requires matchQuestion or index.`,
        );
      }
      return {
        operation: "updateFaqAnswer",
        answer,
        ...(matchQuestion ? { matchQuestion } : {}),
        ...(faqIndex !== undefined ? { index: faqIndex } : {}),
      };
    }
    case "updateFaqQuestion": {
      const question = requireString(row.question, "question", 400);
      const matchQuestion =
        row.matchQuestion === undefined
          ? undefined
          : requireString(row.matchQuestion, "matchQuestion", 400);
      const faqIndex =
        row.index === undefined
          ? undefined
          : typeof row.index === "number" &&
              Number.isInteger(row.index) &&
              row.index >= 0
            ? row.index
            : (() => {
                throw new AiError(
                  "bad_request",
                  `updateFaqQuestion index must be a non-negative integer at index ${index}.`,
                );
              })();
      if (matchQuestion === undefined && faqIndex === undefined) {
        throw new AiError(
          "bad_request",
          `updateFaqQuestion at index ${index} requires matchQuestion or index.`,
        );
      }
      return {
        operation: "updateFaqQuestion",
        question,
        ...(matchQuestion ? { matchQuestion } : {}),
        ...(faqIndex !== undefined ? { index: faqIndex } : {}),
      };
    }
    case "insertFaq": {
      if (row.items === undefined) {
        return { operation: "insertFaq" };
      }
      if (!Array.isArray(row.items) || row.items.length < 1) {
        throw new AiError(
          "bad_request",
          `insertFaq items must be a non-empty array at index ${index}.`,
        );
      }
      const items = row.items.map((item, itemIndex) => {
        const obj = requireObject(item, `insertFaq.items[${itemIndex}]`);
        return {
          question: requireString(obj.question, "question", 400),
          answer: requireString(obj.answer, "answer", 2000),
        };
      });
      return { operation: "insertFaq", items };
    }
    case "deleteFaq": {
      const matchQuestion =
        row.matchQuestion === undefined
          ? undefined
          : requireString(row.matchQuestion, "matchQuestion", 400);
      const faqIndex =
        row.index === undefined
          ? undefined
          : typeof row.index === "number" &&
              Number.isInteger(row.index) &&
              row.index >= 0
            ? row.index
            : (() => {
                throw new AiError(
                  "bad_request",
                  `deleteFaq index must be a non-negative integer at index ${index}.`,
                );
              })();
      if (matchQuestion === undefined && faqIndex === undefined) {
        throw new AiError(
          "bad_request",
          `deleteFaq at index ${index} requires matchQuestion or index.`,
        );
      }
      return {
        operation: "deleteFaq",
        ...(matchQuestion ? { matchQuestion } : {}),
        ...(faqIndex !== undefined ? { index: faqIndex } : {}),
      };
    }
    case "setCreativePolish": {
      const spacing =
        row.spacing === undefined
          ? undefined
          : row.spacing === "default" ||
              row.spacing === "comfortable" ||
              row.spacing === "airy"
            ? row.spacing
            : (() => {
                throw new AiError(
                  "bad_request",
                  `Invalid creative polish spacing at index ${index}.`,
                );
              })();
      const boolField = (key: string): boolean | undefined => {
        const value = row[key];
        if (value === undefined) return undefined;
        if (typeof value !== "boolean") {
          throw new AiError(
            "bad_request",
            `setCreativePolish.${key} must be a boolean at index ${index}.`,
          );
        }
        return value;
      };
      const serviceIcons = boolField("serviceIcons");
      const motion = boolField("motion");
      const sectionReveal = boolField("sectionReveal");
      const hoverEffects = boolField("hoverEffects");
      const respectReducedMotion = boolField("respectReducedMotion");
      const visualHierarchy = boolField("visualHierarchy");
      const contactFormEnabled = boolField("contactFormEnabled");
      const motionPreset =
        row.motionPreset === undefined
          ? undefined
          : typeof row.motionPreset === "string" &&
              (MOTION_PRESETS as readonly string[]).includes(row.motionPreset)
            ? (row.motionPreset as (typeof MOTION_PRESETS)[number])
            : (() => {
                throw new AiError(
                  "bad_request",
                  `Invalid motionPreset at index ${index}.`,
                );
              })();
      if (
        serviceIcons === undefined &&
        motion === undefined &&
        motionPreset === undefined &&
        sectionReveal === undefined &&
        hoverEffects === undefined &&
        respectReducedMotion === undefined &&
        visualHierarchy === undefined &&
        spacing === undefined &&
        contactFormEnabled === undefined
      ) {
        throw new AiError(
          "bad_request",
          `setCreativePolish at index ${index} requires at least one field.`,
        );
      }
      return {
        operation: "setCreativePolish",
        ...(serviceIcons !== undefined ? { serviceIcons } : {}),
        ...(motion !== undefined ? { motion } : {}),
        ...(motionPreset !== undefined ? { motionPreset } : {}),
        ...(sectionReveal !== undefined ? { sectionReveal } : {}),
        ...(hoverEffects !== undefined ? { hoverEffects } : {}),
        ...(respectReducedMotion !== undefined
          ? { respectReducedMotion }
          : {}),
        ...(visualHierarchy !== undefined ? { visualHierarchy } : {}),
        ...(spacing !== undefined ? { spacing } : {}),
        ...(contactFormEnabled !== undefined ? { contactFormEnabled } : {}),
      };
    }
    case "moveSection": {
      if (typeof row.section !== "string" || !row.section.trim()) {
        throw new AiError(
          "bad_request",
          `moveSection.section is required at index ${index}.`,
        );
      }
      const section =
        resolveSectionAlias(row.section) ?? row.section.trim().toLowerCase();
      const positionRaw =
        typeof row.position === "string" ? row.position.trim().toLowerCase() : "";
      const position =
        positionRaw === "first" ||
        positionRaw === "last" ||
        positionRaw === "before" ||
        positionRaw === "after"
          ? positionRaw
          : positionRaw === "top"
            ? "first"
            : positionRaw === "bottom" || positionRaw === "end"
              ? "last"
              : positionRaw === "above"
                ? "before"
                : positionRaw === "below"
                  ? "after"
                  : null;
      if (!position) {
        throw new AiError(
          "bad_request",
          `moveSection.position must be first|last|before|after at index ${index}.`,
        );
      }
      const relativeToRaw =
        row.relativeTo === undefined
          ? undefined
          : typeof row.relativeTo === "string"
            ? resolveSectionAlias(row.relativeTo) ??
              row.relativeTo.trim().toLowerCase()
            : (() => {
                throw new AiError(
                  "bad_request",
                  `moveSection.relativeTo must be a string at index ${index}.`,
                );
              })();
      if (
        (position === "before" || position === "after") &&
        !relativeToRaw
      ) {
        throw new AiError(
          "bad_request",
          `moveSection.relativeTo is required for ${position} at index ${index}.`,
        );
      }
      if (section === "footer") {
        throw new AiError(
          "bad_request",
          `Footer cannot be reordered via moveSection at index ${index}.`,
        );
      }
      return {
        operation: "moveSection",
        section,
        position,
        ...(relativeToRaw ? { relativeTo: relativeToRaw } : {}),
      };
    }
    default: {
      const _exhaustive: never = kind;
      throw new AiError(
        "bad_request",
        `Unhandled edit operation "${String(_exhaustive)}".`,
      );
    }
  }
}

type ChangeThemeTheme = Extract<
  EditOperation,
  { operation: "changeTheme" }
>["theme"];

/**
 * Parse + validate a raw operations array.
 * Unknown operations and invalid targets are rejected.
 */
export function validateEditOperations(raw: unknown): EditOperation[] {
  if (!Array.isArray(raw)) {
    throw new AiError("bad_request", "Edit operations must be an array.");
  }
  if (raw.length === 0) {
    throw new AiError("bad_request", "Edit operations array is empty.");
  }
  if (raw.length > MAX_OPS) {
    throw new AiError(
      "bad_request",
      `Too many edit operations (max ${MAX_OPS}).`,
    );
  }
  return raw.map((item, index) => validateOne(item, index));
}
