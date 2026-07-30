/**
 * Secondary critique validation with path/code diagnostics (Sprint 28.0B).
 * Never includes rejected field values in logs.
 */

import { AiError } from "@/lib/ai/errors";
import {
  PROPOSED_CHANGE_KINDS,
  type CritiqueFinding,
  type CritiqueImprovement,
  type CritiqueStrength,
  type DesignCritique,
  type ProposedChange,
} from "@/lib/ai/design-critique-types";
import { dedupeImprovements } from "@/lib/ai/critique-to-operations";
import { sanitizePlainText } from "@/lib/leads/sanitize";

export type CritiqueValidationIssue = {
  path: string;
  code: string;
};

const KIND_SET = new Set<string>(PROPOSED_CHANGE_KINDS);

function clip(value: unknown, max: number): string {
  return sanitizePlainText(
    typeof value === "string" ? value : value == null ? "" : String(value),
    { maxLength: max, trimEnds: true },
  );
}

function requireObject(
  value: unknown,
  path: string,
  issues: CritiqueValidationIssue[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, code: "expected_object" });
    return null;
  }
  return value as Record<string, unknown>;
}

function requireStringArray(
  value: unknown,
  path: string,
  max: number,
  issues: CritiqueValidationIssue[],
): string[] {
  if (!Array.isArray(value) || value.length < 1) {
    issues.push({ path, code: "expected_nonempty_array" });
    return [];
  }
  const out: string[] = [];
  for (const [i, item] of value.slice(0, max).entries()) {
    const s = clip(item, 160);
    if (!s) {
      issues.push({ path: `${path}.${i}`, code: "empty_string" });
      continue;
    }
    out.push(s);
  }
  return out;
}

function emptyProposedChange(): ProposedChange {
  return {
    kind: "setCreativePolish",
    target: "",
    value: "",
    sectionType: "",
    headingFont: "",
    bodyFont: "",
    buttonStyle: "",
    siteWidth: "",
    templateId: "",
    theme: "",
    primary: "",
    secondary: "",
    accent: "",
    background: "",
    fromColor: "",
    toColor: "",
    siteTitle: "",
    metaDescription: "",
    spacing: "",
    serviceIcons: false,
    motion: false,
    visualHierarchy: false,
    contactFormEnabled: false,
    assetHint: "",
    sectionSlot: "",
    servicesJson: "",
  };
}

function parseProposedChange(
  raw: unknown,
  path: string,
  issues: CritiqueValidationIssue[],
): ProposedChange | null {
  const row = requireObject(raw, path, issues);
  if (!row) return null;
  const kind = clip(row.kind, 40);
  if (!KIND_SET.has(kind)) {
    issues.push({ path: `${path}.kind`, code: "invalid_enum" });
    return null;
  }
  return {
    ...emptyProposedChange(),
    kind: kind as ProposedChange["kind"],
    target: clip(row.target, 80),
    value: clip(row.value, 2000),
    sectionType: clip(row.sectionType, 40),
    headingFont: clip(row.headingFont, 40),
    bodyFont: clip(row.bodyFont, 40),
    buttonStyle: clip(row.buttonStyle, 40),
    siteWidth: clip(row.siteWidth, 20),
    templateId: clip(row.templateId, 40),
    theme: clip(row.theme, 20),
    primary: clip(row.primary, 40),
    secondary: clip(row.secondary, 40),
    accent: clip(row.accent, 40),
    background: clip(row.background, 40),
    fromColor: clip(row.fromColor, 40),
    toColor: clip(row.toColor, 40),
    siteTitle: clip(row.siteTitle, 120),
    metaDescription: clip(row.metaDescription, 160),
    spacing: clip(row.spacing, 20),
    serviceIcons: Boolean(row.serviceIcons),
    motion: Boolean(row.motion),
    visualHierarchy: Boolean(row.visualHierarchy),
    contactFormEnabled: Boolean(row.contactFormEnabled),
    assetHint: clip(row.assetHint, 80),
    sectionSlot: clip(row.sectionSlot, 40),
    servicesJson: clip(row.servicesJson, 4000),
  };
}

