# OPS-GRID-PR-4 — `operations_content_takes` (the cell: per scene × piece script)

**Branch:** `claude/ops-grid-pr-4` (off `main`; PR-1/2/3 all merged — scenes `:2897`, pieces `:2926`)
**Date:** 2026-06-03
**One concept:** the **CELL** = `operations_content_takes` = one row per **(scene × piece)**
holding the **per-day script**. This is the heart of Alex's grid: the scene-row holds *stable*
shot metadata, but the *script that differs day-to-day* lives here, joining a scene to a piece/day.
Per `audit-reports/ops-content-table-audit.md` (the missing cell table) + ops-grid-pr-1/2/3.
**New table only** — no grid view (PR-5), no route/component.

---

## 1. Audit (cited)

### The name `operations_content_takes` is FREE
PR-1 renamed the *old* `operations_content_takes` → `operations_content_scenes`. Confirmed on
this base: `grep operations_content_takes prisma/schema.prisma` → **zero references**
(no `model`, no `@@map`). The name is reclaimed here for its true meaning — a **take = a cell**.
(The audit-action enum uses the singular `operations_content_take_*` labels, a distinct string,
untouched.)

### FK targets (relations point at the right PKs)
- `operations_content_scenes` (`schema.prisma:2897`), PK `id String @id @default(uuid()) @db.Uuid`
  (`:2898`) — the scene-row a cell belongs to.
- `operations_content_pieces` (`:2926`), PK `id String @id @default(uuid()) @db.Uuid` (`:2927`) —
  the piece/day a cell belongs to.

### Conventions + explicit-join idiom mirrored
`operations_project_dependencies` (`:2777`) is the codebase's two-FK explicit-join table:
two FKs with **named relations**, both `onDelete: Cascade`, a `@@unique([...])` invariant,
per-FK `@@index`, and `@@map`. PR-4 mirrors that shape exactly. Scalar/scaffolding conventions
(`id @default(uuid()) @db.Uuid`, TEXT `user_id`/`entity_id`, `Timestamptz(6)`, `created_by`,
per-FK `@@index`, `@@map`) follow `operations_content_scenes`/`_pieces`. DB-level style
(`UUID … DEFAULT gen_random_uuid()`, `TEXT NOT NULL`, `TIMESTAMPTZ … DEFAULT NOW()`,
`"<table>_<col>_fkey"`, `"<table>_<col>_idx"`) follows the PR-1 scenes migration.

---

## 2. The change

### schema.prisma diff (1 new model + 2 inverse relations)
```diff
 model operations_content_scenes {
   routine_step operations_routine_steps  @relation(fields: [routine_step_id], references: [id], onDelete: Cascade)
+  takes        operations_content_takes[] @relation("SceneTakes")
 }

 model operations_content_pieces {
   source_ai_usage operations_ai_usage?       @relation("PieceSourceAiUsage", …)
+  takes           operations_content_takes[] @relation("PieceTakes")
 }

+model operations_content_takes {
+  id         String   @id @default(uuid()) @db.Uuid
+  user_id    String
+  entity_id  String
+  scene_id   String   @db.Uuid
+  piece_id   String   @db.Uuid
+  script     String?  @db.Text
+  created_at DateTime @default(now()) @db.Timestamptz(6)
+  updated_at DateTime @updatedAt @db.Timestamptz(6)
+  created_by String?
+  scene operations_content_scenes @relation("SceneTakes", fields: [scene_id], references: [id], onDelete: Cascade)
+  piece operations_content_pieces @relation("PieceTakes", fields: [piece_id], references: [id], onDelete: Cascade)
+  @@unique([scene_id, piece_id])
+  @@index([user_id])
+  @@index([entity_id])
+  @@index([scene_id])
+  @@index([piece_id])
+  @@map("operations_content_takes")
+}
```

