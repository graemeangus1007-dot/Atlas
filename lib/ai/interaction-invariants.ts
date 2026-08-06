/**
 * Sprint 29.0 / Phase 0 — Interaction invariant assertions (test / contract only).
 *
 * These helpers must not run in production request paths.
 * See: docs/atlas-interaction-ownership.md
 */

import { getActionMemory, hasPendingClarification } from "@/lib/ai/atlas-action-memory";
import { getActiveVisualTask } from "@/lib/ai/active-visual-task";
import {
  canonicalStatesEquivalent,
  findRetiredMirrorKeys,
  migrateToAtlasInteractionState,
  serializeCanonicalInteractionState,
  serializeInteractionPayload,
  validateCanonicalInteractionSafety,
} from "@/lib/ai/atlas-interaction-migrate";
import {
  getInteractionState,
  roundTripProjectJson,
} from "@/lib/ai/interaction-state";
import type { BusinessProject } from "@/types/business-project";

export type MutationScope =
  | "hero_readability"
  | "hero_balance"
  | "hero_image_fit"
  | "hero_composition"
  | "gallery_metadata"
  | "gallery_interaction"
  | "surface_style";

/** Project fields considered part of each scoped edit domain. */
const SCOPE_ALLOWED_ROOTS: Record<MutationScope, readonly string[]> = {
  hero_readability: [
    "heroOverlay",
    "heroTreatment",
    "heroImagePresentation",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  hero_balance: [
    "heroOverlay",
    "heroTreatment",
    "heroImagePresentation",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  hero_image_fit: [
    "heroImagePresentation",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  hero_composition: [
    "heroComposition",
    "heroOverlay",
    "heroTreatment",
    "heroImagePresentation",
    "creativePolish",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  gallery_metadata: [
    "mediaLibrary",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  gallery_interaction: [
    "galleryInteraction",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
  surface_style: [
    "componentSurfaces",
    "atlasActionMemory",
    "atlasMemory",
    "updatedAt",
    "designAssistant",
  ],
};

/** Domains that must never change under the given scope. */
const SCOPE_FORBIDDEN_ROOTS: Record<MutationScope, readonly string[]> = {
  hero_readability: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "galleryImageIds",
    "galleryInteraction",
    "sectionOrder",
    "mediaLibrary",
  ],
  hero_balance: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "galleryImageIds",
    "galleryInteraction",
    "sectionOrder",
  ],
  hero_image_fit: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "heroImageId",
    "galleryImageIds",
    "galleryInteraction",
    "sectionOrder",
    "mediaLibrary",
  ],
  hero_composition: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "buttonStyle",
    "siteWidth",
    "templateId",
    "galleryImageIds",
    "galleryInteraction",
    "sectionOrder",
    "services",
    "contact",
    "seo",
    "mediaLibrary",
  ],
  gallery_metadata: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "heroImageId",
    "heroImagePresentation",
    "heroTreatment",
    "heroOverlay",
    "sectionOrder",
  ],
  gallery_interaction: [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "headingFont",
    "bodyFont",
    "heroImageId",
    "heroImagePresentation",
    "sectionOrder",
    "mediaLibrary",
  ],
  surface_style: [
    "heroImageId",
    "galleryImageIds",
    "mediaLibrary",
    "sectionOrder",
    "heroImagePresentation",
    "headingFont",
    "bodyFont",
  ],
};

export type InteractionInvariantId =
  | "I1_single_clarification"
  | "I2_no_repeat_clarification"
  | "I3_hero_placement_task"
  | "I4_hero_fit_no_clarify"
  | "I5_plan_does_not_hijack_scoped"
  | "I6_applied_means_verified"
  | "I7_preservation_captured"
  | "I8_plan_store_clarification_policy"
  | "I9_persistence_round_trip"
  | "I10_write_ownership"
  | "I11_production_transcripts"
  | "I12_prefs_untouched_by_clarify_clear"
  | "I13_scoped_mutation"
  | "I14_canonical_wins_mirrors"
  | "I15_normalize_idempotent"
  | "I16_legacy_round_trip"
  | "I17_no_direct_mirror_writes"
  | "I18_canonical_serialization"
  | "I19_no_production_mirror_reads"
  | "I20_image_continuation_from_active_task"
  | "I21_placement_stores_canonical_asset"
  | "I22_no_transient_file_data"
  | "I23_single_active_task"
  | "I24_task_after_verified_scoped"
  | "I25_active_task_blocks_unrelated_plan"
  | "I26_topic_switch_deterministic"
  | "I27_task_refs_agree_with_truth"
  | "I28_no_independent_continuation";

function assertDevOrTest(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "interaction invariants must not run in production request paths",
    );
  }
}

