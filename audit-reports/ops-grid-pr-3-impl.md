# OPS-GRID-PR-3 — `operations_content_pieces` (the per-day "column")

**Branch:** `claude/ops-grid-pr-3` (off `main`; PR-1 #720 and PR-2 both merged — `shot_type` present at `schema.prisma:2904`)
**Date:** 2026-06-03
**One concept:** the **PIECE** = one day = one reel = a *column* in Alex's content grid.
Carries `piece_date`, an optional **project** link, and the **`source_ai_usage_id`** version
anchor so a piece documents a project at a *specific re-run*.
Per `audit-reports/ops-content-table-audit.md` + `ops-content-evolution-audit.md`.
**New table only** — no take-cell table (PR-4), no grid view (PR-5), no route/component.

---

## 1. Audit — conventions mirrored + FK targets (cited)

### Sibling mirrored for scaffolding
`operations_content_scenes` (`schema.prisma:2896`) and `operations_project_tasks` (`:2672`):
loose-scalar `user_id`/`entity_id` (TEXT, **no FK** — operations_* stays loosely coupled to
tenancy, per the scenes migration header), `id String @id @default(uuid()) @db.Uuid`,
`created_at`/`updated_at` `@db.Timestamptz(6)`, `created_by String?`, plain `@@index` per FK/scalar,
`@@map`. DB-level style from `prisma/migrations/20260518500000_operations_content_scenes/migration.sql`:
`UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `TEXT NOT NULL`, `TIMESTAMPTZ … DEFAULT NOW()`,
FK constraint `"<table>_<col>_fkey"`, index `"<table>_<col>_idx"`.

### The version-anchor pattern mirrored
`operations_project_tasks.source_ai_usage_id` (`:2696`) +
`source_ai_usage operations_ai_usage? @relation("TaskSourceAiUsage", fields: [source_ai_usage_id], references: [id], onDelete: SetNull)` (`:2700`)
+ `@@index([source_ai_usage_id])`. PR-3 applies the identical shape under a new relation name
`"PieceSourceAiUsage"`.

### FK targets (relations point at the right PKs)
- `operations_projects` (`:2632`), PK `id String @id @default(uuid()) @db.Uuid` (`:2633`) — project link.
- `operations_ai_usage` (`:2920`), PK `id String @id @default(uuid()) @db.Uuid` (`:2921`) — the immutable version anchor.

### Nullable-project-FK + SetNull precedent
`operations_issue_log_entries.linked_project operations_projects? @relation(..., onDelete: SetNull)` —
the existing pattern for "may reference a project; deleting the project unpins, never deletes."

### `piece_date` type
The codebase stores pure calendar days as `DateTime @db.Date` (e.g.
`operations_daily_plan_items.plan_date DateTime @db.Date`, plus `:184,1109,1279,…`). A piece **is**
a day, so `piece_date DateTime @db.Date` (required — the day is the piece's identity).

### Confirmed absent
`grep operations_content_pieces prisma/schema.prisma` → **no match** before this change.

---

## 2. The change

### schema.prisma diff (1 new model + 2 inverse relations)
```diff
 model operations_projects {
   linked_issues         operations_issue_log_entries[]
+  content_pieces        operations_content_pieces[]       @relation("ProjectContentPieces")
 }

+model operations_content_pieces {
+  id                 String   @id @default(uuid()) @db.Uuid
+  user_id            String
+  entity_id          String
+  piece_date         DateTime @db.Date
+  title              String?  @db.VarChar(200)
+  project_id         String?  @db.Uuid
+  source_ai_usage_id String?  @db.Uuid
+  created_at         DateTime @default(now()) @db.Timestamptz(6)
+  updated_at         DateTime @updatedAt @db.Timestamptz(6)
+  created_by         String?
+  project         operations_projects? @relation("ProjectContentPieces", fields: [project_id], references: [id], onDelete: SetNull)
+  source_ai_usage operations_ai_usage? @relation("PieceSourceAiUsage", fields: [source_ai_usage_id], references: [id], onDelete: SetNull)
+  @@index([user_id])
+  @@index([entity_id])
+  @@index([piece_date])
+  @@index([project_id])
+  @@index([source_ai_usage_id])
+  @@map("operations_content_pieces")
+}

 model operations_ai_usage {
   generated_tasks  operations_project_tasks[]  @relation("TaskSourceAiUsage")
+  generated_pieces operations_content_pieces[] @relation("PieceSourceAiUsage")
 }
```

**Design notes**
- **Both FKs nullable + `onDelete: SetNull`** — a piece may or may not document a project, and may
  or may not be tied to a re-run; deleting either parent **unpins** the piece, never deletes it
  (hard constraint honored).
- **`title String? @db.VarChar(200)`** — the only optional field added: a trivial, nullable
  column header for the day ("Day 2", "Beach Day"). **`status` deliberately skipped** — it would
  require a new enum, exceeding "one concept / don't over-add."
- **No unique constraint** — "one piece = one day" *could* mean unique per `(entity_id, piece_date)`
  or per `(entity_id, project_id, piece_date)`, but `project_id` is nullable and the multiple-reels-
  per-day rule is Alex's to set. Imposing one now would invent a business rule, so this PR ships
  plain indexes only. **Flagged for Alex** — add a `@@unique` in a follow-up once the rule is decided.

### The psql — Alex runs this in Azure **BEFORE** merge (transaction-wrapped)
```sql
BEGIN;

CREATE TABLE "operations_content_pieces" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"            TEXT NOT NULL,
  "entity_id"          TEXT NOT NULL,
  "piece_date"         DATE NOT NULL,
  "title"              VARCHAR(200),
  "project_id"         UUID,
  "source_ai_usage_id" UUID,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by"         TEXT,
  CONSTRAINT "operations_content_pieces_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "operations_projects"("id") ON DELETE SET NULL,
  CONSTRAINT "operations_content_pieces_source_ai_usage_id_fkey"
    FOREIGN KEY ("source_ai_usage_id") REFERENCES "operations_ai_usage"("id") ON DELETE SET NULL
);

