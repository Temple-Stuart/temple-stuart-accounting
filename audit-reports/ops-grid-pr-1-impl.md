# OPS-GRID-PR-1 — Content-table naming lock (rename to Alex's grid vocabulary)

**Branch:** `claude/ops-grid-pr-1`
**Date:** 2026-06-03
**One concept:** the **naming lock** — rename the (barely-used) content tables to Alex's
grid vocabulary **before** building the grid, so no rename migration is needed later.
Per `audit-reports/ops-content-table-audit.md` sign-off #1.
**Rename only.** No new tables, no new fields, no view changes.

> **Sign-off obtained (this PR):** the rename collides on the name `operations_content_scenes`.
> Alex chose **(1)** resolve it **non-destructively** (rename the container out of the way —
> no data dropped) and **(2)** scope **= schema + model refs only** (leave API route URLs,
> component filenames, and audit-enum labels for a follow-up). Both answers drive what's below.

---

## 1. Current models, references, and data-volume basis (cited)

### The two models (pre-rename)
| Model | Lines | Grain | Fields | Relation |
|---|---|---|---|---|
| `operations_content_scenes` | `prisma/schema.prisma:2873-2894` | **per routine** (`routine_id @unique :2877`) | `scene_number/scene_title/focus_category/filming_location_base/estimated_hours/script` | `operations_routines.content_scene` (1:1, `:2821`) |
| `operations_content_takes` | `:2896-2914` | **per routine_step** (`routine_step_id @unique :2900`) | `filming_location_specific/camera_needed/filming_angle/notes` | `operations_routine_steps.content_take` (1:1, `:2847`) |

### Blast radius (all references)
- **Schema:** 2 models + 2 `@@map` + 2 relation fields (`content_scene :2821`, `content_take :2847`).
- **Prisma client calls:** 19 `prisma.operations_content_{scenes,takes}.*` across the 4 content
  routes (`content/scenes/route.ts`, `content/scenes/[id]/route.ts`, `content/takes/route.ts`,
  `content/takes/[id]/route.ts`), incl. 2 `Prisma.*UpdateInput` types
  (`scenes/[id]:100`, `takes/[id]:99`).
- **Relation-field usages** (`content_scene`/`content_take` in includes/selects/property
  access): **49** across **13 files** — the 4 content routes, the 2 routines routes
  (`routines/route.ts`, `routines/[id]/route.ts`), and 7 components
  (`ContentTable.tsx`, `SectionG_Content.tsx`, `ScenifyButton.tsx`, `TakeifyButton.tsx`,
  `AvailableRoutinesList.tsx`, `RoutineList.tsx`, `routines/types.ts`).
- **Audit-action enum** `AuditActionType.operations_content_{scene,take}_{created,updated,deleted}`
  (`:2134-2139`) + 10 string usages — **left unchanged** (see §4).

### Data volume — basis
**Not knowable from the repo.** Rows live in **Azure**, not in source; the only migration is
the table *creation* (`prisma/migrations/20260518500000_operations_content_scenes/migration.sql`)
— **no seed INSERTs**. The audit's "barely used" is a usage-surface inference, not a row count.
**Alex should confirm via psql** (`SELECT count(*) FROM operations_content_scenes;` /
`…_takes;`). This uncertainty is *why* the destructive option was refused — **we never drop
rows we can't prove are empty.** The chosen path (RENAME) is safe regardless of row count.

---

## 2. The rename map (old → new) — Alex's vocabulary

Alex's locked grid vocabulary: **SCENE = a row (stable shot)**, PIECE = a column (a day, later),
TAKE = a cell (per-day script, later). The existing names are inverted, so:

| # | Thing | Old | New | Kind |
|---|---|---|---|---|
| a | container model (per routine) | `operations_content_scenes` | **`operations_content_scene_groups`** | RENAME (non-destructive) |
| b | container `@@map` / table | `operations_content_scenes` | **`operations_content_scene_groups`** | `ALTER…RENAME TO` |
| c | row model (per step = SCENE) | `operations_content_takes` | **`operations_content_scenes`** | RENAME (non-destructive) |
| d | row `@@map` / table | `operations_content_takes` | **`operations_content_scenes`** | `ALTER…RENAME TO` |
| e | routine relation field | `content_scene` → container | **`content_scene_group`** | field rename |
| f | routine_step relation field | `content_take` → row | **`content_scene`** | field rename |

Reserved for later PRs (not created here): `operations_content_takes` = the **cell**,
`operations_content_pieces` = the **day column**.

