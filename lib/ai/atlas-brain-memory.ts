/**
 * Atlas Brain project memory (Sprint 26.0A).
 * Learns durable preferences from conversation + applied design.
 */

import type { AtlasProjectMemory } from "@/lib/ai/atlas-brain-types";
import type { BusinessProject } from "@/types/business-project";

const MAX_NOTES = 8;

function uniquePush(list: string[] | undefined, value: string): string[] {
  const next = [...(list ?? [])];
  const normalized = value.trim().toLowerCase();
  if (!normalized) return next;
  if (next.some((item) => item.toLowerCase() === normalized)) return next;
  next.push(value.trim());
  return next.slice(-6);
}

/**
 * Infer memory hints from a user message (deterministic heuristics).
 */
export function inferMemoryFromMessage(
  message: string,
): Partial<AtlasProjectMemory> {
  const text = message.toLowerCase();
  const patch: Partial<AtlasProjectMemory> = {};

  if (/\bminimal(ist)?\b/.test(text)) {
    patch.preferredLayouts = ["minimalist"];
  }
  if (/\b(bold|dramatic|high[- ]contrast)\b/.test(text)) {
    patch.preferredLayouts = ["bold"];
  }
  if (/\belegant\b/.test(text)) {
    patch.preferredLayouts = ["elegant"];
  }
  if (/\bdark\s*(theme|mode|look)?\b/.test(text)) {
    patch.preferredThemes = ["dark"];
  }
  if (/\blight\s*(theme|mode|look)?\b/.test(text)) {
    patch.preferredThemes = ["light"];
  }
  if (/\b(luxury|luxurious|premium|high[- ]end)\b/.test(text)) {
    patch.businessTone = "luxury";
  }
  if (/\b(friendly|warm|cozy|welcoming)\b/.test(text)) {
    patch.businessTone = "warm";
  }
  if (/\b(professional|corporate|clean)\b/.test(text)) {
    patch.businessTone = "professional";
  }
  if (/\bwarm\b/.test(text) && /\b(image|photo|picture|visual)/.test(text)) {
    patch.imageStyle = "warm";
  }
  if (/\b(phone\s+calls?|more\s+calls?|call\s+me|get\s+calls?)\b/.test(text)) {
    patch.primaryGoal = "phone calls";
  }
  if (/\b(leads?|inquir(?:y|ies)|contact\s+form)\b/.test(text)) {
    patch.primaryGoal = "leads";
  }
  if (/\b(bookings?|appointments?|reservations?)\b/.test(text)) {
    patch.primaryGoal = "bookings";
  }
  if (/\bcatering\b/.test(text)) {
    patch.primaryGoal = "catering orders";
    patch.notes = ["Focus on catering"];
  }

  return patch;
}

/**
 * Seed memory from the current project when empty.
 */
export function seedMemoryFromProject(
  project: BusinessProject,
): AtlasProjectMemory {
  const existing = project.atlasMemory ?? {};
  const seeded: AtlasProjectMemory = { ...existing };

  if (!seeded.preferredThemes?.length) {
    if (project.theme === "dark") seeded.preferredThemes = ["dark"];
    else if (project.theme === "light") seeded.preferredThemes = ["light"];
  }
  if (!seeded.preferredLayouts?.length && project.templateId) {
    seeded.preferredLayouts = [project.templateId];
  }
  if (!seeded.primaryGoal && project.goals?.length) {
    seeded.primaryGoal = project.goals[0];
  }
  if (!seeded.businessTone) {
    if (/\b(luxury|bakery|elegant)/i.test(project.businessType || "")) {
      seeded.businessTone = "warm";
    }
  }
  return seeded;
}

/**
 * Merge a memory patch into existing memory.
 */
export function mergeAtlasMemory(
  current: AtlasProjectMemory | null | undefined,
  patch: Partial<AtlasProjectMemory> | null | undefined,
): AtlasProjectMemory {
  const base: AtlasProjectMemory = { ...(current ?? {}) };
  if (!patch) {
    return { ...base, updatedAt: new Date().toISOString() };
  }

  if (patch.preferredLayouts?.length) {
    for (const layout of patch.preferredLayouts) {
      base.preferredLayouts = uniquePush(base.preferredLayouts, layout);
    }
  }
  if (patch.preferredThemes?.length) {
    for (const theme of patch.preferredThemes) {
      base.preferredThemes = uniquePush(base.preferredThemes, theme);
    }
  }
  if (patch.primaryGoal?.trim()) {
    base.primaryGoal = patch.primaryGoal.trim();
  }
  if (patch.businessTone?.trim()) {
    base.businessTone = patch.businessTone.trim();
  }
  if (patch.imageStyle?.trim()) {
    base.imageStyle = patch.imageStyle.trim();
  }
  if (patch.notes?.length) {
    for (const note of patch.notes) {
      base.notes = uniquePush(base.notes, note).slice(-MAX_NOTES);
    }
  }

  base.updatedAt = new Date().toISOString();
  return base;
}

/**
 * Update memory from a user turn + optional decision patch.
 */
export function updateAtlasMemory(
  project: BusinessProject,
  userMessage: string,
  decisionPatch?: Partial<AtlasProjectMemory> | null,
): AtlasProjectMemory {
  const seeded = seedMemoryFromProject(project);
  const fromMessage = inferMemoryFromMessage(userMessage);
  return mergeAtlasMemory(mergeAtlasMemory(seeded, fromMessage), decisionPatch);
}

/** Compact context string for specialist prompts / explanations. */
export function formatMemoryContext(memory: AtlasProjectMemory | null | undefined): string {
  if (!memory) return "";
  const parts: string[] = [];
  if (memory.businessTone) parts.push(`tone: ${memory.businessTone}`);
  if (memory.primaryGoal) parts.push(`goal: ${memory.primaryGoal}`);
  if (memory.preferredThemes?.length) {
    parts.push(`theme: ${memory.preferredThemes.join(", ")}`);
  }
  if (memory.preferredLayouts?.length) {
    parts.push(`layout: ${memory.preferredLayouts.join(", ")}`);
  }
  if (memory.imageStyle) parts.push(`imagery: ${memory.imageStyle}`);
  return parts.join("; ");
}
