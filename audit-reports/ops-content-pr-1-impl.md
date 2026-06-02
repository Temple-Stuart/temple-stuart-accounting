# OPS-CONTENT-PR-1 — `source_ai_usage_id` on project tasks (link tasks → the AI re-run that created them)

**Branch:** `claude/ops-content-pr-1`
**Date:** 2026-06-02
**Scope:** ONE concept — add a `source_ai_usage_id` column to
`operations_project_tasks`, a named relation to `operations_ai_usage`, persist it
on bulk-create, and provide a **best-effort** backfill. This makes the append
*batch* first-class (queryable) instead of audit-log-only — the foundation for the
evolution-timeline view and content version-linking in later PRs. **No evolution
view, no content_pieces, no toggle here.**
**Schema PR — dual write:** `prisma/schema.prisma` + raw SQL move in parallel;
**Alex runs the migration via `psql` + `npx prisma generate`.**

> Per `audit-reports/ops-content-evolution-audit.md` (A2/A3): the loop is
> append-only (`bulk-create` appends at `display_order = max+1+suggested_order`),
> every generation writes an immutable `operations_ai_usage` row (the version
> anchor), but **no column linked a task to that row** — the batch link lived only
> in audit-log metadata. This PR closes that gap.

---

## STEP 1 — Audit (confirmed before changing)

- **`operations_project_tasks`** (`prisma/schema.prisma:2671-2708`, pre-change):
  id/project_id/user_id/entity_id/title/description/status/estimates/deadline/
  priority_*/unblocks_label/link_url/notes/coa_code/actual_*/`display_order`/
  `completed_at`/created_at/updated_at/created_by. Relations: `project`,
  `daily_plan_items`, `status_history`. **Confirmed: NO `source_ai_usage_id`
  column existed.**
- **`operations_ai_usage`** (`:2913-2937`, the FK target): id/user_id/model/
  `purpose`/`target_table`/`target_id`/tokens/cost/full prompts+response/
  `created_at`; relation `user`; indexed `[target_table, target_id]`. This is the
  immutable per-re-run row.
- **`bulk-create/route.ts`** receives + ownership-verifies the id:
  - `:159` `const sourceAiUsageId = body.source_ai_usage_id.trim();`
  - `:163-171` `prisma.operations_ai_usage.findFirst({ where: { id: sourceAiUsageId, user_id: user.id } })` → 400 if not owned. **Ownership is verified before any write.**
  - `:198-214` the `$transaction` `create()` had the value **in scope** but did
    **not** persist it on the task; the link was written only into the audit-log
    metadata at `:230` (`payload_metadata.source_ai_usage_id`).
- **Backfill signal — EXISTS.** Each created task gets an `audit_log` row
  (`writeAuditLog`, `:218-235`) with `action_type='operations_project_task_created'`,
  `target_table='operations_project_tasks'`, `target_id=<task id>`, and
  `payload_metadata->>'source_ai_usage_id'`. `audit_log` (`:2156-2197`) has
  `target_id VarChar(255)`, `payload_metadata Json?`, indexed
  `[target_table, target_id]`. So existing batches are recoverable by joining
  `audit_log → operations_project_tasks` on the task id.

## STEP 2 — Schema (dual write)

### `prisma/schema.prisma` diff

**On `operations_project_tasks`** — new nullable column + named relation + index
(mirrors the sibling `project … @relation(fields: [project_id], references: [id], …)`
convention on the same model, `:2698`):

```diff
   display_order        Int                  @default(0)
   completed_at         DateTime?            @db.Timestamptz(6)
+  source_ai_usage_id   String?              @db.Uuid
   created_at           DateTime             @default(now()) @db.Timestamptz(6)
   updated_at           DateTime             @updatedAt @db.Timestamptz(6)
   created_by           String?

   project          operations_projects              @relation(fields: [project_id], references: [id], onDelete: Cascade)
+  source_ai_usage  operations_ai_usage?             @relation("TaskSourceAiUsage", fields: [source_ai_usage_id], references: [id], onDelete: SetNull)
   daily_plan_items operations_daily_plan_items[]
   status_history   operations_task_status_history[]

   @@index([project_id, status, display_order])
   @@index([user_id, status, priority_score])
   @@index([deadline])
   @@index([entity_id])
   @@index([coa_code])
+  @@index([source_ai_usage_id])
   @@map("operations_project_tasks")
```

**On `operations_ai_usage`** — inverse relation field (mirrors the existing
`user users @relation(...)` style):

```diff
-  user users @relation(fields: [user_id], references: [id])
+  user            users                      @relation(fields: [user_id], references: [id])
+  generated_tasks operations_project_tasks[] @relation("TaskSourceAiUsage")
```

**Conventions mirrored:** nullable scalar `String? @db.Uuid` (matches
`operations_ai_usage.target_id`); named `@relation("TaskSourceAiUsage")` (so the
two sides pair unambiguously); `@@index([source_ai_usage_id])` (matches the
single-column index style already on `entity_id`/`coa_code`); `@@map` retained.
`onDelete: SetNull` — ai_usage rows are immutable provenance and shouldn't be
deleted, but if one ever is, the task survives and simply loses its batch link
(never cascade-deletes a real task). Column is **NULLABLE** — existing tasks have
no known batch; no default-then-NOT-NULL dance.