### Destructive steps: **NONE.**
Every change is an `ALTER TABLE … RENAME` (or a schema-field rename) — **all rows preserved**.
The container is **renamed, not dropped** (Alex's choice). No `DROP`/`CREATE`-with-data anywhere.
The two table renames **cross** (`takes→scenes` while `scenes→scene_groups`), so the order
matters: **vacate `scenes` first**, then the row takes the freed name (see §3 SQL).

---

## 3. The change — schema diff + the exact psql SQL

### schema.prisma diff (rename-only, 6 insertions / 6 deletions)
```diff
 model operations_routines {
-  content_scene operations_content_scenes?
+  content_scene_group operations_content_scene_groups?
 }
 model operations_routine_steps {
-  content_take operations_content_takes?
+  content_scene operations_content_scenes?
 }
-model operations_content_scenes {            # the per-routine CONTAINER
+model operations_content_scene_groups {
   ... (fields unchanged) ...
-  @@map("operations_content_scenes")
+  @@map("operations_content_scene_groups")
 }
-model operations_content_takes {             # the per-step ROW = Alex's SCENE
+model operations_content_scenes {
   ... (fields unchanged) ...
-  @@map("operations_content_takes")
+  @@map("operations_content_scenes")
 }
```
(Field lists, `@unique`s, `@@index`es, and back-relations `routine`/`routine_step` are
**unchanged** — names only.)

### The psql RENAME — Alex runs this in Azure **BEFORE** merge
```sql
BEGIN;
-- 1) vacate the name: the per-routine CONTAINER steps aside (data preserved)
ALTER TABLE operations_content_scenes RENAME TO operations_content_scene_groups;
-- 2) the stable-shot ROW takes the freed name (Alex's SCENE = a row; data preserved)
ALTER TABLE operations_content_takes  RENAME TO operations_content_scenes;
COMMIT;
```
- **Order is required** (collision): step 1 frees `operations_content_scenes` before step 2
  reuses it. Wrapped in a transaction — both or neither.
- **Indexes/constraints keep their old names** (e.g. `operations_content_scenes_routine_id_key`
  now sits on `operations_content_scene_groups`; `operations_content_takes_routine_step_id_key`
  now on `operations_content_scenes`). This is **cosmetic** — `prisma generate` reads
  `schema.prisma` only and does **not** introspect the DB, so runtime is unaffected. No name
  collision occurs (the two index-name families stay distinct). Optional tidy-rename later.

---

## 4. Code references updated (cited) + what was intentionally left

### Updated so tsc compiles (55 insertions / 55 deletions, 14 files)
- **Schema** (`prisma/schema.prisma`): models a/c, `@@map` b/d, relation fields e/f.
- **Content routes** (19 prisma calls + 2 input types): `content/scenes/route.ts`,
  `content/scenes/[id]/route.ts` (`Prisma.operations_content_scene_groupsUpdateInput`),
  `content/takes/route.ts`, `content/takes/[id]/route.ts`
  (`Prisma.operations_content_scenesUpdateInput`). Each call now targets the table holding
  **the same physical data it did before** (pure rename, no logic change): the `/scenes`
  route operates on the container (`…_scene_groups`), the `/takes` route on the row (`…_scenes`).
- **Routines routes** (`routines/route.ts`, `routines/[id]/route.ts`): include keys
  `content_scene_group`.
- **Components**: `ContentTable.tsx`, `SectionG_Content.tsx`, `ScenifyButton.tsx`,
  `TakeifyButton.tsx`, `AvailableRoutinesList.tsx`, `RoutineList.tsx`, `routines/types.ts` —
  relation-field property accesses + type fields (`content_scene_group`/`content_scene`).

### Intentionally LEFT (per "schema + model refs only" scope) — flagged for a follow-up PR
1. **API route URL paths** (`/api/operations/content/{scenes,takes}`) and **component
   filenames** (`ScenifyButton.tsx`/`TakeifyButton.tsx`) — unchanged. **Consequence:** the
   URL `/content/scenes` now CRUDs the *container* model `operations_content_scene_groups`,
   and `/content/takes` now CRUDs the *row* model `operations_content_scenes` — a
   route↔model mismatch that compiles and works, to be reconciled when the grid routes are built.
2. **Audit-action enum values** `operations_content_{scene,take}_{created,updated,deleted}`
   (`:2134-2139`) — unchanged. Renaming an enum *value* would orphan historical `audit_log`
   rows that already store those strings; safer to leave and reconcile app-wide later.
   (They are labels, not model refs — tsc is unaffected.)
3. **Local TS interface names** `Scene`/`Take`/`Routine`/`Step` in `ContentTable.tsx` —
   unchanged (UI-layer cosmetic; not prisma refs).

---

## 5. Verify (cited)

- **schema renamed + all model refs updated:** `grep operations_content_takes / \bcontent_take\b`
  across `prisma/ src/` → **0 stale refs**. Schema shows `model operations_content_scene_groups`
  (`:2873`) + `model operations_content_scenes` (`:2896`) with matching `@@map`s.
- **tsc:** `npx prisma generate` (schema valid) → `npx tsc --noEmit` → **exit 0**.
- **lint:** the rename touches **0 new** lint findings. ESLint reports 3 errors at
  `RoutineList.tsx:327` (`react/no-unescaped-entities` in JSX prose) — **pre-existing on
  `origin/main`** (verified by checking out main's copy and re-linting: same 3 errors) and
  **unrelated** to the rename (my diff in that file only touches the `content_scene_group`/
  `content_scene` optimistic-update lines, not line 327). Left as-is to honor "rename only."
- **No data dropped:** RENAME-only; container preserved (Alex's choice). No `DROP`.
- **No new tables/fields/views:** field lists/indexes/constraints unchanged; only names.
- **/operations content surfaces compile** against the new names (the 13 files above; tsc 0).

---

## 6. ORDERING reminder (learned rule)

1. **Alex runs the psql `ALTER…RENAME` in Azure FIRST** (the SQL in §3).
2. Then **`npx prisma generate`** (regenerate the client against the renamed schema).
3. **Then merge** this PR (the code referencing the new names).

The renamed table must exist in Azure **before** the code that references it deploys.
prisma + raw SQL move in parallel; Alex runs psql; RENAME before merge.

---

**git diff = `prisma/schema.prisma` + the 13 updated code files (+ this report).**
**Migration is run by Alex (psql) — not applied from the repo.** Rename only; no data touched.
