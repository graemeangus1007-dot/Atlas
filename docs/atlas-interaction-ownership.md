# Atlas Interaction Ownership

**Sprint:** 29.5 — Generalize Canonical Active Tasks (Phase 5)  
**Status:** One durable `activeTask` policy for all supported editing domains.  
**Source of truth:** Atlas Reliability Foundation — Canonical Interaction State Audit.

This document is the permanent reference for what owns conversational / editing continuation state. Future contributors must not introduce a parallel memory layer.

---

## Layers

| Layer | Owner | Persisted? | Purpose |
|---|---|---|---|
| **Interaction owner** | `project.atlasActionMemory` via `lib/ai/interaction-state.ts` | Yes (`content.atlasActionMemory`) | Versioned `AtlasInteractionState` (v1) **canonical fields only** |
| **Project truth** | Branding / content fields on `BusinessProject` | Yes | Visual results: `heroImageId`, gallery, media, sections |
| **Preference memory** | `project.atlasMemory` | Yes | Durable designer prefs — never turn continuation |
| **Ephemeral request state** | API / React only | No | `AttachmentContext[]`, transient `ImageEditorState` |

Persistence key remains `content.atlasActionMemory`. No sibling blob.

---

## Canonical model (v1)

```ts
AtlasInteractionState {
  version: 1;
  updatedAt: string;
  activeTask: AtlasActiveTask | null;
  pendingClarification: PendingClarification | null;
  lastVerifiedExecution: LastVerifiedExecution | null;
  preservation: InteractionPreservation | null;
  activePlan: ActiveInteractionPlan | null;
  repair: InteractionRepairState | null;
  lastClarificationClear?: { reason; at } | null;
}
```

### Active task (all domains)

```ts
AtlasActiveTask {
  kind:
    | "hero_readability" | "hero_balance" | "hero_image_fit"
    | "hero_crop" | "hero_composition"
    | "gallery_interaction" | "gallery_metadata"
    | "image_placement" | "surface_style" | "section_layout"
    | "brand_restore" | "plan_execution";
  target:
    | { type: "hero" }
    | { type: "gallery"; itemId?; index? }
    | { type: "section"; section }
    | { type: "surface"; surface }
    | { type: "logo" } | { type: "plan" } | { type: "unknown" };
  assetId?: string;
  userGoal?: string;
  repairLevel?: number;
  updatedAt: string;
}
```

Policy module: `lib/ai/active-task-policy.ts`

- `getActiveTaskPolicy(kind)`
- `canContinueActiveTask(task, request)`
- `shouldReplaceActiveTask(current, nextIntent)`
- `shouldClearActiveTask(reason)`
- `touchActiveTask` / `clearActiveTask` (after verified success or typed clarification)

### Retired mirror keys (never written)

`activeVisualTask`, `lastExecution`, `recommendations`, `recommendationIds`,
`executionPlan`, `creativeReport`, `applyAllPending`, `lastRecommendationSelected`,
`heroReadabilityRepair`, `source`

Legacy payloads containing these keys are migrated on read; the next save writes
canonical v1 only.

---

## Routing lifecycle

1. Typed pending clarification  
2. Corrective dispute about last verified execution  
3. Active-task continuation  
4. Explicit fresh command  
5. Active-plan continuation  
6. Critique / strategy  
7. Informational question  
8. Clarification  

A matching active task has one owner. Other agents must not independently reinterpret the message. Active plans cannot hijack scoped active-task continuations (I25).

---

## Image continuation

| Concern | Owner |
|---|---|
| Current-message uploads | `AttachmentContext` (request only) |
| Durable edit focus | `activeTask.assetId` + `activeTask.target` |
| Visual results | Project truth (`heroImageId`, gallery slots, …) |
| Transient “this/that” cue | `ImageEditorState` (client/request; **not** authoritative) |

Use **`resolveImageReference({ interactionState, attachmentContexts, project, message })`**
as the single resolver.

---

## Lazy migration

```
legacy payload → migrate to v1 in memory → use canonical fields → save writes v1 only
```

No database migration. Unknown unrelated content fields are left alone.

---

## Writers

| Module | Role |
|---|---|
| `lib/ai/interaction-state.ts` | **Sole** assigner of `project.atlasActionMemory` |
| `lib/ai/atlas-interaction-migrate.ts` | Inbound migrate + canonical serialize |
| `lib/ai/active-task-policy.ts` | → `activeTask` (all domains) |
| `lib/ai/active-visual-task.ts` | Hero-shaped helpers → `activeTask` |
| `lib/ai/hero-readability.ts` | → `repair.heroReadability` |
| `lib/ai/atlas-brain.ts` / `execution-repair.ts` | via adapter |
| `lib/ai/atlas-action-memory.ts` | Pure transforms (canonical fields) |

---

## Invariants (CI)

**I1–I22** preserved. Added in Phase 5:

- **I23** — At most one canonical active task after any Brain turn  
- **I24** — Successful scoped edit sets/updates matching active task only after verification  
- **I25** — Matching active-task continuation cannot execute an unrelated active plan  
- **I26** — Explicit topic switch replaces or clears the prior task deterministically  
- **I27** — Active-task asset/target references agree with project truth after verified execution  
- **I28** — No agent maintains an independent durable continuation target  

---

## Diagnostics (dev only)

- `activeTaskKind` / `activeTaskTarget` / `activeTaskAssetId`  
- `continuationOwner` / `continuationMatched`  
- `taskTransition` / `taskTransitionReason`  
- `activePlanConsidered` / `activePlanExecuted`  
- `adapterPhase: 5`

Never expose in production UI.

---

## Migration phases

| Phase | Status |
|---|---|
| 0–4 | Complete |
| **5 (this sprint)** | Generalized canonical active tasks |
| 6+ | Future reliability work |
