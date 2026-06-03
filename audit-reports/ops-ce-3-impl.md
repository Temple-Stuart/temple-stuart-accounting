# OPS-CE-3 — Stage-1 AI enrich (per-step shot suggestions + library question assignment, human-gated) + minimal question manager

**Branch:** `claude/ops-ce-3` (off `main`; CE-1 + CE-2 merged & migrated in Azure)
**Date:** 2026-06-03
**One concept:** Stage-1 AI enrich for a routine — AI proposes per-step
camera angle / shot type / b-roll and **assigns a best-fit question from Alex's
own library** (proposing new wording only where none fits), surfaced as
**editable** prefills in ScenifyModal (the human gate); Alex's commit writes the
scene-rows via the existing upsert, **extended** to persist
`assigned_question_id` + `assigned_question_text`. Includes the **minimal question
manager** (the enabler — the library was empty with no UI).
Per `audit-reports/ops-content-engine-audit.md` (CE-3) + the locked decisions.
**0-schema** (CE-2 added the columns/table) — confirmed below, no migration.

> ✅ **0-schema** — `git diff` carries **no `prisma/schema.prisma`**. All targets
> exist on `main`: `operations_content_questions` (CE-2),
> `operations_content_scenes.assigned_question_id` / `assigned_question_text`
> (CE-2), `operations_routine_steps.is_active` (CE-1). Verified at STEP 1.

---

## STEP 1 — Audit (cited)

### 0-schema confirmed
- CE-2 table + columns present: `prisma/schema.prisma` — `assigned_question_id`
  (`:2921`), `assigned_question_text` (`:2922`), the `SceneAssignedQuestion`
  relation (`:2928`), `model operations_content_questions` (`:3005`).
- CE-1 filter present: `operations_routine_steps.is_active` (`:2811`, `@default(true)`).

### The AI pattern mirrored (North Star → tasks), end-to-end
- **Generate route (no save):** `operations/projects/[id]/generate-tasks/route.ts`
  — `getVerifiedEmail` → user → ownership 404, **validate inputs before the model**
  (`:64-72`), call generator, return `{ tasks, usage_id, cost, inspection }`
  (`:92-99`); header *"does NOT save … explicit acceptance gate"* (`:9-12`).
- **Generator + version row:** `lib/ai/generateProjectTasks.ts` — `SYSTEM_PROMPT`
  + **forced custom tool** (`return_project_tasks`, `TASK_SCHEMA`, `toolChoice`
  `:262`) through **`recordUsage`** (`lib/ai/recordUsage.ts:102-212`) which writes
  the **immutable `operations_ai_usage` row** (full prompt/response, `:151-168`) +
  an audit row, returning `{ toolUses, usageId, inspection }`.
- **Human gate:** `AITaskPreview.tsx` (editable preview → accept). For CE-3 the
  **ScenifyModal itself is the gate** (it already renders editable per-step fields
  + a "save scenes" commit) — no separate preview component needed.
- **Commit/append:** `tasks/bulk-create/route.ts` (ownership-verifies the usage id,
  appends). For CE-3 the commit is the **existing** `/content/scene-rows` upsert.

### Auth/tier — two patterns; chose the paid-API gate
- `src/app/api/ai/*` (market-brief `:3`, spending-insights `:21-22`, etc.) gate with
  **`requireTier(user.tier, 'ai', user.id)`** (`lib/auth-helpers.ts:41`; `'ai'` is a
  real `TierConfig` key, `lib/tiers.ts:20`).
- The sibling **`operations/ai/*`** routes (generate-tasks/generate-design) **omit**
  requireTier (predate it).
- **Decision:** the new paid enrich route **includes `requireTier`** — the brief
  points to the `src/app/api/ai/*` reference + "paid API, no shortcuts," and a tier
  gate is strictly more protective. Documented inline in the route header. (Not a
  STOP: the instruction + reference resolve it; the operations siblings are simply a
  pre-requireTier gap, not the reference.)

### Host UI + write path (PR-6)
- `ScenifyModal.tsx` loads `GET /routines/{id}` steps (each with `content_scene`)
  and upserts per step via `POST /content/scene-rows`.
- `/content/scene-rows/route.ts` upserts by `routine_step_id @unique`, server-derives
  `entity_id`, **CE-1 `is_active: true` ownership guard** (`:110-113`), audits
  `operations_content_scene_created/updated`. **Confirmed it did NOT accept the CE-2
  question fields** — extended this PR.

