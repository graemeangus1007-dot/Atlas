/**
 * Post-apply execution verification (v1.2 truthfulness).
 * Never report success unless the project state matches the requested outcome.
 */

import {
  emptyExecutionResult,
  mergeExecutionResults,
  sectionDisplayName,
  type EditExecutionResult,
} from "@/lib/ai/edit-execution-result";
import {
  isDesignSectionVisibleInProject,
} from "@/lib/ai/design-sections-canonical";
import {
  INSERTABLE_SECTION_TYPES,
  isInsertableSectionType,
  type EditOperation,
  type InsertableSectionType,
} from "@/lib/ai/edit-operations";
import {
  heroPatternPreset,
  verifyHeroPatternApplication,
} from "@/lib/ai/hero-pattern-application";
import type { ImageOperation } from "@/lib/ai/image-operations";
import {
  getEffectiveSectionOrder,
  type SectionMoveIntent,
  type SectionMovePosition,
} from "@/lib/ai/section-order";
import { getTemplate } from "@/lib/templates";
import type { BusinessProject } from "@/types/business-project";

export function isSectionPresentOnPage(
  project: BusinessProject,
  sectionId: string,
): boolean {
  if (!sectionId) return false;
  const template = getTemplate(project.templateId || "modern");
  if (template.sectionOrder.includes(sectionId as never)) {
    return true;
  }
  if (isInsertableSectionType(sectionId)) {
    return isDesignSectionVisibleInProject(project, sectionId);
  }
  // Non-insertable optional ids only count when enabled with content
  if (
    (INSERTABLE_SECTION_TYPES as readonly string[]).includes(sectionId)
  ) {
    return false;
  }
  return getEffectiveSectionOrder(project).includes(sectionId);
}

export function isSectionAlreadyAtIntent(
  project: BusinessProject,
  intent: SectionMoveIntent,
): boolean {
  if (!isSectionPresentOnPage(project, intent.section)) return false;
  const order = getEffectiveSectionOrder(project);
  return positionMatches(order, intent);
}

function positionMatches(
  order: string[],
  intent: SectionMoveIntent,
): boolean {
  const idx = order.indexOf(intent.section);
  if (idx < 0) return false;

  if (intent.position === "first") {
    // Hero is forced first; other sections “first” means immediately after hero.
    if (intent.section === "hero") return idx === 0;
    if (order[0] === "hero") return idx === 1;
    return idx === 0;
  }
  if (intent.position === "last") {
    return idx === order.length - 1;
  }
  if (!intent.relativeTo) return false;
  const anchor = order.indexOf(intent.relativeTo);
  if (anchor < 0) return false;
  if (intent.position === "before") return idx === anchor - 1;
  if (intent.position === "after") return idx === anchor + 1;
  return false;
}

function describeMoveIntent(intent: SectionMoveIntent): string {
  const name = sectionDisplayName(intent.section);
  if (intent.position === "last") return `${name} to the bottom of the page`;
  if (intent.position === "first") return `${name} to the top of the page`;
  const anchor = sectionDisplayName(intent.relativeTo ?? "");
  return `${name} ${intent.position} ${anchor}`;
}