CREATE INDEX "operations_content_pieces_user_id_idx"            ON "operations_content_pieces"("user_id");
CREATE INDEX "operations_content_pieces_entity_id_idx"          ON "operations_content_pieces"("entity_id");
CREATE INDEX "operations_content_pieces_piece_date_idx"         ON "operations_content_pieces"("piece_date");
CREATE INDEX "operations_content_pieces_project_id_idx"         ON "operations_content_pieces"("project_id");
CREATE INDEX "operations_content_pieces_source_ai_usage_id_idx" ON "operations_content_pieces"("source_ai_usage_id");

COMMIT;
```
Types match the schema exactly: `@db.Uuid`→`UUID`, `@db.Date`→`DATE`, `@db.VarChar(200)`→`VARCHAR(200)`,
`@db.Timestamptz(6)`→`TIMESTAMPTZ`. `id` carries the DB-level `DEFAULT gen_random_uuid()` (mirroring
the scenes migration) so raw inserts work even though Prisma also fills `@default(uuid())`.

---

## 3. Verify (cited)
- **New model + both inverse relations present:** `operations_content_pieces` at `schema.prisma:2925`;
  inverse `content_pieces` on `operations_projects` (`:2662`) and `generated_pieces` on
  `operations_ai_usage` (`:2967`).
- **prisma validate:** `The schema at prisma/schema.prisma is valid 🚀` (run with a dummy
  `DATABASE_URL`; the bare run's P1012 was a missing-env-var error, not a schema error).
- **prisma generate:** client generated OK (also validates relations). **tsc:** `npx tsc --noEmit` → **exit 0**.
- **lint:** no `.ts/.tsx` changed (`git status` = `M prisma/schema.prisma` only) → ESLint scope empty → clean.
- **Scope:** exactly one new table + two inverse relation fields on existing models; **no existing
  field altered**, **no cell/take table, no grid view, no route, no component.**
- **Delete-safety:** both FKs nullable + `onDelete: SetNull` — a project/ai_usage deletion never
  cascade-deletes a piece.

---

## 4. ORDERING reminder (hard rule)
1. **Alex runs the psql `CREATE TABLE` in Azure FIRST** (the transaction in §2).
2. Then **`npx prisma generate`** (regenerate client against the new table).
3. **THEN merge** this PR (code referencing the table deploys only after it exists).

prisma + raw SQL move in parallel; Alex runs psql; the table exists in Azure before merge.

---

**git diff = `prisma/schema.prisma` (1 new model + 2 inverse relations) + this report.**
**Migration is run by Alex (psql) — not applied from the repo.** New table only; no existing data touched.