### Greenfield confirmed
`find src/app/api -ipath '*question*'` + `grep content_questions src/` → **no
question route/UI** existed. Built the minimal manager here.

---

## STEP 2 — Minimal question-library manager (the enabler)

**Routes** (auth mirrors `content/grid/piece/route.ts`; user-scoped; defensive 404):
- **`GET/POST /api/operations/content/questions`** (`questions/route.ts`) — GET lists
  **active** questions (`is_active=true`, optional `?entity_id`, ordered
  `sort_order, created_at`). POST creates (`question_text` required; `label`/
  `sort_order` optional; `entity_id` required + **owned** → defensive 404).
- **`DELETE /api/operations/content/questions/[id]`** (`questions/[id]/route.ts`) —
  **ARCHIVE** (`is_active=false`), **never hard-delete** (scenes snapshot the
  wording; FK is `SetNull`). Ownership 404.
- **Audit enum:** no `operations_content_question_*` enum exists →
  **`system_other`** with a clear description + `target.table =
  operations_content_questions` — **exactly the piece-create precedent**
  (`grid/piece/route.ts:98`). **FLAG:** add `operations_content_question_*` enum +
  switch over in a follow-up (same deferred-enum note already carried by the piece
  route).

**UI** — `QuestionLibrary.tsx` mounted on `operations/content/page.tsx` (between
`SectionG_Content` and `PieceGrid`): collapsible "❓ Question library", add
(label + text), list, archive. Entity-scoped via `useOperationsEntity()`
`selectedEntityId` (add requires a selected entity). Existing palette
(`border-brand-purple`, `bg-purple-50`, `text-text-*`, `font-mono`). No edit UI
beyond add/archive (one concept).

---

## STEP 3 — The enrich route (AI, human-gated, fail-loud)

