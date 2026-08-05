/**
 * Sprint 29.4 — Canonical-only serialization + legacy migration fixtures.
 */

import { describe, expect, it } from "vitest";
import {
  getActionMemory,
  storePendingClarification,
  storeRecommendations,
} from "@/lib/ai/atlas-action-memory";
import {
  canonicalStatesEquivalent,
  findRetiredMirrorKeys,
  migrateToAtlasInteractionState,
  serializeCanonicalInteractionState,
  validateCanonicalInteractionSafety,
} from "@/lib/ai/atlas-interaction-migrate";
import { emptyAtlasInteractionState } from "@/lib/ai/atlas-interaction-types";
import {
  assertCanonicalSerialization,
  assertInteractionInvariant,
  assertLegacyRoundTripPreserves,
  assertNoDirectLegacyMirrorWrites,
  assertNoProductionMirrorReads,
  assertNoTransientInteractionData,
  assertNormalizeIdempotent,
} from "@/lib/ai/interaction-invariants";
import { getInteractionDiagnostics } from "@/lib/ai/interaction-diagnostics";
import {
  getInteractionState,
  normalizeInteractionState,
  roundTripProjectJson,
  setInteractionState,
  updateInteractionState,
} from "@/lib/ai/interaction-state";
import { MOCK_BUSINESS_PROJECT } from "@/data/mock-project";
import type { BusinessProject } from "@/types/business-project";

function base(overrides: Partial<BusinessProject> = {}): BusinessProject {
  return {
    ...MOCK_BUSINESS_PROJECT,
    atlasActionMemory: undefined,
    ...overrides,
  };
}