export function verifyMoveSection(
  before: BusinessProject,
  after: BusinessProject,
  intent: SectionMoveIntent,
  options?: { createdSection?: boolean },
): EditExecutionResult {
  const name = sectionDisplayName(intent.section);
  const operationType = "moveSection";

  if (!isSectionPresentOnPage(after, intent.section)) {
    const insertable = isInsertableSectionType(intent.section);
    return {
      ...emptyExecutionResult(operationType),
      verificationFailures: [
        insertable
          ? `The page doesn’t contain a visible ${name} section.`
          : `The page doesn’t contain a ${name} section.`,
      ],
      followUpRecommendation: insertable
        ? `Add ${name}`
        : undefined,
      explanation: insertable
        ? `I couldn’t move ${name} because the page doesn’t contain that section yet.`
        : `I couldn’t move ${name} because the page doesn’t contain that section.`,
    };
  }

  if (
    intent.relativeTo &&
    (intent.position === "before" || intent.position === "after") &&
    !isSectionPresentOnPage(after, intent.relativeTo)
  ) {
    const anchor = sectionDisplayName(intent.relativeTo);
    return {
      ...emptyExecutionResult(operationType),
      verificationFailures: [
        `The anchor section “${anchor}” isn’t on the page.`,
      ],
      followUpRecommendation: isInsertableSectionType(intent.relativeTo)
        ? `Add ${anchor}`
        : undefined,
      explanation: `I couldn’t place ${name} ${intent.position} ${anchor} because ${anchor} isn’t on the page.`,
    };
  }

  const order = getEffectiveSectionOrder(after);
  if (!positionMatches(order, intent)) {
    return {
      ...emptyExecutionResult(operationType),
      verificationFailures: [
        `${name} is not in the requested position after apply.`,
      ],
      explanation: `I wasn’t able to move ${describeMoveIntent(intent)}.`,
    };
  }

  // Require an actual order change unless we just created the section.
  const beforeOrder = getEffectiveSectionOrder(before).join("|");
  const afterOrder = order.join("|");
  if (beforeOrder === afterOrder && !options?.createdSection) {
    return {
      success: false,
      verified: true,
      operationType,
      verificationFailures: [],
      createdEntities: [],
      modifiedEntities: [],
      warnings: [`${name} was already in that position.`],
      explanation: `${name} is already in that position.`,
    };
  }

  const created = options?.createdSection ? [intent.section] : [];
  const prefix = options?.createdSection
    ? `Your site didn’t have a ${name} section yet. I added one, then placed it ${
        intent.position === "last"
          ? "at the bottom"
          : intent.position === "first"
            ? "near the top"
            : `${intent.position} ${sectionDisplayName(intent.relativeTo ?? "")}`
      }.`
    : `Done. I moved ${describeMoveIntent(intent)}.`;

  return {
    success: true,
    verified: true,
    operationType,
    verificationFailures: [],
    createdEntities: created,
    modifiedEntities: [intent.section, "sectionOrder"],
    warnings: [],
    explanation: prefix,
  };
}