- **`lib/ai/enrichRoutineScenes.ts`** — mirrors `generateProjectTasks.ts`: a
  `SYSTEM_PROMPT` with **absolute rules** (*never invent/merge/reorder steps; echo
  `routine_step_id`; library-first question assignment; propose new ONLY when no fit;
  craft fields are suggestions*), a **forced custom tool** `return_scene_enrichment`
  (`tool_choice` forces it), run through **`recordUsage`**
  (`purpose='routine_scene_enrichment'`, `target_table='operations_routines'`,
  `target_id=routineId`) → **immutable `operations_ai_usage` version row** with the
  full prompt+response. Returns the parsed per-step array + cost + usageId; **no DB
  write.**
  - **Hallucination guards (defensive normalization):** only enrichments whose
    `routine_step_id` is one of the provided steps survive; a `question_id` is honored
    **only if it is one of the provided library ids** (else treated as proposed-new) —
    and a library hit **snapshots the canonical library text**, not the model's copy
    (so the wording can't drift).
- **`POST /api/operations/content/enrich-routine`** (`enrich-routine/route.ts`) —
  `getVerifiedEmail` → user → **`requireTier(user.tier, 'ai', user.id)`** → load the
  routine (ownership 404) with **active steps only** (`where:{is_active:true}`, CE-1)
  + the user's **active question library** → call the generator → return
  `{ steps, usage_id, cost, library_size }`.
  - **FAIL-LOUD:** no active steps → **400 `InsufficientInput`** with a clear message
    (*"add steps … the AI never invents the steps you do"*). The model is **never**
    asked to fabricate steps. Empty library is allowed (every step `proposed_new`,
    flagged for the gate).

---

## STEP 4 — Preview gate + commit (extended upsert)

- **ScenifyModal** gains an **"✨ AI suggest"** button → calls the enrich route →
  **prefills** each step's angle / shot type / b-roll **and** the assigned question
  (id + text + `proposed_new`). Prefills are **fully editable** (the human gate);
  craft fields only overwrite when the AI offered one. A notice summarizes
  library-assigned vs proposed-new vs empty-library. Per step the question shows a
  **"from library"** (purple) vs **"proposed new"** (amber) badge; **editing the
  question text by hand** detaches the library id and re-flags it proposed-new (the
  snapshot is what's persisted). **Nothing auto-commits** — "save scenes" writes.
- **`/content/scene-rows` upsert extended** to accept + persist
  `assigned_question_text` (snapshot, always) and `assigned_question_id` (live link;
  **validated** to be an **active question owned by the caller**, else 400 —
  proposed-new commits with `id=null` + the text). Both are added to the shared
  create/update `shotData`. Ownership + CE-1 step guard + audit unchanged. Rows stay
  re-openable/editable (evolve how you shoot).

---

## STEP 5 — Verify (cited)

- **Question manager:** add/list/archive authed (`getVerifiedEmail` → user → owned
  entity/question), `system_other` audited; **archive sets `is_active=false`**, never
  deletes (`questions/[id]/route.ts`). UI lists active, adds, archives. ✅
- **Enrich:** suggestions land in the modal as **editable** prefills; library
  questions assigned by **id + snapshot text**; proposed-new **flagged** (amber);
  empty library → all proposed-new (notice); **no active steps → 400 fail-loud**, no
  fabrication; `recordUsage` writes the immutable `operations_ai_usage` row. ✅
- **Commit:** persists shot fields **+ `assigned_question_id`/`assigned_question_text`**
  via the extended upsert; dispatches `CONTENT_SCENES_CHANGED_EVENT` → PieceGrid
  refetch; takes/answers untouched (no take writes anywhere here). ✅
- **0-schema:** `git diff` has **no `prisma/schema.prisma`**. ✅
- **Auth on every route incl. tier on the AI route:** all four routes
  `getVerifiedEmail` + user-scope + defensive 404; enrich route adds
  `requireTier(..., 'ai', ...)`. ✅
- **Existing palette:** new UI uses `brand-purple` / `bg-purple-50` / `text-text-*` /
  `font-mono` only. ✅
- **tsc:** `npx tsc --noEmit` → **exit 0, 0 errors**. ✅
- **lint:** `npx eslint` on all 8 new/changed files → **exit 0, 0 problems**
  (typed the SDK `tools`/`toolChoice` via `unknown`-widening instead of the `as any`
  the reference `generateProjectTasks.ts:261-262` still carries — **strictly cleaner
  than the reference**). ✅

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| AI proposes, Alex commits — nothing writes scene-rows without his action | ✅ enrich returns a preview; ScenifyModal prefills; only "save scenes" POSTs |
| Library-first; proposed-new only when no fit, distinctly flagged; TEXT SNAPSHOT always persisted | ✅ system-prompt rule + id-validation guard; amber "proposed new" badge; `assigned_question_text` always sent/stored |
| NEVER fabricate steps/activities; fail-loud on insufficient input | ✅ step-id whitelist in normalization; 400 `InsufficientInput` on no active steps |
| Full auth on all routes; AI route mirrors AI-route auth+tier | ✅ getVerifiedEmail+user+404 everywhere; `requireTier('ai')` on enrich |
| 0-schema; archive-not-delete on questions; existing palette; tsc+lint clean | ✅ no schema; DELETE→`is_active=false`; palette kept; tsc 0 / lint 0 |

---

## Audit-enum flag (for sign-off)
The question routes and the piece route log under **`system_other`** (no
`operations_content_question_*` enum exists). This matches the established
piece-create precedent. **FOLLOW-UP (schema PR):** add
`operations_content_question_created/archived` (and the deferred
`operations_content_piece_*`) enum values and switch these writes over.

## git diff scope
New: `content/questions/route.ts`, `content/questions/[id]/route.ts`,
`content/enrich-routine/route.ts`, `lib/ai/enrichRoutineScenes.ts`,
`content/QuestionLibrary.tsx`. Modified: `content/scene-rows/route.ts` (persist
question), `content/ScenifyModal.tsx` (AI-suggest + question UI),
`operations/content/page.tsx` (mount manager). **No schema, no migration.**

---

## Result
"✨ AI suggest" in Scenify proposes per-step angle/shot-type/b-roll and assigns the
best-fit question from Alex's **own** library (proposing new wording only when none
fits, clearly flagged), through the mirrored North-Star AI pattern (forced tool →
immutable `operations_ai_usage` version row). Everything lands as **editable**
prefills — Alex reviews and commits; the existing scene-rows upsert, **extended**,
persists the shot fields plus the question's live id + **immutable text snapshot**.
A minimal question manager (list/add/archive, archive = soft-delete) makes the
library usable. Fail-loud on no steps; **never** fabricates activities. **0-schema**,
auth+tier on the AI route, palette intact, tsc + lint clean.
