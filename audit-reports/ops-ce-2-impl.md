# OPS-CE-2 — Question library + scene question-assignment (with text snapshot)

**Branch:** `claude/ops-ce-2` (off `main`)
**Date:** 2026-06-03
**One concept:** the **question library** as data + the **scene assignment** field.
A new `operations_content_questions` table (Alex's reusable, designed prompt set)
plus two columns on the scene-row (`operations_content_scenes`):
`assigned_question_id` (nullable FK, `SetNull`) and `assigned_question_text`
(the immutable **snapshot** of the wording at assignment time).
Per `audit-reports/ops-content-engine-audit.md` (CE-2; sign-off #3).
**No AI, no Stage-1 assignment logic (that's CE-3), no view, no route.** Schema only.

> ⚠️ **MIGRATION LEADS, MERGE FOLLOWS.** Alex runs the transaction-wrapped SQL in
> Azure **first**, verifies with `\d operations_content_questions` +
> `\d operations_content_scenes`, runs `npx prisma generate`, **then** merges. The
> committed schema references the new table/columns, so prod needs them present
> before deploy.

---

## STEP 1 — Audit (cited)

### Greenfield confirmed
`grep -rniE 'question|prompt_library' prisma/schema.prisma` → **no question/prompt
model.** The question concept exists nowhere — fully greenfield (matches the engine
audit §4: *"Confirmed: NO question/prompt table exists … fully greenfield."*).

### The scene-row to extend
`operations_content_scenes` (`prisma/schema.prisma:2897-2919`) — one row per routine
step (`routine_step_id @unique`), holding the shot fields (`camera_needed`,
`filming_angle`, `shot_type`, `b_roll`, `narrative_purpose`). **This is where the
assigned question attaches** — the question is a per-scene-row attribute (the row is
recurring; the per-day *answer* lives in the take cell, out of CE-2 scope).

### Conventions mirrored (sibling tables, cited)
- **ID / scalars / timestamps:** `operations_content_scenes:2898-2910` —
  `id String @id @default(uuid()) @db.Uuid`, TEXT `user_id`/`entity_id`,
  `DateTime @db.Timestamptz(6)`. `operations_content_pieces:2937` adds
  `created_by String?`. New table follows both.
- **`is_active` soft-delete idiom:** `operations_routines.is_active`
  (`:2815`, `Boolean @default(true)`) — the dominant repo idiom; reused so a
  library question is **never hard-deleted** (scenes snapshot from it).
- **Per-column `@@index` + `@@map`:** `operations_content_scenes:2915-2918`,
  `operations_content_pieces:2943-2948`.
- **FK `SetNull` for an optional pin:** `operations_content_pieces:2939-2940`
  (`project_id`/`source_ai_usage_id` both `onDelete: SetNull`) — the exact pattern
  for "deleting the referenced row never deletes this row." The assignment FK
  mirrors it.
- **Raw DDL idiom:** `prisma/migrations/20260518500001_operations_content_takes/
  migration.sql` — `BEGIN; CREATE TABLE … UUID PRIMARY KEY DEFAULT
  gen_random_uuid(); TEXT NOT NULL; TIMESTAMPTZ NOT NULL DEFAULT NOW(); named
  CONSTRAINT … _fkey; CREATE INDEX …; COMMIT;`. The SQL below matches it exactly.

### Index-collision guard (cited)
The `operations_content_scenes` table was historically renamed from
`operations_content_takes` (schema comment `:2956` *"Old operations_content_takes
was renamed to _scenes in PR-1"*), and the cell table reclaimed the
`operations_content_takes` name with its own `operations_content_takes_*_idx`
indexes (`migration 20260518500001:38-44`). Postgres index names are unique
**per-schema**, so to avoid any clash with stale/real `operations_content_takes_*`
names, the new index + FK **on the scenes table** use a **distinct short prefix**
(`content_scenes_*`), set explicitly via `map:` so prisma and SQL agree:
- `@@index([assigned_question_id], map: "content_scenes_assigned_question_id_idx")`
- `@relation(..., map: "content_scenes_assigned_question_id_fkey")`

The new table's own indexes (`operations_content_questions_*_idx`) are safe — the
table name never existed before (greenfield).

---

## STEP 2 — Schema (dual write)

### `prisma/schema.prisma` diff

**New library model** (inserted after `operations_content_takes`, before
`operations_ai_usage`):
```prisma
model operations_content_questions {
  id            String   @id @default(uuid()) @db.Uuid
  user_id       String
  entity_id     String
  question_text String   @db.Text
  label         String?  @db.VarChar(200)
  sort_order    Int      @default(0)
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @updatedAt @db.Timestamptz(6)
  created_by    String?

  assigned_scenes operations_content_scenes[] @relation("SceneAssignedQuestion")

  @@index([user_id])
  @@index([entity_id])
  @@index([is_active])
  @@map("operations_content_questions")
}
```

**On `operations_content_scenes`** — two columns + the named FK relation + a
distinct-named index:
```diff
   b_roll                    String?  @db.Text
   narrative_purpose         String?  @db.Text
+  assigned_question_id      String?  @db.Uuid
+  assigned_question_text    String?  @db.Text
   created_at                DateTime @default(now()) @db.Timestamptz(6)
   updated_at                DateTime @updatedAt @db.Timestamptz(6)

   routine_step      operations_routine_steps      @relation(fields: [routine_step_id], references: [id], onDelete: Cascade)
   takes             operations_content_takes[]    @relation("SceneTakes")
+  assigned_question operations_content_questions? @relation("SceneAssignedQuestion", fields: [assigned_question_id], references: [id], onDelete: SetNull, map: "content_scenes_assigned_question_id_fkey")

   @@index([user_id])
   @@index([entity_id])
   @@index([routine_step_id])
+  @@index([assigned_question_id], map: "content_scenes_assigned_question_id_idx")
   @@map("operations_content_scenes")
```

### Raw SQL — Alex runs in Azure FIRST (transaction-wrapped, distinct index names)
```sql
-- OPS-CE-2: question library + scene question-assignment (with text snapshot).
-- Non-financial tables (operations content). Additive: new table + 2 nullable
-- columns on operations_content_scenes (existing scene-rows unaffected).
BEGIN;

-- 1) Alex's reusable scene-question library.
CREATE TABLE "operations_content_questions" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       TEXT NOT NULL,
  "entity_id"     TEXT NOT NULL,
  "question_text" TEXT NOT NULL,
  "label"         VARCHAR(200),
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by"    TEXT
);

CREATE INDEX "operations_content_questions_user_id_idx"
  ON "operations_content_questions"("user_id");
CREATE INDEX "operations_content_questions_entity_id_idx"
  ON "operations_content_questions"("entity_id");
CREATE INDEX "operations_content_questions_is_active_idx"
  ON "operations_content_questions"("is_active");

-- 2) Assign a question to a scene-row + SNAPSHOT its wording.
ALTER TABLE "operations_content_scenes"
  ADD COLUMN "assigned_question_id"   UUID,
  ADD COLUMN "assigned_question_text" TEXT;

-- FK: SetNull — retiring/deleting a library question never deletes the scene.
-- Distinct constraint name (NOT operations_content_*) to dodge the stale
-- operations_content_takes_* names physically present on this renamed table.
ALTER TABLE "operations_content_scenes"
  ADD CONSTRAINT "content_scenes_assigned_question_id_fkey"
  FOREIGN KEY ("assigned_question_id")
  REFERENCES "operations_content_questions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Distinct short index name (same collision-avoidance reasoning).
CREATE INDEX "content_scenes_assigned_question_id_idx"
  ON "operations_content_scenes"("assigned_question_id");

COMMIT;
```
(`ON UPDATE CASCADE` matches Prisma's default for an explicit relation; `ON DELETE
SET NULL` matches `onDelete: SetNull`. No `DROP`, no data mutation — pure additive
DDL. No raw write touches financial data.)

> After commit: `\d operations_content_questions` (table + 3 indexes),
> `\d operations_content_scenes` (2 new columns + `content_scenes_assigned_question_id_*`
> FK & index), then `npx prisma generate`, then merge.

---

## The snapshot-text rationale (immutability of what a scene asked)

`assigned_question_id` is a **live pointer** to the library row; `assigned_question_text`
is a **frozen copy** of the wording captured when the question is assigned (CE-3).
Why both:
- Alex's questions are *the soul of the reels* — the exact wording a scene posed is
  **content history**, not a mutable lookup. If he later edits "biggest lesson?" →
  "biggest lesson AND why?", or **soft-deletes** a question, every past scene must
  still show the prompt **as it was asked** when its answer was logged.
- This is the **same immutability spirit** as the version anchor in the evolution
  loop: `operations_ai_usage` freezes the prompt/response of each re-run
  (`ops-content-evolution-audit.md` A3), and the piece pins to it. The snapshot does
  for a scene's question what the ai_usage row does for a re-run's reasoning.
- The FK is `SetNull` for the **same reason** the piece's `project_id`/`source_ai_usage_id`
  are `SetNull` (`schema.prisma:2939-2940`): deleting the referenced row must never
  delete the dependent row. After a question is hard-deleted (which the
  `is_active` soft-delete is designed to prevent in the first place), the scene
  keeps `assigned_question_text` and simply loses the live link — **the wording
  survives**.

---

## STEP 3 — Verify (cited)

- **New library table + 2 scene columns present in the generated client:**
  `npx prisma generate` (v5.22.0) → `Operations_content_questionsScalarFieldEnum`
  exists; `Operations_content_scenesScalarFieldEnum.assigned_question_id` /
  `.assigned_question_text` present; `…questions….is_active` present. ✅
- **FK is SetNull + snapshot is plain text:** `@relation(..., onDelete: SetNull)`
  on `assigned_question`; `assigned_question_text String? @db.Text` (no FK). ✅
- **Soft-delete on questions (never hard-delete):** `is_active Boolean @default(true)`
  + `@@index([is_active])`. ✅
- **Index names don't collide:** scene-side uses distinct `content_scenes_assigned_question_id_{idx,fkey}`
  (no `operations_content_*` prefix); new-table indexes are `operations_content_questions_*`
  (greenfield name). No overlap with `operations_content_takes_*`
  (`migration 20260518500001`). ✅
- **`prisma validate`:** with `DATABASE_URL` set → **"The schema … is valid 🚀"**
  (the bare `validate` failure was only *"Environment variable not found:
  DATABASE_URL"*, environmental). ✅
- **`tsc --noEmit`:** **exit 0, 0 errors** (deps provisioned via `npm install`; the
  sandbox ships without `node_modules`). ✅
- **lint:** no `.ts`/`.tsx` changed (schema-only PR) → nothing to lint; source
  surface unchanged. ✅
- **No AI / no assignment logic / no view:** diff is `prisma/schema.prisma` only —
  no route, no component, no AI call. CE-3 (AI assigns) and the library UI are
  future PRs. ✅
- **Diff scoped:** `git diff --stat` = `prisma/schema.prisma` (+ this report). ✅

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| ONE new table + 2 scene columns (FK SetNull + text snapshot) | ✅ `operations_content_questions` + `assigned_question_id`/`assigned_question_text` |
| No AI, no Stage-1, no view | ✅ schema-only |
| `is_active` soft-delete on questions | ✅ `Boolean @default(true)` + index |
| Distinct index names (no `operations_content_takes_*` collision) | ✅ `content_scenes_assigned_question_id_{idx,fkey}` via `map:` |
| prisma + raw SQL parallel, transaction-wrapped; Alex runs psql FIRST, verify, THEN merge | ✅ both provided; `BEGIN…COMMIT`; reminder included |
| tsc + lint clean | ✅ tsc exit 0; no TS surface to lint |

---

## ⚠️ Migration-before-merge

1. Alex runs the **transaction-wrapped SQL** (STEP 2) in **Azure**.
2. Verify:
   - `\d operations_content_questions` → table + `operations_content_questions_{user_id,entity_id,is_active}_idx`.
   - `\d operations_content_scenes` → `assigned_question_id uuid`, `assigned_question_text text`, FK `content_scenes_assigned_question_id_fkey`, index `content_scenes_assigned_question_id_idx`.
3. `npx prisma generate`.
4. **Then** merge `claude/ops-ce-2`.

---

## Result
A new `operations_content_questions` table holds Alex's reusable, designed
scene-questions as **data** (soft-deletable, ordered, labeled, entity-scoped); the
scene-row gains a nullable `assigned_question_id` (FK, `SetNull`) plus an immutable
`assigned_question_text` **snapshot** so a scene forever shows the prompt it actually
asked, even after the library question is edited or retired. Conventions mirror the
`operations_content_*` family; index/FK names on the renamed scenes table are
deliberately distinct to dodge the stale `operations_content_takes_*` collision.
Schema valid, client regenerated, tsc clean; diff scoped to `schema.prisma`. **No AI,
no assignment logic — that's CE-3. Migration leads, merge follows.**
