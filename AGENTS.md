<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:atlas-interaction-ownership -->
# Atlas interaction state

Conversational / editing continuation is owned by versioned
`AtlasInteractionState` (v1) persisted in `content.atlasActionMemory`. **All
project writes** must use `setInteractionState` / `updateInteractionState` from
`lib/ai/interaction-state.ts`. Persist **canonical fields only** — never write
retired mirrors (`activeVisualTask`, `lastExecution`, `recommendations`, …).
Legacy payloads migrate on read. Short follow-ups continue via one canonical
`activeTask` + `lib/ai/active-task-policy.ts` (not Action Memory deny-lists).
Image continuation uses `activeTask` + project truth via `resolveImageReference`;
`ImageEditorState` is transient only. Do not call `withActionMemory` or assign
`atlasActionMemory` directly. Ownership: `docs/atlas-interaction-ownership.md`.
<!-- END:atlas-interaction-ownership -->