### The `@@unique([scene_id, piece_id])` rationale — the grid-cell invariant
A grid cell *is* the intersection of one scene-row and one piece-column: a scene has **exactly
one** script per day. The unique constraint **is** that definition, so it is correct to impose
here (unlike PR-3's deferred piece-date uniqueness, which depended on a business rule Alex hadn't
set). It also doubles as the upsert key for the editor ("set the script for scene X on day Y").

### The psql — Alex runs this in Azure **BEFORE** merge (transaction-wrapped)
```sql
BEGIN;

CREATE TABLE "operations_content_takes" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    TEXT NOT NULL,
  "entity_id"  TEXT NOT NULL,
  "scene_id"   UUID NOT NULL,
  "piece_id"   UUID NOT NULL,
  "script"     TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by" TEXT,
  CONSTRAINT "operations_content_takes_scene_id_fkey"
    FOREIGN KEY ("scene_id") REFERENCES "operations_content_scenes"("id") ON DELETE CASCADE,
  CONSTRAINT "operations_content_takes_piece_id_fkey"
    FOREIGN KEY ("piece_id") REFERENCES "operations_content_pieces"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "operations_content_takes_scene_id_piece_id_key"
  ON "operations_content_takes"("scene_id", "piece_id");

CREATE INDEX "operations_content_takes_user_id_idx"   ON "operations_content_takes"("user_id");
CREATE INDEX "operations_content_takes_entity_id_idx" ON "operations_content_takes"("entity_id");
CREATE INDEX "operations_content_takes_scene_id_idx"  ON "operations_content_takes"("scene_id");
CREATE INDEX "operations_content_takes_piece_id_idx"  ON "operations_content_takes"("piece_id");

COMMIT;
```
Types match the schema exactly (`@db.Uuid`→`UUID`, `@db.Text`→`TEXT`, `@db.Timestamptz(6)`→
`TIMESTAMPTZ`). Both FKs `ON DELETE CASCADE` — a cell cannot outlive its scene or its piece.
`id` carries DB-level `DEFAULT gen_random_uuid()` so raw inserts work alongside Prisma's
`@default(uuid())`.

---

## 3. Verify (cited)
- **New cell table with both FKs + the scene×piece UNIQUE:** `operations_content_takes` at
  `schema.prisma:2958`; FKs `scene` (`:2969`, Cascade) and `piece` (`:2970`, Cascade);
  `@@unique([scene_id, piece_id])` (`:2972`).
- **Inverse relations:** `takes` on `operations_content_scenes` (`:2913`, `@relation("SceneTakes")`)
  and on `operations_content_pieces` (`:2941`, `@relation("PieceTakes")`).
- **prisma validate:** `The schema at prisma/schema.prisma is valid 🚀`. **prisma generate:** OK.
  **tsc:** `npx tsc --noEmit` → **exit 0**.
- **lint:** no `.ts/.tsx` changed (`git status` = `M prisma/schema.prisma` only) → ESLint scope empty → clean.
- **Scope:** one new table + two inverse relation fields; **no existing field altered**, **no grid
  view, no route, no component.**
- **Delete-safety:** both FKs `onDelete: Cascade` — cells are deleted with their scene or piece
  (a cell has no meaning without both parents).

---

## 4. ORDERING reminder (hard rule)
1. **Alex runs the psql `CREATE TABLE` in Azure FIRST** (the transaction in §2).
2. Then **`npx prisma generate`** (regenerate client against the new table).
3. **THEN merge** this PR (code referencing the table deploys only after it exists).

prisma + raw SQL move in parallel; Alex runs psql; the table exists in Azure before merge.

---

**git diff = `prisma/schema.prisma` (1 new model + 2 inverse relations) + this report.**
**Migration is run by Alex (psql) — not applied from the repo.** New table only; no existing data touched.

---

### The grid is now complete (schema)
scene-rows (`operations_content_scenes`, PR-1/2) × piece-columns (`operations_content_pieces`,
PR-3) = take-cells (`operations_content_takes`, PR-4). Next: **PR-5** — the grid view/route/UI that
reads these three tables. No application code exists for the cell yet; that's deliberately PR-5.