`npx prisma validate` → **valid 🚀**; `npx prisma generate` regenerated the client
(local, for tsc).

### Raw SQL migration (Alex runs via `psql`)

```sql
-- OPS-CONTENT-PR-1: link project tasks to the AI re-run (ai_usage row) that created them.
-- Non-financial table (operations_project_tasks). Column is NULLABLE.

ALTER TABLE operations_project_tasks
  ADD COLUMN source_ai_usage_id uuid;

ALTER TABLE operations_project_tasks
  ADD CONSTRAINT operations_project_tasks_source_ai_usage_id_fkey
  FOREIGN KEY (source_ai_usage_id)
  REFERENCES operations_ai_usage(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX operations_project_tasks_source_ai_usage_id_idx
  ON operations_project_tasks (source_ai_usage_id);
```

(`ON UPDATE CASCADE` matches Prisma's default for an explicit relation; `ON DELETE
SET NULL` matches `onDelete: SetNull`.)

> **After the migration, run `npx prisma generate`** so the TS client picks up the
> new field (dual-write rule). The committed code already references
> `source_ai_usage_id`, so prod needs the column present before deploy.

## STEP 3 — Persist on create

`bulk-create/route.ts` — the `$transaction` `create()` now sets the
already-ownership-verified id on each task (the **only** write-path change):

```diff
             notes: task.notes,
             display_order: baseOrder + task.suggested_order,
+            // Link each task to the AI re-run (ai_usage row) that produced it.
+            // sourceAiUsageId is already ownership-verified above (the aiUsage
+            // findFirst). Persisting it on the row makes the append batch
+            // first-class (queryable) instead of audit-log-only.
+            source_ai_usage_id: sourceAiUsageId,
             // status defaults to 'open' per Prisma schema default
```

`sourceAiUsageId` comes from `:159` and was ownership-verified at `:163-171`, so no
new validation is needed. The audit-log metadata write (`:230`) is unchanged — the
lineage is now in **both** places (row + audit), the row being the queryable one.

## STEP 4 — Backfill (best-effort; Alex runs via `psql`)

**Signal exists** (STEP 1): the `operations_project_task_created` audit row carries
`source_ai_usage_id` in `payload_metadata`. Backfill links existing tasks from that
row — and **only** when the referenced ai_usage row really exists and is owned by
the same user (fail-loud: never fabricate a link). Tasks with no such audit row (or
created outside bulk-create) **stay NULL**.

```sql
-- OPS-CONTENT-PR-1 backfill: recover the batch link for existing tasks from the
-- audit log. Best-effort + defensive — only sets the link when a creation audit
-- row carries source_ai_usage_id AND it references a real ai_usage row owned by
-- the same user. Tasks without that evidence remain NULL (no fabrication).
UPDATE operations_project_tasks t
SET source_ai_usage_id = (al.payload_metadata ->> 'source_ai_usage_id')::uuid
FROM audit_log al
WHERE al.target_table = 'operations_project_tasks'
  AND al.action_type  = 'operations_project_task_created'
  AND al.target_id    = t.id::text
  AND al.payload_metadata ? 'source_ai_usage_id'
  AND t.source_ai_usage_id IS NULL
  AND EXISTS (
    SELECT 1 FROM operations_ai_usage au
    WHERE au.id = (al.payload_metadata ->> 'source_ai_usage_id')::uuid
      AND au.user_id = t.user_id
  );
```

Creation is a single event per task, so the `audit_log → task` join is 1:1 in
practice. **Tasks predating the audit-metadata convention (or created via the
single-task path, not bulk-create) legitimately have no signal → they remain NULL.
Version-linking is exact for those, best-effort for history, and never fabricated.**

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| ONE concept: column + persist-on-create + best-effort backfill | ✅ no view / pieces / toggle |
| Column NULLABLE; never fabricate an old task's link (fail-loud) | ✅ `String?`; backfill gated on real, user-owned ai_usage row, else NULL |
| prisma + raw SQL in parallel; Alex runs psql + `prisma generate` | ✅ both provided + reminder |
| No raw SQL writes to financial data | ✅ `operations_project_tasks` is non-financial (operations) |
| FK is ai_usage, ownership verified upstream | ✅ `:163-171` verifies before the `:200` create |
| `npx prisma validate` | ✅ valid 🚀 |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (bulk-create route) | ✅ 0 problems |
| git diff scoped | ✅ `schema.prisma` + `bulk-create/route.ts` (+ this report). Migration is run by Alex via psql, not committed-as-applied. |

---

## Result
`operations_project_tasks` gains a **nullable `source_ai_usage_id`** with a named
`TaskSourceAiUsage` relation to `operations_ai_usage` (inverse `generated_tasks`)
and an index; `bulk-create` now **persists** the already-verified id on every task,
making each append batch a first-class, queryable unit. A defensive, best-effort
**backfill** recovers existing batches from the audit log and leaves
no-signal tasks NULL (never fabricated). prisma + raw SQL move in parallel — **Alex
runs the migration via `psql` then `npx prisma generate`.** tsc + lint clean; diff
scoped to the schema + the one route.