export type ValidateDesignCritiqueResult =
  | { ok: true; critique: DesignCritique }
  | { ok: false; issues: CritiqueValidationIssue[] };

/**
 * Runtime validation after Structured Outputs parsing.
 * Collects path/code issues without logging field values.
 */
export function validateDesignCritiqueWithIssues(
  raw: unknown,
): ValidateDesignCritiqueResult {
  const issues: CritiqueValidationIssue[] = [];
  const obj = requireObject(raw, "root", issues);
  if (!obj) return { ok: false, issues };

  const summary = clip(obj.summary, 800);
  if (!summary) issues.push({ path: "summary", code: "required" });
  if (summary && /^improve the design\.?$/i.test(summary.trim())) {
    issues.push({ path: "summary", code: "too_generic" });
  }

  if (!Array.isArray(obj.currentStrengths) || obj.currentStrengths.length < 1) {
    issues.push({ path: "currentStrengths", code: "expected_nonempty_array" });
  }
  const currentStrengths: CritiqueStrength[] = [];
  if (Array.isArray(obj.currentStrengths)) {
    for (const [i, item] of obj.currentStrengths.slice(0, 5).entries()) {
      const row = requireObject(item, `currentStrengths.${i}`, issues);
      if (!row) continue;
      const title = clip(row.title, 120);
      const evidence = clip(row.evidence, 400);
      if (!title) {
        issues.push({ path: `currentStrengths.${i}.title`, code: "required" });
        continue;
      }
      if (!evidence) {
        issues.push({
          path: `currentStrengths.${i}.evidence`,
          code: "required",
        });
        continue;
      }
      currentStrengths.push({
        id: clip(row.id, 64) || `strength-${i + 1}`,
        title,
        evidence,
      });
    }
  }
  if (currentStrengths.length < 1) {
    issues.push({ path: "currentStrengths", code: "no_valid_items" });
  }

  if (!Array.isArray(obj.coreProblems) || obj.coreProblems.length < 1) {
    issues.push({ path: "coreProblems", code: "expected_nonempty_array" });
  }
  const coreProblems: CritiqueFinding[] = [];
  if (Array.isArray(obj.coreProblems)) {
    for (const [i, item] of obj.coreProblems.slice(0, 7).entries()) {
      const row = requireObject(item, `coreProblems.${i}`, issues);
      if (!row) continue;
      if (row.severity !== "missing" && row.severity !== "weak") {
        issues.push({
          path: `coreProblems.${i}.severity`,
          code: "invalid_enum",
        });
        continue;
      }
      const title = clip(row.title, 120);
      const observation = clip(row.observation, 600);
      if (!title || !observation) {
        issues.push({
          path: `coreProblems.${i}`,
          code: "incomplete_item",
        });
        continue;
      }
      coreProblems.push({
        id: clip(row.id, 64) || `problem-${i + 1}`,
        title,
        observation,
        severity: row.severity,
        affectedAreas: requireStringArray(
          row.affectedAreas,
          `coreProblems.${i}.affectedAreas`,
          8,
          issues,
        ),
      });
    }
  }
  if (coreProblems.length < 1) {
    issues.push({ path: "coreProblems", code: "no_valid_items" });
  }

  const direction = requireObject(obj.designDirection, "designDirection", issues);
  const designDirection = direction
    ? {
        name: clip(direction.name, 80),
        rationale: clip(direction.rationale, 600),
        emotionalGoal: clip(direction.emotionalGoal, 300),
        visualPrinciples: requireStringArray(
          direction.visualPrinciples,
          "designDirection.visualPrinciples",
          6,
          issues,
        ),
      }
    : null;
  if (designDirection && (!designDirection.name || !designDirection.rationale)) {
    issues.push({ path: "designDirection", code: "incomplete_item" });
  }

  if (
    !Array.isArray(obj.prioritizedImprovements) ||
    obj.prioritizedImprovements.length < 1
  ) {
    issues.push({
      path: "prioritizedImprovements",
      code: "expected_nonempty_array",
    });
  }
  const prioritizedImprovements: CritiqueImprovement[] = [];
  if (Array.isArray(obj.prioritizedImprovements)) {
    for (const [i, item] of obj.prioritizedImprovements.slice(0, 7).entries()) {
      const row = requireObject(item, `prioritizedImprovements.${i}`, issues);
      if (!row) continue;
      if (
        row.impact !== "high" &&
        row.impact !== "medium" &&
        row.impact !== "low"
      ) {
        issues.push({
          path: `prioritizedImprovements.${i}.impact`,
          code: "invalid_enum",
        });
        continue;
      }
      const title = clip(row.title, 120);
      const observation = clip(row.observation, 600);
      const rationale = clip(row.rationale, 800);
      if (!title || !observation || !rationale) {
        issues.push({
          path: `prioritizedImprovements.${i}`,
          code: "incomplete_item",
        });
        continue;
      }
      const changesRaw = Array.isArray(row.proposedChanges)
        ? row.proposedChanges.slice(0, 8)
        : [];
      const changes = changesRaw
        .map((c, ci) =>
          parseProposedChange(
            c,
            `prioritizedImprovements.${i}.proposedChanges.${ci}`,
            issues,
          ),
        )
        .filter((c): c is ProposedChange => Boolean(c));
      prioritizedImprovements.push({
        id: clip(row.id, 64) || `improve-${i + 1}`,
        title,
        observation,
        rationale,
        expectedBusinessOutcome: clip(row.expectedBusinessOutcome, 400),
        impact: row.impact,
        affectedAreas: requireStringArray(
          row.affectedAreas,
          `prioritizedImprovements.${i}.affectedAreas`,
          8,
          issues,
        ),
        proposedChanges: changes,
      });
    }
  }

  const deduped = dedupeImprovements(prioritizedImprovements);
  if (deduped.length < 1) {
    issues.push({ path: "prioritizedImprovements", code: "no_valid_items" });
  }

  const expectedOutcome = clip(obj.expectedOutcome, 600);
  if (!expectedOutcome) {
    issues.push({ path: "expectedOutcome", code: "required" });
  }

  const confidence =
    typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
      ? Math.min(1, Math.max(0, obj.confidence))
      : null;
  if (confidence === null) {
    issues.push({ path: "confidence", code: "invalid_number" });
  }

  const fatal = issues.some((issue) =>
    [
      "summary",
      "currentStrengths",
      "coreProblems",
      "designDirection",
      "prioritizedImprovements",
      "expectedOutcome",
      "confidence",
      "root",
    ].some(
      (prefix) =>
        issue.path === prefix ||
        issue.path.startsWith(`${prefix}.`) ||
        (prefix !== "root" && issue.code === "too_generic" && issue.path === "summary"),
    ),
  );

  if (
    fatal ||
    !summary ||
    currentStrengths.length < 1 ||
    coreProblems.length < 1 ||
    !designDirection?.name ||
    deduped.length < 1 ||
    !expectedOutcome ||
    confidence === null
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    critique: {
      summary,
      currentStrengths,
      coreProblems,
      designDirection,
      prioritizedImprovements: deduped,
      expectedOutcome,
      confidence,
    },
  };
}

/** Throwing wrapper for callers that expect AiError. */
export function validateDesignCritique(raw: unknown): DesignCritique {
  const result = validateDesignCritiqueWithIssues(raw);
  if (!result.ok) {
    const err = new AiError(
      "invalid_response",
      "OpenAI critique failed schema validation.",
    );
    (err as AiError & { validationIssues?: CritiqueValidationIssue[] }).validationIssues =
      result.issues;
    throw err;
  }
  return result.critique;
}