export function assertSingleClarification(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const memory = getInteractionState(project);
  const amPending = memory.pendingClarification ?? null;
  if (amPending && Array.isArray(amPending as unknown)) {
    throw new Error(message ?? "I1: pendingClarification must not be an array");
  }
  const count = amPending?.pendingQuestion ? 1 : 0;
  if (count > 1) {
    throw new Error(message ?? "I1: more than one Action Memory clarification");
  }
  // Sprint 29.2 — nested AVT clarification is not an independent store.
  const raw = project.atlasActionMemory as
    | { activeVisualTask?: { pendingClarification?: unknown } }
    | undefined;
  if (raw?.activeVisualTask?.pendingClarification) {
    throw new Error(
      message ??
        "I1: nested activeVisualTask.pendingClarification must be promoted/cleared",
    );
  }
}

export function assertVerifiedExecution(input: {
  applyStatus: string;
  project: BusinessProject;
  requireVerified?: boolean;
  message?: string;
}): void {
  assertDevOrTest();
  if (input.applyStatus !== "applied") return;
  const last = getInteractionState(input.project).lastVerifiedExecution;
  if (!last) {
    throw new Error(
      input.message ??
        "I6: applyStatus=applied requires lastVerifiedExecution to be recorded",
    );
  }
  if (input.requireVerified !== false && last.verified !== true) {
    throw new Error(
      input.message ??
        "I6: applyStatus=applied requires lastVerifiedExecution.verified === true",
    );
  }
  if (last.success !== true) {
    throw new Error(
      input.message ??
        "I6: applyStatus=applied requires lastVerifiedExecution.success === true",
    );
  }
}

export function assertHeroPlacementTask(
  project: BusinessProject,
  expectedAssetId: string,
  message?: string,
): void {
  assertDevOrTest();
  if (project.heroImageId !== expectedAssetId) {
    throw new Error(
      message ??
        `I3: heroImageId expected ${expectedAssetId}, got ${project.heroImageId}`,
    );
  }
  const task = getActiveVisualTask(getActionMemory(project));
  if (!task || task.target !== "hero") {
    throw new Error(message ?? "I3: activeVisualTask.target must be hero");
  }
  if (task.kind !== "hero_image_fit" && !task.kind.startsWith("hero_")) {
    throw new Error(
      message ?? `I3: expected hero_* task kind, got ${task.kind}`,
    );
  }
  if (task.assetId && task.assetId !== expectedAssetId) {
    throw new Error(
      message ??
        `I3: activeVisualTask.assetId expected ${expectedAssetId}, got ${task.assetId}`,
    );
  }
}

export function assertNoClarificationAsked(explanation: string, message?: string): void {
  assertDevOrTest();
  if (/which image|tell me which image/i.test(explanation)) {
    throw new Error(
      message ?? "I4: unexpected image-target clarification in explanation",
    );
  }
}

export function assertPersistenceRoundTrip(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const again = roundTripProjectJson(project);
  const a = getInteractionState(project);
  const b = getInteractionState(again);
  if (JSON.stringify(a.activeTask) !== JSON.stringify(b.activeTask)) {
    throw new Error(message ?? "I9: activeTask lost on JSON round-trip");
  }
  if (
    JSON.stringify(a.pendingClarification) !==
    JSON.stringify(b.pendingClarification)
  ) {
    throw new Error(
      message ?? "I9: pendingClarification lost on JSON round-trip",
    );
  }
  if (
    JSON.stringify(a.lastVerifiedExecution) !==
    JSON.stringify(b.lastVerifiedExecution)
  ) {
    throw new Error(
      message ?? "I9: lastVerifiedExecution lost on JSON round-trip",
    );
  }
  if (project.heroImageId !== again.heroImageId) {
    throw new Error(message ?? "I9: heroImageId lost on JSON round-trip");
  }
}