const LEGACY_HERO_TASK = {
  updatedAt: "2026-01-01T00:00:00.000Z",
  activeVisualTask: {
    kind: "hero_image_fit" as const,
    target: "hero" as const,
    assetId: "hero-busy",
    lastUserGoal: "show the full picture",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const LEGACY_COLOR_PENDING = storePendingClarification(undefined, {
  question: "Which accent color should we restore?",
  kind: "color",
  destination: "restore_accent",
  resolveTo: "accentColor",
});

const LEGACY_IMAGE_TARGET = storePendingClarification(undefined, {
  question:
    "Which image should use the full-photo fit: the hero image or a gallery image?",
  kind: "image_target",
  destination: "apply_hero_fit",
});

const LEGACY_EXECUTION = {
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastExecution: {
    request: "Don't crop it.",
    at: "2026-01-01T00:00:00.000Z",
    success: true,
    verified: true,
    operationTypes: ["hero_image_fit"],
    operations: [],
    verificationFailures: [],
    createdEntities: [],
    modifiedEntities: ["heroImagePresentation"],
    explanation: "Showing the full hero photo.",
    paletteBefore: {
      primaryColor: "#1a3a2a",
      secondaryColor: "#2d5a3f",
      accentColor: "#c9a227",
      backgroundColor: "#f5f0e8",
      theme: "light" as const,
    },
    scope: "hero" as const,
  },
};

const LEGACY_REPAIR = {
  updatedAt: "2026-01-01T00:00:00.000Z",
  heroReadabilityRepair: {
    level: 2 as const,
    heroImageId: "hero-busy",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("Sprint 29.4 migration + canonical-only persist", () => {
  it("empty project → default v1 state", () => {
    const migrated = migrateToAtlasInteractionState(undefined);
    expect(migrated.source).toBe("empty_default");
    expect(migrated.state.version).toBe(1);
    const project = normalizeInteractionState(base());
    expect(getInteractionState(project).version).toBe(1);
    assertCanonicalSerialization(project);
  });

  it("legacy Action Memory loads and save drops retired mirrors", () => {
    const project = setInteractionState(base(), LEGACY_HERO_TASK);
    const raw = project.atlasActionMemory as Record<string, unknown>;
    expect(raw.version).toBe(1);
    expect(raw.activeTask).toBeTruthy();
    expect(findRetiredMirrorKeys(raw)).toEqual([]);
    expect(raw.activeVisualTask).toBeUndefined();
    expect(getInteractionState(project).activeTask?.kind).toBe("hero_image_fit");
  });

  it("pending clarifications and execution migrate into canonical fields", () => {
    expect(
      migrateToAtlasInteractionState(LEGACY_COLOR_PENDING).state
        .pendingClarification?.kind,
    ).toBe("color");
    expect(
      migrateToAtlasInteractionState(LEGACY_IMAGE_TARGET).state
        .pendingClarification?.kind,
    ).toBe("image_target");
    const exec = migrateToAtlasInteractionState(LEGACY_EXECUTION).state;
    expect(exec.lastVerifiedExecution?.verified).toBe(true);
    expect(exec.preservation?.brandPalette?.accentColor).toBe("#c9a227");
    expect(
      migrateToAtlasInteractionState(LEGACY_REPAIR).state.repair
        ?.heroReadability?.level,
    ).toBe(2);
  });

  it("active critique plan maps to activePlan only", () => {
    const withPlan = storeRecommendations(undefined, {
      creative: [
        {
          id: "rec-1",
          title: "Sharper hero",
          kind: "visual",
          applyable: true,
          operations: [],
          explanation: "Tighten the hero.",
          impact: "medium",
          impactScore: 50,
          confidence: 0.8,
          capabilityIds: [],
          estimatedTime: "2m",
        },
      ],
    });
    expect(withPlan.activePlan?.recommendations[0]?.id).toBe("rec-1");
    expect(withPlan.recommendations).toBeUndefined();
    const saved = setInteractionState(base(), withPlan);
    expect(
      (saved.atlasActionMemory as Record<string, unknown>).recommendations,
    ).toBeUndefined();
    expect(getActionMemory(saved).activePlan?.recommendations[0]?.id).toBe(
      "rec-1",
    );
  });

  it("conflicting legacy + v1 fields — canonical wins", () => {
    const conflicting = {
      version: 1 as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
      activeTask: {
        kind: "hero_balance" as const,
        target: { type: "hero" as const },
        assetId: "hero-canonical",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      activeVisualTask: {
        kind: "hero_image_fit" as const,
        target: "hero" as const,
        assetId: "hero-legacy",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      lastVerifiedExecution: {
        request: "canonical request",
        at: "2026-01-01T00:00:00.000Z",
        success: true,
        verified: true,
        operationTypes: [],
        operations: [],
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [],
        explanation: "canonical",
      },
      lastExecution: {
        request: "legacy request",
        at: "2026-01-01T00:00:00.000Z",
        success: false,
        verified: false,
        operationTypes: [],
        operations: [],
        verificationFailures: [],
        createdEntities: [],
        modifiedEntities: [],
        explanation: "legacy",
      },
      pendingClarification: null,
      preservation: null,
      activePlan: null,
      repair: null,
    };
    const migrated = migrateToAtlasInteractionState(conflicting);
    expect(migrated.state.activeTask?.kind).toBe("hero_balance");
    expect(migrated.state.lastVerifiedExecution?.request).toBe("canonical request");
    const saved = setInteractionState(base(), conflicting);
    expect(findRetiredMirrorKeys(saved.atlasActionMemory)).toEqual([]);
  });

  it("unknown extra fields and malformed legacy normalize safely", () => {
    const weird = {
      ...LEGACY_HERO_TASK,
      futureSafeField: { nested: true },
      activeVisualTask: {
        kind: "hero_image_fit",
        target: "hero",
        assetId: "hero-busy",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    expect(() => migrateToAtlasInteractionState(weird)).not.toThrow();
    expect(() =>
      normalizeInteractionState(base({ atlasActionMemory: weird })),
    ).not.toThrow();
  });

  it("refresh after lazy migration preserves canonical state", () => {
    const project = setInteractionState(base(), LEGACY_HERO_TASK);
    const refreshed = normalizeInteractionState(roundTripProjectJson(project));
    expect(getInteractionState(refreshed).activeTask?.kind).toBe(
      "hero_image_fit",
    );
    expect(getActionMemory(refreshed).activeTask?.kind).toBe("hero_image_fit");
    expect(findRetiredMirrorKeys(refreshed.atlasActionMemory)).toEqual([]);
  });

  it("write after migration stays canonical-only", () => {
    const migrated = normalizeInteractionState(
      base({ atlasActionMemory: LEGACY_HERO_TASK }),
    );
    const written = updateInteractionState(migrated, (state) => ({
      ...state,
      activeTask: state.activeTask
        ? {
            ...state.activeTask,
            userGoal: "make it clearer",
            updatedAt: new Date().toISOString(),
          }
        : null,
    }));
    const raw = written.atlasActionMemory as Record<string, unknown>;
    expect(raw.version).toBe(1);
    expect(raw.activeTask).toBeTruthy();
    expect(raw.activeVisualTask).toBeUndefined();
    expect(raw.lastExecution).toBeUndefined();
    expect(raw.heroReadabilityRepair).toBeUndefined();
  });

  it("old production fixture round-trips (I16) and serializes clean (I18)", () => {
    const productionFixture = {
      updatedAt: "2025-12-15T12:00:00.000Z",
      ...LEGACY_HERO_TASK,
      ...LEGACY_EXECUTION,
      pendingClarification: LEGACY_IMAGE_TARGET.pendingClarification,
      heroReadabilityRepair: LEGACY_REPAIR.heroReadabilityRepair,
      recommendations: [
        {
          id: "prod-rec",
          source: "design_critique" as const,
          title: "Improve hero",
          kind: "visual",
          applyable: true,
          operations: [],
        },
      ],
      applyAllPending: true,
      mysteryFieldFromProd: "keep-me-around-conceptually",
    };
    assertInteractionInvariant("I16_legacy_round_trip", () => {
      assertLegacyRoundTripPreserves(productionFixture);
    });
    const project = normalizeInteractionState(
      base({ atlasActionMemory: productionFixture }),
    );
    expect(getActionMemory(project).activePlan?.recommendations?.[0]?.id).toBe(
      "prod-rec",
    );
    assertInteractionInvariant("I18_canonical_serialization", () => {
      assertCanonicalSerialization(project);
    });
  });

  it("normalize is idempotent (I15)", () => {
    const project = setInteractionState(base(), {
      ...LEGACY_HERO_TASK,
      ...LEGACY_COLOR_PENDING,
    });
    assertInteractionInvariant("I15_normalize_idempotent", () => {
      assertNormalizeIdempotent(project);
    });
    const a = migrateToAtlasInteractionState(project.atlasActionMemory).state;
    const b = migrateToAtlasInteractionState(
      serializeCanonicalInteractionState(a),
    ).state;
    expect(canonicalStatesEquivalent(a, b)).toBe(true);
  });

  it("I17 / I19 — no direct mirror writes or production reads", () => {
    assertInteractionInvariant("I17_no_direct_mirror_writes", () => {
      assertNoDirectLegacyMirrorWrites();
    });
    assertInteractionInvariant("I19_no_production_mirror_reads", () => {
      assertNoProductionMirrorReads();
    });
  });

  it("I22 — no transient file data in canonical state", () => {
    const project = setInteractionState(base(), LEGACY_EXECUTION);
    assertInteractionInvariant("I22_no_transient_file_data", () => {
      assertNoTransientInteractionData(project);
    });
    expect(validateCanonicalInteractionSafety(getInteractionState(project))).toEqual(
      [],
    );
  });

  it("diagnostics report canonical_only serialization", () => {
    const project = normalizeInteractionState(
      base({ atlasActionMemory: LEGACY_HERO_TASK }),
    );
    const diag = getInteractionDiagnostics(project);
    expect(diag?.interactionVersion).toBe(1);
    expect(diag?.serializationMode).toBe("canonical_only");
    expect(diag?.adapterPhase).toBe(5);
    expect(diag?.canonicalStatePresent).toBe(true);
    expect(typeof diag?.interactionSerializedBytes).toBe("number");
  });

  it("emptyAtlasInteractionState is a valid default", () => {
    const empty = emptyAtlasInteractionState("2026-01-01T00:00:00.000Z");
    expect(empty.version).toBe(1);
    expect(findRetiredMirrorKeys(serializeCanonicalInteractionState(empty))).toEqual(
      [],
    );
  });
});
