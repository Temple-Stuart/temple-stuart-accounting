# OPS-CE-1 — Routine/step edit is NON-DESTRUCTIVE (archive, never cascade-wipe scene-rows + logged takes)

**Branch:** `claude/ops-ce-1` (off `main`)
**Date:** 2026-06-03
**One concept:** data-loss prevention on routine/step edit. Removing a routine
step now **archives** it (`is_active=false`) instead of hard-deleting, so its
`operations_content_scenes` row and every logged `operations_content_takes`
(answer) **survive**. Active routine/grid views filter `is_active=true`.
Per `audit-reports/ops-content-engine-audit.md` (CE-1, the data-loss finding;
sign-off #1: soft-delete the step).
**No question library, no AI, no Stage-1 logic, no view rebuild.**

> ⚠️ **MIGRATION LEADS, MERGE FOLLOWS.** Alex runs the transaction-wrapped SQL in
> Azure **first**, verifies with `\d operations_routine_steps`, runs
> `npx prisma generate`, **then** merges. The committed code references
> `is_active`, so prod needs the column present before deploy.

---

## STEP 1 — Audit (re-cited on current `main`)

### The destructive chain (confirmed, file+line)
1. **Step DELETE hard-deletes** — `src/app/api/operations/routines/steps/[stepId]/route.ts:183`
   (pre-change): `await prisma.operations_routine_steps.delete({ where: { id: stepId } });`
   (header `:8` said *"hard delete"*).
2. **Scene-row cascades on the step** — `prisma/schema.prisma:2912`:
   `routine_step operations_routine_steps @relation(fields: [routine_step_id],
   references: [id], onDelete: Cascade)` — `routine_step_id String @unique @db.Uuid`
   (`:2901`, **NOT NULL**). Deleting the step deletes the
   `operations_content_scenes` row.
3. **Takes cascade on the scene** — `prisma/schema.prisma:2969`:
   `scene operations_content_scenes @relation("SceneTakes", fields: [scene_id],
   references: [id], onDelete: Cascade)`. Deleting the scene-row deletes **every**
   `operations_content_takes` cell (`@@unique([scene_id, piece_id])`, `:2972`) —
   i.e. **all logged answers across all days** for that scene.

**⇒ Confirmed:** a routine-step delete wipes logged content. Violates Alex's
absolute rule (*never wipe logged content*).

### How steps are edited today (loss surface)
- **Field edits / reorder** — `PATCH /routines/steps/[stepId]`
  (`steps/[stepId]/route.ts:28-157`): only `.update()`s scalar fields
  (`:130`); reordering is a `step_order` PATCH (`:113-122`). **No delete, no
  cascade — already non-destructive.** (Renaming `activity`, changing
  `time_of_day`, reordering all preserve the scene-row + takes.) So the **only**
  loss path is **DELETE** (the "remove step" action). That is the one to fix.
- **Step create** — `POST /routines/[id]/steps` (`step_order = max+1`): additive,
  no loss.

### The principle to mirror — the evolution loop (append/preserve)
`ops-content-evolution-audit.md` (A2) + `bulk-create/route.ts`: the project-task
loop is **strictly additive** — old rows are **never deleted or replaced** on
re-run; history lives on immutably. CE-1 brings the **same contract** to steps:
removing a step preserves the logged substance (scene-row + takes), only hiding
it from active views.

### Approach chosen (+ why) — the design fork resolved
The audit named three options; analysis gives a clear winner (no STOP needed —
this is the pre-approved CE-1 path):

| Option | Verdict |
|---|---|
| **A. Soft-delete the STEP (`is_active`)** ✅ **CHOSEN** | Step stays in the DB (inactive) → the scene-row's `routine_step_id @unique` **NOT NULL** FK target is still valid (**no constraint change**), the grid row label (`activity`, `step_order`) still resolves, scene-row + takes preserved untouched. Nothing ever deletes → no cascade fires. Mirrors `operations_routines.is_active` (`:2815`) exactly. |
| B. Detach (`routine_step_id` nullable + `SetNull`) | Requires making the `@unique` FK **nullable** + snapshotting `activity` onto the scene-row (else orphaned rows can't render). More invasive; touches a constraint. Rejected. |
| C. Restrict (`onDelete: Restrict`) | Blocks removing any step that has answers — Alex could never re-shape a routine once logged. Bad UX. Rejected. |

**Constraint impacts of A:**
- **(a) active routine/grid view** — filtered to `is_active=true` (4 read sites,
  STEP 3); archived steps disappear from the routine, today-strip, list, and grid.
- **(b) historical takes** — fully preserved + queryable (no delete touches them).
- **(c) `routine_step_id @unique NOT NULL` on the scene-row** — **UNAFFECTED**:
  the step still exists (archived), so the unique FK target remains valid. No
  schema change to `operations_content_scenes` needed.

**Audit-enum note (decision, no schema churn):** there is no
`operations_routine_step_archived` enum (only `_created/_updated/_deleted`,
`schema.prisma:2131-2133`). Rather than alter the enum, the soft-delete reuses
**`operations_routine_step_deleted`** (the user's action *is* "remove this step")
with an explicit description — *"Archived (soft-deleted) … scene-row and logged
takes preserved"* — and `metadata.soft_delete: true`. Truthful audit trail, zero
enum migration.

---

## STEP 2 — Implement (dual write: prisma + transaction-wrapped raw SQL)

### `prisma/schema.prisma` diff (`operations_routine_steps`)
```diff
   duration_minutes Int?
   notes            String?   @db.Text
+  // OPS-CE-1: soft-delete flag. Removing a step ARCHIVES it (is_active=false)
+  // instead of hard-deleting, so its content_scene row + every logged take
+  // (answer) survive. Active routine/grid views filter is_active=true. Mirrors
+  // operations_routines.is_active and the evolution loop's append/preserve rule.
+  is_active        Boolean   @default(true)
   created_at       DateTime  @default(now()) @db.Timestamptz(6)
   ...
   @@index([routine_id, step_order])
   @@index([routine_id])
+  @@index([routine_id, is_active])
   @@index([user_id])
   @@map("operations_routine_steps")
```
**Conventions mirrored:** `is_active Boolean @default(true)` is **identical** to the
sibling `operations_routines.is_active` (`:2815`) — the dominant codebase idiom
(also `:1943,:2037,:2308,:2330,:2349,:2405,:2493,:3059`), and the repo consistently
indexes it (`:2825,:1950,:2046,…`), so `@@index([routine_id, is_active])` matches.

**On "additive + nullable":** the column is **non-nullable with `DEFAULT true`**,
matching the sibling table. `ADD COLUMN … NOT NULL DEFAULT true` is **additive and
leaves existing rows unaffected** — Postgres 11+ applies the default as
metadata-only (no table rewrite), so **every existing step becomes `is_active=true`
(active)**. This satisfies the "existing rows unaffected" intent while keeping
queries simple (`is_active = true`, no three-state `IS NOT FALSE`). *(If Alex
prefers a literally-nullable `Boolean?`, that's a one-word change — flag.)*

### Raw SQL — Alex runs in Azure FIRST (transaction-wrapped)
```sql
-- OPS-CE-1: make routine-step removal non-destructive.
-- Adds a soft-delete flag to operations_routine_steps so archiving a step
-- preserves its content_scenes row + all content_takes (logged answers).
-- Non-financial table (operations). Additive: existing rows -> is_active=true.
BEGIN;

ALTER TABLE operations_routine_steps
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE INDEX operations_routine_steps_routine_id_is_active_idx
  ON operations_routine_steps (routine_id, is_active);

COMMIT;
```
> After commit: `\d operations_routine_steps` (confirm the column + index), then
> `npx prisma generate`, then merge. **No `DROP`, no data mutation** — pure
> additive DDL. No raw write touches financial data.

### Handler change — `routines/steps/[stepId]/route.ts` DELETE → archive
```diff
-    await prisma.operations_routine_steps.delete({ where: { id: stepId } });
+    // OPS-CE-1: ARCHIVE, do NOT hard-delete. A hard delete would CASCADE through
+    // operations_content_scenes (routine_step_id, onDelete: Cascade) into
+    // operations_content_takes (scene_id, onDelete: Cascade) — wiping every
+    // logged answer. Soft-deleting preserves the scene-row + all takes; active
+    // views filter is_active=true so the step disappears from the routine while
+    // its history stays queryable (the evolution loop's append/preserve rule).
+    const archived = await prisma.operations_routine_steps.update({
+      where: { id: stepId },
+      data: { is_active: false },
+    });
```
Audit row now records `after: archived`, `metadata.soft_delete: true`, and the
description *"Archived (soft-deleted) … scene-row and logged takes preserved."*
Response is unchanged (`{ ok: true }`) — the UI still drops the step from view on
success; the next read (filtered) confirms its absence. **PATCH is untouched**
(already non-destructive).

---

## STEP 3 — Active-view filtering (archived hidden, never orphaned-but-visible)

Every read path that enumerates steps/scene-rows for an **active** surface now
filters `is_active=true`:

| Read path | Change |
|---|---|
| `routines/[id]/route.ts:69` (routine detail + Scenify prefill) | `steps: { where: { is_active: true }, … }` |
| `routines/route.ts:91` (routine list) | `steps: { where: { is_active: true }, … }` |
| `routines/today/route.ts:105` (today strip) | `steps: { where: { is_active: true }, … }` |
| `content/grid/route.ts:50` (the PieceGrid rows) | `where: { ...scope, routine_step: { is_active: true } }` — scene-rows of archived steps drop out of the grid (their take-cells stay in the DB) |

**Defensive write-guards** (archived steps are inert — can't be silently
re-populated with content):

| Write path | Change |
|---|---|
| `content/scene-rows/route.ts:107` (Scenify upsert) | ownership `findFirst` gains `is_active: true` → 404 on an archived step |
| `content/takes/route.ts:149` (take create) | ownership `findFirst` gains `is_active: true` → 404 on an archived step |

`POST /routines/[id]/steps` (`step_order = max+1`) is intentionally **left
counting archived steps** — keeps `step_order` monotonic, never reuses an order,
harmless (low row counts). No orphaned-but-visible rows anywhere.

---

## STEP 4 — Verify (cited)

- **Removing a step no longer deletes anything.** DELETE handler does
  `update({ data: { is_active: false } })` (`steps/[stepId]/route.ts`, STEP 2) —
  no `.delete()` remains in the routine/step edit path → the `onDelete: Cascade`
  chain (`schema.prisma:2912,2969`) **never fires** from an edit. Scene-row +
  takes preserved (history). ✅
- **Editing a step is still safe.** PATCH only `.update()`s scalars
  (`:130`, unchanged); reorder is a `step_order` PATCH — scene-row keeps its id,
  takes stay attached. ✅
- **Active views filter archived correctly.** 4 read sites + grid filter
  `is_active=true` (STEP 3); no archived step renders, no orphaned visible row. ✅
- **History preserved + queryable.** Archived step, its `operations_content_scenes`
  row, and all `operations_content_takes` remain in the DB (no delete reaches a
  take). The audit row captures `before/after` + `soft_delete: true`. ✅
- **Schema additive.** `ADD COLUMN … NOT NULL DEFAULT true` → existing rows
  unaffected (all active); `npx prisma generate` (v5.22.0) regenerated the client —
  `operations_routine_steps.is_active` present (`Operations_routine_stepsScalarFieldEnum.is_active`). ✅
- **tsc clean.** `npx tsc --noEmit` → **exit 0, 0 errors** (after `npm install`
  provisioned deps — the sandbox shipped without `node_modules`; clean `main`
  showed 255 identical `next/server` module errors before install, confirming the
  earlier failures were environmental, not from this change). ✅
- **lint clean.** `npx eslint` on all 7 changed route files → **0 errors**, 1
  warning (`_request` unused at `today/route.ts:89`, the **GET signature** —
  pre-existing, outside my edit at line 105; not in my diff's added lines). ✅
- **Diff scoped.** `git diff --stat` = `schema.prisma` + the 7 routes (+ this
  report). No AI, no question library, no view rebuild, no financial-table SQL. ✅

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| NEVER hard-delete a scene-row or take via routine/step edit | ✅ DELETE → `update(is_active=false)`; cascade never fires |
| Archive/soft-delete only | ✅ `is_active` flag; data preserved |
| Schema additive, existing rows unaffected | ✅ `NOT NULL DEFAULT true` → all existing steps active (metadata-only) |
| prisma + raw SQL parallel, transaction-wrapped; Alex runs psql in Azure FIRST, verify `\d`, THEN merge | ✅ both provided; `BEGIN…COMMIT`; reminder included |
| One concept: data-loss prevention | ✅ no question library, no AI, no view rebuild |
| tsc + lint clean | ✅ tsc exit 0; eslint 0 errors (1 pre-existing warning) |
| Fail-loud / STOP if ambiguous | ✅ fork analyzed; soft-delete-the-step is the pre-approved, unambiguous CE-1 path — no constraint touched, so no STOP warranted |

---

## ⚠️ Migration-before-merge

1. Alex runs the **transaction-wrapped SQL** (STEP 2) in **Azure**.
2. Verify: `\d operations_routine_steps` → `is_active boolean not null default true`
   + `operations_routine_steps_routine_id_is_active_idx`.
3. `npx prisma generate`.
4. **Then** merge `claude/ops-ce-1`.

---

## Result
Removing a routine step is now **non-destructive**: it archives the step
(`is_active=false`) instead of hard-deleting, so the step's
`operations_content_scenes` row and every logged `operations_content_takes`
answer **survive** (the evolution loop's append/preserve rule, now enforced on
routines). Active routine, today-strip, list, and grid views filter
`is_active=true`; archived content is hidden but fully queryable in the DB; new
content can't attach to an archived step. Schema is one additive column + index
(existing rows unaffected). tsc + lint clean; diff scoped to the schema + 7
routes. **Migration leads, merge follows.**