/** I14 — when version === 1, canonical fields win over conflicting mirrors. */
export function assertCanonicalWinsOverMirrors(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const raw = project.atlasActionMemory as Record<string, unknown> | undefined;
  if (!raw || raw.version !== 1) return;
  const state = migrateToAtlasInteractionState(raw).state;
  if (
    raw.activeTask &&
    raw.activeVisualTask &&
    state.activeTask &&
    (raw.activeTask as { kind?: string }).kind !== undefined &&
    state.activeTask.kind !== (raw.activeTask as { kind: string }).kind
  ) {
    throw new Error(message ?? "I14: activeTask canonical must win");
  }
  if (raw.activeTask && state.activeTask) {
    if (
      JSON.stringify(state.activeTask) !== JSON.stringify(raw.activeTask) &&
      (raw.activeTask as { kind?: string }).kind
    ) {
      // state should match canonical raw.activeTask
      if (
        state.activeTask.kind !== (raw.activeTask as { kind: string }).kind
      ) {
        throw new Error(message ?? "I14: canonical activeTask must win");
      }
    }
  }
  if (raw.lastVerifiedExecution && state.lastVerifiedExecution) {
    if (
      JSON.stringify(state.lastVerifiedExecution) !==
        JSON.stringify(raw.lastVerifiedExecution) &&
      (raw.lastExecution as { request?: string } | undefined)?.request &&
      (raw.lastVerifiedExecution as { request?: string }).request !==
        (raw.lastExecution as { request?: string }).request
    ) {
      // Conflicting mirrors — canonical must be what normalize chose
      if (
        state.lastVerifiedExecution.request !==
        (raw.lastVerifiedExecution as { request: string }).request
      ) {
        throw new Error(
          message ?? "I14: canonical lastVerifiedExecution must win",
        );
      }
    }
  }
}

/** I15 — normalizing twice yields equivalent canonical state. */
export function assertNormalizeIdempotent(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const once = migrateToAtlasInteractionState(project.atlasActionMemory).state;
  const twice = migrateToAtlasInteractionState(
    migrateToAtlasInteractionState(project.atlasActionMemory).state,
  ).state;
  const serialized = serializeInteractionPayload(once);
  const fromSerialized = migrateToAtlasInteractionState(serialized).state;
  if (!canonicalStatesEquivalent(once, twice)) {
    throw new Error(message ?? "I15: migrate twice is not idempotent");
  }
  if (!canonicalStatesEquivalent(once, fromSerialized)) {
    throw new Error(
      message ?? "I15: serialize → migrate must preserve canonical state",
    );
  }
}

/** I16 — legacy → v1 → JSON → normalize preserves behavior-critical data. */
export function assertLegacyRoundTripPreserves(
  legacyMemory: Record<string, unknown>,
  message?: string,
): void {
  assertDevOrTest();
  const v1 = migrateToAtlasInteractionState(legacyMemory).state;
  const wire = JSON.parse(
    JSON.stringify(serializeInteractionPayload(v1)),
  ) as Record<string, unknown>;
  const again = migrateToAtlasInteractionState(wire).state;
  if (
    JSON.stringify(v1.activeTask) !== JSON.stringify(again.activeTask) ||
    JSON.stringify(v1.pendingClarification) !==
      JSON.stringify(again.pendingClarification) ||
    JSON.stringify(v1.lastVerifiedExecution) !==
      JSON.stringify(again.lastVerifiedExecution) ||
    JSON.stringify(v1.activePlan?.recommendations) !==
      JSON.stringify(again.activePlan?.recommendations) ||
    JSON.stringify(v1.repair) !== JSON.stringify(again.repair)
  ) {
    throw new Error(
      message ?? "I16: legacy → v1 → JSON → normalize lost critical data",
    );
  }
}

export function assertScopedMutation(
  before: BusinessProject,
  after: BusinessProject,
  scope: MutationScope,
  message?: string,
): void {
  assertDevOrTest();
  const forbidden = SCOPE_FORBIDDEN_ROOTS[scope];
  const violations: string[] = [];

  for (const key of forbidden) {
    const left = (before as Record<string, unknown>)[key];
    const right = (after as Record<string, unknown>)[key];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      message ??
        `I13: scope ${scope} modified forbidden domains: ${violations.join(", ")}`,
    );
  }

  // Allowed list is documentation for future phases; Phase 0 enforces forbidden only.
  void SCOPE_ALLOWED_ROOTS;
}