function projectFieldChanged(
  before: BusinessProject,
  after: BusinessProject,
  keys: Array<keyof BusinessProject>,
): boolean {
  return keys.some(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

export function verifyEditOperation(
  before: BusinessProject,
  after: BusinessProject,
  op: EditOperation | ImageOperation,
): EditExecutionResult {
  if (!("operation" in op) || typeof op.operation !== "string") {
    return {
      ...emptyExecutionResult("unknown"),
      verificationFailures: ["Unrecognized operation."],
      explanation: "I couldn’t verify that change.",
    };
  }

  switch (op.operation) {
    case "moveSection": {
      const intent: SectionMoveIntent = {
        section: op.section,
        position: op.position as SectionMovePosition,
        relativeTo: op.relativeTo,
      };
      return verifyMoveSection(before, after, intent);
    }
    case "insertSection": {
      const type = op.type as InsertableSectionType;
      const name = sectionDisplayName(type);
      if (!isDesignSectionVisibleInProject(after, type)) {
        return {
          ...emptyExecutionResult("insertSection"),
          verificationFailures: [`${name} did not become visible after insert.`],
          explanation: `I couldn’t add ${name} in a way that shows on the page.`,
        };
      }
      const already = isDesignSectionVisibleInProject(before, type);
      if (already) {
        return {
          success: false,
          verified: true,
          operationType: "insertSection",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [`${name} was already on the page.`],
          explanation: `${name} is already on the page.`,
        };
      }
      return {
        success: true,
        verified: true,
        operationType: "insertSection",
        verificationFailures: [],
        createdEntities: [type],
        modifiedEntities: ["designSections"],
        warnings: [],
        explanation: `Done. I added a ${name} section.`,
      };
    }
    case "removeSection": {
      const type = op.type as InsertableSectionType;
      const name = sectionDisplayName(type);
      if (isDesignSectionVisibleInProject(after, type)) {
        return {
          ...emptyExecutionResult("removeSection"),
          verificationFailures: [`${name} is still visible.`],
          explanation: `I couldn’t remove ${name}.`,
        };
      }
      if (!isDesignSectionVisibleInProject(before, type)) {
        return {
          success: false,
          verified: true,
          operationType: "removeSection",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: [`${name} was not on the page.`],
          explanation: `${name} wasn’t on the page.`,
        };
      }
      return {
        success: true,
        verified: true,
        operationType: "removeSection",
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [type, "designSections"],
        warnings: [],
        explanation: `Done. I removed the ${name} section.`,
      };
    }
    case "changeTheme":
    case "replaceColors": {
      const changed = projectFieldChanged(before, after, [
        "primaryColor",
        "accentColor",
        "secondaryColor",
        "backgroundColor",
        "theme",
      ]);
      return changed
        ? {
            success: true,
            verified: true,
            operationType: op.operation,
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: ["theme"],
            warnings: [],
            explanation: "Done. I updated the color palette.",
          }
        : {
            success: false,
            verified: true,
            operationType: op.operation,
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: [],
            warnings: ["Colors were already set that way."],
            explanation: "Those colors are already applied.",
          };
    }
    case "setTypography": {
      const changed = projectFieldChanged(before, after, [
        "headingFont",
        "bodyFont",
      ]);
      return changed
        ? {
            success: true,
            verified: true,
            operationType: "setTypography",
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: ["typography"],
            warnings: [],
            explanation: "Done. I updated the typography.",
          }
        : {
            success: false,
            verified: true,
            operationType: "setTypography",
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: [],
            warnings: ["Typography was already set that way."],
            explanation: "That typography is already applied.",
          };
    }
    case "setButtonStyle": {
      const changed = before.buttonStyle !== after.buttonStyle;
      return changed
        ? {
            success: true,
            verified: true,
            operationType: "setButtonStyle",
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: ["buttonStyle"],
            warnings: [],
            explanation: "Done. I updated the buttons.",
          }
        : {
            success: false,
            verified: true,
            operationType: "setButtonStyle",
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: [],
            warnings: ["Button style was already set that way."],
            explanation: "That button style is already applied.",
          };
    }
    case "setHeroOverlay": {
      const changed = (before.heroOverlay ?? 50) !== (after.heroOverlay ?? 50);
      const matched = (after.heroOverlay ?? 50) === op.value;
      if (changed && matched) {
        return {
          success: true,
          verified: true,
          operationType: "setHeroOverlay",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: ["heroOverlay"],
          warnings: [],
          explanation: "Done. I strengthened the hero overlay.",
        };
      }
      if (!changed) {
        return {
          success: false,
          verified: true,
          operationType: "setHeroOverlay",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: ["Hero overlay was already at that strength."],
          explanation: "The hero overlay is already at that strength.",
        };
      }
      return {
        ...emptyExecutionResult("setHeroOverlay"),
        verificationFailures: ["Hero overlay did not reach the requested value."],
        explanation: "I wasn’t able to update the hero overlay.",
      };
    }
    case "replaceText": {
      const target = op.target;
      const beforeVal = readTextTarget(before, target);
      const afterVal = readTextTarget(after, target);
      if (afterVal === op.value && beforeVal !== afterVal) {
        return {
          success: true,
          verified: true,
          operationType: "replaceText",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [target],
          warnings: [],
          explanation: "Done. I updated the copy.",
        };
      }
      if (afterVal === op.value && beforeVal === afterVal) {
        return {
          success: false,
          verified: true,
          operationType: "replaceText",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: ["Copy was already that text."],
          explanation: "That copy is already on the page.",
        };
      }
      return {
        ...emptyExecutionResult("replaceText"),
        verificationFailures: [`Copy at ${target} did not change as requested.`],
        explanation: "I wasn’t able to update that copy.",
      };
    }
    case "applyHeroPattern": {
      const expected = op.composition ?? heroPatternPreset(op.patternId);
      const check = verifyHeroPatternApplication({
        before,
        after,
        expected: { ...expected, patternId: op.patternId },
        allowAlreadySatisfied: true,
      });
      if (check.verified && after.heroComposition?.patternId === op.patternId) {
        const changed =
          before.heroComposition?.patternId !==
            after.heroComposition?.patternId ||
          JSON.stringify(before.heroComposition) !==
            JSON.stringify(after.heroComposition);
        if (!changed) {
          return {
            success: false,
            verified: true,
            operationType: "applyHeroPattern",
            verificationFailures: [],
            createdEntities: [],
            modifiedEntities: [],
            warnings: ["Hero pattern composition was already active."],
            explanation: "That hero composition is already active.",
          };
        }
        return {
          success: true,
          verified: true,
          operationType: "applyHeroPattern",
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [
            "heroComposition",
            "heroOverlay",
            "heroTreatment",
            "heroImagePresentation",
          ],
          warnings: [],
          explanation: "Done. I applied the hero composition.",
        };
      }
      return {
        ...emptyExecutionResult("applyHeroPattern"),
        verificationFailures:
          check.failures.length > 0
            ? check.failures
            : ["Hero pattern composition could not be verified."],
        explanation: "I wasn’t able to verify the hero pattern composition.",
      };
    }
    case "setSectionImage":
    case "replaceHeroImage":
    case "replaceSectionImage":
    case "replaceGalleryImage":
    case "setLogo":
    case "insertImage":
    case "replacePlaceholder": {
      const changed = projectFieldChanged(before, after, [
        "heroImageId",
        "logo",
        "sectionImages",
        "galleryImageIds",
        "mediaLibrary",
      ]);
      if (!changed) {
        return {
          success: false,
          verified: true,
          operationType: op.operation,
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: ["No image assignment changed."],
          explanation:
            "I couldn’t update the image — nothing new was assigned (an upload may be needed).",
          followUpRecommendation: "Upload an image",
        };
      }
      return {
        success: true,
        verified: true,
        operationType: op.operation,
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: ["images"],
        warnings: [],
        explanation: "Done. I updated the imagery.",
      };
    }
    default: {
      // Generic: require a meaningful project diff for claimed success.
      const changed =
        JSON.stringify(stripVolatile(before)) !==
        JSON.stringify(stripVolatile(after));
      if (!changed) {
        return {
          success: false,
          verified: true,
          operationType: op.operation,
          verificationFailures: [],
          createdEntities: [],
          modifiedEntities: [],
          warnings: ["Nothing changed in the project."],
          explanation: "Nothing changed — the site was already in that state.",
        };
      }
      return {
        success: true,
        verified: true,
        operationType: op.operation,
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [op.operation],
        warnings: [],
        explanation: "Done. I applied that update.",
      };
    }
  }
}

function readTextTarget(project: BusinessProject, target: string): string {
  switch (target) {
    case "hero.eyebrow":
      return project.heroEyebrow ?? "";
    case "hero.title":
      return project.heroHeadline ?? "";
    case "hero.subheadline":
      return project.heroSubheadline ?? "";
    case "hero.primaryCta":
      return project.primaryCta ?? "";
    case "hero.secondaryCta":
      return project.secondaryCta ?? "";
    case "about.title":
      return project.aboutTitle ?? "";
    case "about.body":
      return project.description ?? "";
    case "contact.title":
      return project.contact?.title ?? "";
    case "contact.description":
      return project.contact?.description ?? "";
    case "contact.buttonText":
      return project.contact?.buttonText ?? "";
    case "business.name":
      return project.businessName ?? "";
    case "business.type":
      return String(project.businessType ?? "");
    case "business.description":
      return project.description ?? "";
    default:
      return "";
  }
}

function stripVolatile(project: BusinessProject): unknown {
  const rest = { ...project } as BusinessProject & {
    atlasActionMemory?: unknown;
    atlasMemory?: unknown;
    designAssistant?: unknown;
    updatedAt?: string;
  };
  delete rest.atlasActionMemory;
  delete rest.atlasMemory;
  delete rest.designAssistant;
  delete rest.updatedAt;
  return rest;
}

/**
 * Verify a batch of operations against before/after project snapshots.
 */
export function verifyEditExecution(
  before: BusinessProject,
  after: BusinessProject,
  operations: Array<EditOperation | ImageOperation>,
): EditExecutionResult {
  if (operations.length === 0) {
    return {
      ...emptyExecutionResult("none"),
      verified: true,
      explanation: "Nothing changed.",
    };
  }

  // Special-case insert+move of the same section (auto-create path).
  if (
    operations.length === 2 &&
    operations[0]?.operation === "insertSection" &&
    operations[1]?.operation === "moveSection" &&
    operations[0].type === (operations[1] as EditOperation & { section: string }).section
  ) {
    const move = operations[1] as EditOperation & {
      section: string;
      position: SectionMovePosition;
      relativeTo?: string;
    };
    const insertResult = verifyEditOperation(before, after, operations[0]!);
    const moveResult = verifyMoveSection(
      before,
      after,
      {
        section: move.section,
        position: move.position,
        relativeTo: move.relativeTo,
      },
      { createdSection: insertResult.success && insertResult.verified },
    );
    if (insertResult.success && moveResult.success && moveResult.verified) {
      return moveResult;
    }
    return mergeExecutionResults([insertResult, moveResult]);
  }

  const results = operations.map((op) =>
    verifyEditOperation(before, after, op),
  );
  return mergeExecutionResults(results);
}

export function applyStatusFromExecution(
  result: EditExecutionResult,
): "applied" | "no_changes" | "needs_clarification" {
  if (result.success && result.verified) return "applied";
  // Partial success — keep what landed.
  if (
    result.verified &&
    (result.modifiedEntities.length > 0 || result.createdEntities.length > 0)
  ) {
    return "applied";
  }
  if (
    result.verified &&
    !result.success &&
    result.verificationFailures.length === 0
  ) {
    return "no_changes";
  }
  if (result.verificationFailures.length > 0) {
    return "needs_clarification";
  }
  return "no_changes";
}