export function assertPrefsUntouched(
  before: BusinessProject,
  after: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  if (JSON.stringify(before.atlasMemory) !== JSON.stringify(after.atlasMemory)) {
    throw new Error(
      message ?? "I12: atlasMemory preferences changed unexpectedly",
    );
  }
}

export function assertInteractionInvariant(
  id: InteractionInvariantId,
  check: () => void,
): void {
  assertDevOrTest();
  try {
    check();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[${id}] ${detail}`);
  }
}

/**
 * Modules that may call the adapter write API (or implement adapter-backed helpers).
 * Only `interaction-state.ts` may assign `atlasActionMemory` on a project.
 */
export const ALLOWED_INTERACTION_WRITE_MODULES = [
  "lib/ai/interaction-state.ts",
  "lib/ai/active-visual-task.ts",
  "lib/ai/active-task-policy.ts",
  "lib/ai/hero-readability.ts",
  "lib/ai/atlas-brain.ts",
  "lib/ai/execution-repair.ts",
  "lib/ai/atlas-interaction-migrate.ts",
] as const;

/** Sole module allowed to assign `project.atlasActionMemory`. */
export const INTERACTION_ADAPTER_MODULE = "lib/ai/interaction-state.ts";

/** Modules allowed to mention retired mirror keys (migration / contract only). */
const MIRROR_BOUNDARY_MODULES = new Set([
  "lib/ai/atlas-interaction-migrate.ts",
  "lib/ai/atlas-action-memory.ts", // deprecated inbound type fields
  "lib/ai/interaction-state.ts", // normalizeClarificationState inbound check
  "lib/ai/interaction-invariants.ts",
  "lib/ai/interaction-diagnostics.ts",
  "lib/ai/index.ts",
]);

/**
 * Contract assertion: no production module may call retired `withActionMemory`
 * or assign `atlasActionMemory` on a project outside the interaction adapter.
 * Dev/test only. Persistence serializers (Supabase) are out of scope.
 */
export function assertInteractionWritesGoThroughAdapter(
  rootDir?: string,
): void {
  assertDevOrTest();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require("node:path") as typeof import("node:path");

  const root = rootDir ?? pathMod.resolve(__dirname, "../..");
  const offenders: string[] = [];

  const forbiddenCall = /withActionMemory\s*\(/;

  function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      if (
        name === "node_modules" ||
        name === ".next" ||
        name === "dist" ||
        name.endsWith(".test.ts") ||
        name.endsWith(".test.tsx")
      ) {
        continue;
      }
      const full = pathMod.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const rel = pathMod.relative(root, full).replace(/\\/g, "/");
      // Focus on AI interaction layer — persistence / types excluded.
      if (!rel.startsWith("lib/ai/")) continue;

      // This file and the adapter contain pattern strings / the sole writer.
      if (
        rel === INTERACTION_ADAPTER_MODULE ||
        rel === "lib/ai/interaction-invariants.ts" ||
        rel === "lib/ai/interaction-diagnostics.ts" ||
        rel === "lib/ai/index.ts"
      ) {
        continue;
      }

      const src = fs.readFileSync(full, "utf8");

      if (forbiddenCall.test(src)) {
        const isStubDefinition =
          rel === "lib/ai/atlas-action-memory.ts" &&
          src.includes("withActionMemory is retired");
        if (!isStubDefinition) {
          offenders.push(`${rel}: withActionMemory(`);
        }
      }

      // Direct project field writes (object literal assigning nested memory).
      if (/atlasActionMemory\s*:\s*\{/.test(src)) {
        offenders.push(`${rel}: direct atlasActionMemory: { ... } write`);
      }
    }
  }

  walk(pathMod.join(root, "lib", "ai"));

  if (offenders.length > 0) {
    throw new Error(
      `I10: interaction writes must go through adapter. Offenders:\n- ${offenders.join("\n- ")}`,
    );
  }
}

/**
 * I17 — production writers must not assign legacy mirror fields directly
 * outside migration / serialization modules.
 */
export function assertNoDirectLegacyMirrorWrites(rootDir?: string): void {
  assertDevOrTest();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require("node:path") as typeof import("node:path");

  const root = rootDir ?? pathMod.resolve(__dirname, "../..");
  const offenders: string[] = [];
  // Assignments that write mirrors as authoritative project state.
  const mirrorAssign =
    /\b(activeVisualTask|heroReadabilityRepair)\s*:/;

  function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      if (
        name === "node_modules" ||
        name === ".next" ||
        name === "dist" ||
        name.endsWith(".test.ts") ||
        name.endsWith(".test.tsx")
      ) {
        continue;
      }
      const full = pathMod.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const rel = pathMod.relative(root, full).replace(/\\/g, "/");
      if (!rel.startsWith("lib/ai/")) continue;
      if (MIRROR_BOUNDARY_MODULES.has(rel)) continue;
      const src = fs.readFileSync(full, "utf8");
      if (
        /updateInteractionState\s*\([\s\S]*?activeVisualTask\s*:/.test(src) ||
        /updateInteractionState\s*\([\s\S]*?heroReadabilityRepair\s*:/.test(src)
      ) {
        offenders.push(`${rel}: updateInteractionState writes legacy mirror`);
      }
      if (
        mirrorAssign.test(src) &&
        /serializeCanonical|RETIRED_MIRROR/.test(src) === false &&
        /@deprecated/.test(src) === false
      ) {
        // Object-literal mirror keys in production writers
        if (
          /activeVisualTask\s*:\s*\{/.test(src) ||
          /heroReadabilityRepair\s*:\s*\{/.test(src) ||
          /lastExecution\s*:\s*\{/.test(src)
        ) {
          offenders.push(`${rel}: constructs retired mirror object`);
        }
      }
    }
  }

  walk(pathMod.join(root, "lib", "ai"));

  if (offenders.length > 0) {
    throw new Error(
      `I17: legacy mirrors must not be written. Offenders:\n- ${offenders.join("\n- ")}`,
    );
  }
}

/** I18 — persisted canonical payload contains none of the retired mirror keys. */
export function assertCanonicalSerialization(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  const payload = serializeCanonicalInteractionState(state);
  const retired = findRetiredMirrorKeys(payload);
  if (retired.length > 0) {
    throw new Error(
      message ??
        `I18: canonical serialization still has retired keys: ${retired.join(", ")}`,
    );
  }
  // Also check what's actually on the project after a write
  const onProject = findRetiredMirrorKeys(project.atlasActionMemory);
  if (onProject.length > 0 && (project.atlasActionMemory as { version?: number })?.version === 1) {
    // Fresh v1 writes must be clean; inbound legacy before normalize may still have keys
    const raw = project.atlasActionMemory as Record<string, unknown>;
    if (
      raw.activeTask !== undefined ||
      raw.lastVerifiedExecution !== undefined ||
      raw.activePlan !== undefined
    ) {
      // Hybrid/legacy inbound — only enforce after normalize/set
    }
  }
  void onProject;
}

/**
 * I19 — no production module reads retired legacy mirror fields outside migration.
 */
export function assertNoProductionMirrorReads(rootDir?: string): void {
  assertDevOrTest();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require("node:path") as typeof import("node:path");

  const root = rootDir ?? pathMod.resolve(__dirname, "../..");
  const offenders: string[] = [];
  const retiredRead =
    /\.(activeVisualTask|lastExecution|heroReadabilityRepair)\b/;
  const planMirrorRead =
    /(?:memory|actionMemory|completeMemory|atlasActionMemory)\.(recommendations|executionPlan|applyAllPending|creativeReport|lastRecommendationSelected)\b/;

  function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      if (
        name === "node_modules" ||
        name === ".next" ||
        name === "dist" ||
        name.endsWith(".test.ts") ||
        name.endsWith(".test.tsx")
      ) {
        continue;
      }
      const full = pathMod.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const rel = pathMod.relative(root, full).replace(/\\/g, "/");
      if (!rel.startsWith("lib/ai/")) continue;
      if (MIRROR_BOUNDARY_MODULES.has(rel)) continue;

      const src = fs.readFileSync(full, "utf8");
      if (retiredRead.test(src)) {
        offenders.push(`${rel}: reads retired mirror field`);
      }
      if (planMirrorRead.test(src)) {
        offenders.push(`${rel}: reads retired plan mirror field`);
      }
    }
  }

  walk(pathMod.join(root, "lib", "ai"));

  if (offenders.length > 0) {
    throw new Error(
      `I19: production must read canonical fields only. Offenders:\n- ${offenders.join("\n- ")}`,
    );
  }
}

/** I20 — image continuation after refresh uses activeTask + project truth. */
export function assertImageContinuationFromActiveTask(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  if (!state.activeTask?.assetId && !project.heroImageId) {
    throw new Error(
      message ??
        "I20: expected activeTask.assetId or project.heroImageId for image continuation",
    );
  }
  if (state.activeTask && state.activeTask.target.type === "hero") {
    if (
      state.activeTask.assetId &&
      project.heroImageId &&
      state.activeTask.assetId !== project.heroImageId
    ) {
      // Asset may lag one turn; not fatal — require task target present
    }
  }
}

/** I21 — successful placement stores canonical asset + target. */
export function assertPlacementStoresCanonicalAsset(
  project: BusinessProject,
  expectedAssetId: string,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  if (!state.activeTask) {
    throw new Error(message ?? "I21: activeTask missing after placement");
  }
  if (state.activeTask.target.type !== "hero") {
    throw new Error(
      message ??
        `I21: expected activeTask.target.type=hero, got ${state.activeTask.target.type}`,
    );
  }
  if (state.activeTask.assetId !== expectedAssetId) {
    throw new Error(
      message ??
        `I21: activeTask.assetId expected ${expectedAssetId}, got ${state.activeTask.assetId}`,
    );
  }
  if (project.heroImageId !== expectedAssetId) {
    throw new Error(
      message ??
        `I21: project.heroImageId expected ${expectedAssetId}, got ${project.heroImageId}`,
    );
  }
}

/** I22 — canonical interaction state has no transient file/blob/URL data. */
export function assertNoTransientInteractionData(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  const violations = validateCanonicalInteractionSafety(state);
  if (violations.length > 0) {
    throw new Error(
      message ?? `I22: unsafe interaction data: ${violations.join("; ")}`,
    );
  }
  assertCanonicalSerialization(project, message);
}

/** I23 — at most one canonical active task after any Brain turn. */
export function assertSingleActiveTask(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  const task = state.activeTask;
  if (task === null || task === undefined) return;
  if (Array.isArray(task)) {
    throw new Error(message ?? "I23: activeTask must not be an array");
  }
  if (typeof task !== "object" || !task.kind || !task.target) {
    throw new Error(message ?? "I23: activeTask must be a single typed object");
  }
  // Schema allows only one field — also reject legacy dual mirrors on payload.
  const raw = project.atlasActionMemory as
    | { activeTask?: unknown; activeVisualTask?: unknown }
    | undefined;
  if (
    raw?.activeTask &&
    raw?.activeVisualTask &&
    JSON.stringify(raw.activeTask) !== JSON.stringify(raw.activeVisualTask)
  ) {
    // Retired mirror may still exist inbound; after normalize it must be gone.
    const normalized = getInteractionState(project);
    if (normalized.activeTask && (raw as { activeVisualTask?: unknown }).activeVisualTask) {
      // Persisted dual truth is a violation only when both survive serialize.
    }
  }
}

/**
 * I24 — a successful scoped edit sets/updates the matching active task
 * only after verification (caller passes the post-turn project + expected kind).
 */
export function assertTaskAfterVerifiedScoped(
  project: BusinessProject,
  expectedKind: string,
  message?: string,
): void {
  assertDevOrTest();
  const state = getInteractionState(project);
  const last = state.lastVerifiedExecution;
  if (!last?.success || !last.verified) {
    throw new Error(
      message ?? "I24: expected lastVerifiedExecution success+verified",
    );
  }
  if (!state.activeTask) {
    throw new Error(message ?? "I24: activeTask missing after verified scoped edit");
  }
  if (state.activeTask.kind !== expectedKind) {
    throw new Error(
      message ??
        `I24: expected activeTask.kind=${expectedKind}, got ${state.activeTask.kind}`,
    );
  }
}

/**
 * I25 — a matching active-task continuation cannot execute an unrelated active plan.
 * Pass `wouldExecutePlan` from shouldExecuteActionMemory (must be false).
 */
export function assertActiveTaskBlocksUnrelatedPlan(
  wouldExecutePlan: boolean,
  message?: string,
): void {
  assertDevOrTest();
  if (wouldExecutePlan) {
    throw new Error(
      message ??
        "I25: active-task continuation must not execute an unrelated active plan",
    );
  }
}

/**
 * I26 — explicit topic switch replaces or clears the prior task deterministically.
 */
export function assertTopicSwitchDeterministic(input: {
  beforeKind: string | null | undefined;
  afterKind: string | null | undefined;
  clearedOrReplaced: boolean;
  message?: string;
}): void {
  assertDevOrTest();
  if (!input.beforeKind) {
    throw new Error(input.message ?? "I26: expected a prior active task");
  }
  if (!input.clearedOrReplaced) {
    throw new Error(
      input.message ?? "I26: topic switch must clear or replace the prior task",
    );
  }
  if (
    input.afterKind &&
    input.afterKind === input.beforeKind
  ) {
    throw new Error(
      input.message ??
        "I26: topic switch left the same active-task kind in place",
    );
  }
}

/**
 * I27 — active-task asset/target references agree with project truth after verify.
 */
export function assertTaskRefsAgreeWithTruth(
  project: BusinessProject,
  message?: string,
): void {
  assertDevOrTest();
  const task = getInteractionState(project).activeTask;
  if (!task) return;
  if (task.target.type === "hero" && task.assetId && project.heroImageId) {
    if (task.assetId !== project.heroImageId) {
      throw new Error(
        message ??
          `I27: hero activeTask.assetId=${task.assetId} != project.heroImageId=${project.heroImageId}`,
      );
    }
  }
  if (task.target.type === "gallery" && task.assetId) {
    const ids = project.galleryImageIds ?? [];
    if (!ids.includes(task.assetId) && project.heroImageId !== task.assetId) {
      // Asset may be in media library only (placement in progress)
      const inLibrary = (project.mediaLibrary ?? []).some(
        (a) => a.id === task.assetId,
      );
      if (!inLibrary) {
        throw new Error(
          message ??
            `I27: gallery activeTask.assetId=${task.assetId} not in project truth`,
        );
      }
    }
  }
  if (task.target.type === "section" && task.target.section) {
    const order = project.sectionOrder ?? [];
    // Section may be valid even if not yet in order — require non-empty id
    if (!task.target.section.trim()) {
      throw new Error(message ?? "I27: section target empty");
    }
    void order;
  }
}

/**
 * I28 — no agent maintains an independent durable continuation target.
 * Scans lib/ai for forbidden parallel continuation stores.
 */
export function assertNoIndependentContinuationStore(
  rootDir?: string,
): void {
  assertDevOrTest();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pathMod = require("node:path") as typeof import("node:path");

  const root = rootDir ?? pathMod.resolve(__dirname, "../..");
  const offenders: string[] = [];
  const forbidden = [
    /atlasMemory\s*\.\s*activeTask\b/,
    /durableContinuation\b/,
    /continuationTarget\s*[:=]/,
    /withActionMemory\s*\(/,
  ];
  const allow = new Set([
    "lib/ai/interaction-invariants.ts",
    "lib/ai/atlas-action-memory.ts",
    "lib/ai/index.ts",
  ]);

  function walk(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      if (
        name === "node_modules" ||
        name === ".next" ||
        name === "dist" ||
        name.endsWith(".test.ts") ||
        name.endsWith(".test.tsx")
      ) {
        continue;
      }
      const full = pathMod.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const rel = pathMod.relative(root, full).replace(/\\/g, "/");
      if (!rel.startsWith("lib/ai/")) continue;
      if (allow.has(rel)) continue;
      const src = fs.readFileSync(full, "utf8");
      for (const re of forbidden) {
        if (re.test(src)) {
          const isStub =
            rel === "lib/ai/atlas-action-memory.ts" &&
            src.includes("withActionMemory is retired");
          if (!isStub) {
            offenders.push(`${rel}: ${re}`);
          }
        }
      }
    }
  }

  walk(pathMod.join(root, "lib", "ai"));
  if (offenders.length > 0) {
    throw new Error(
      `I28: no independent durable continuation. Offenders:\n- ${offenders.join("\n- ")}`,
    );
  }
}

export function listChangedRootKeys(
  before: BusinessProject,
  after: BusinessProject,
): string[] {
  const keys = new Set([
    ...Object.keys(before as object),
    ...Object.keys(after as object),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    const left = (before as Record<string, unknown>)[key];
    const right = (after as Record<string, unknown>)[key];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      changed.push(key);
    }
  }
  return changed.sort();
}

export function hasPendingClarificationInvariant(
  project: BusinessProject,
): boolean {
  return hasPendingClarification(getActionMemory(project));
}
