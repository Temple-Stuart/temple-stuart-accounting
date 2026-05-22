PR-OPS-5.18 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `5295338` (merge #567 PR-Ops-5.17 north-star-to-ai) → `d482410` (merge #566 PR-Ops-5.17 audit) → `2f6cb23` (5.17 commit).
- current branch: `claude/pr-ops-5.18-project-delete-audit`

A. DELETE PATH

- **DELETE endpoint:** `src/app/api/operations/projects/[id]/route.ts:261-307`.
  - Auth (`:266-272`): `getVerifiedEmail` → `prisma.users.findFirst` → `loadAuthorizedProject(id, user.id)` (`:275`) defensive 404 on cross-user.
  - **HARD delete** via `prisma.operations_projects.delete({ where: { id } })` (`:278`). No soft-delete column.
  - Header comment (`:10`) claims: *"CASCADE removes tasks and dependencies."* — it relies on the DB FK cascade, not on explicit child deletion in code. The endpoint does ONE delete call and trusts the database to cascade.
  - Audit: `operations_project_deleted` with full `payload.before` (`:280-297`).
  - Error path (`:300-305`): catches, returns 500 with `{ error, message: error.message }`. **The raw error message is forwarded to the client** — not swallowed server-side.

- **UI delete affordance:** `src/components/workbench/operations/projects/ProjectRow.tsx:254-271` (`handleDelete`).
  - Confirm (`:255`): `confirm("Delete project \"X\"? This will also delete its tasks and dependencies.")` — **promises a cascade**.
  - `:259` DELETE fetch → `:261-263` on non-OK, `setError(body.message ?? body.error ?? 'failed to delete')` → rendered in a red error block at `:426-428`.
  - **The error is NOT silently swallowed by the UI** — it IS displayed. BUT the message shown is the raw Postgres error string (forwarded verbatim from the 500), which reads as a cryptic constraint-violation that Alex would not recognize as actionable. So the symptom "it just won't delete" = the delete returns a 500, the UI shows an opaque Postgres message, and the project stays.

- **hard/soft:** HARD delete. Confirmed (`:278`).

B. WHY THIS PROJECT

**Child rows referencing `operations_projects` (schema + migration verified):**

| child | FK | DB onDelete | source |
|---|---|---|---|
| `operations_project_tasks.project_id` | → projects.id | **CASCADE** | foundation migration `20260507000000_..._schema_foundation/migration.sql:135` |
| `operations_project_dependencies.project_id` | → projects.id | CASCADE | foundation `:175` |
| `operations_project_dependencies.depends_on_project_id` | → projects.id | CASCADE | foundation `:177` |
| `operations_issue_log_entries.linked_project_id` | → projects.id | SET NULL | foundation `:314` |

→ **Direct children of the project all cascade or set-null cleanly. The project→tasks FK IS `ON DELETE CASCADE` at the DB level** (not Restrict). So the prime suspect from the brief — "tasks→project is Restrict, blocking parent delete" — is **REFUTED**. Tasks do not directly block the parent.

**The blocker is a GRANDCHILD collision. FKs referencing `operations_project_tasks` (the tasks that cascade-delete):**

| grandchild | FK | DB onDelete | source |
|---|---|---|---|
| `operations_task_status_history.task_id` | → tasks.id | CASCADE | PR-4.0 migration `20260516000000_..._daily_plan_schema/migration.sql:68` |
| `operations_daily_plan_items.task_id` | → tasks.id | **SET NULL** | PR-4.0 `:28` |

**`operations_daily_plan_items` carries a CHECK constraint** (PR-4.0 `:25-26`):
```sql
CONSTRAINT "operations_daily_plan_items_task_or_adhoc_check"
  CHECK ("task_id" IS NOT NULL OR "ad_hoc_title" IS NOT NULL)
```

**CONFIRMED ROOT CAUSE — the SET-NULL-into-a-CHECK collision:**

A daily-plan item created from a TASK (a "task-linked" item) has `task_id` set and `ad_hoc_title` NULL. The task→daily_plan_items FK is `ON DELETE SET NULL` (PR-4.0 `:28`). When that task is deleted — **directly OR via the project-delete CASCADE chain** — Postgres attempts `UPDATE operations_daily_plan_items SET task_id = NULL` on the linked row. That update leaves `task_id NULL AND ad_hoc_title NULL`, which **violates the CHECK** (`task_id IS NOT NULL OR ad_hoc_title IS NOT NULL`). Postgres aborts the entire delete transaction → the project is NOT deleted → the 500 surfaces a CHECK-violation message.

**Why "Complete the Operations Tab" specifically:**
1. It has tasks (the pilot generation created `operations_project_tasks` rows).
2. At least one of those tasks was added to the Daily Plan as a task-linked item (`task_id` set, `ad_hoc_title` null).
3. `DELETE project` → DB cascades to its tasks → for each task on the daily plan, `SET NULL` fires on the daily-plan item → CHECK violation → transaction rollback → delete fails.
4. The OTHER projects Alex deleted had **no tasks**, or had tasks that were **never scheduled into the daily plan** → no task-linked daily-plan item to collide → the cascade completed → they deleted fine.

This matches the symptom exactly: the one project whose tasks reached the Daily Plan is the one that won't delete.

**Schema/Prisma blindness — why this was never caught:** the Prisma schema (`schema.prisma:2649`) models the relation as `onDelete: SetNull`, agreeing with the DB FK. But the CHECK constraint is **migration-only** (raw SQL at PR-4.0 `:25-26`); Prisma does not model CHECK constraints. So at the Prisma layer the SET NULL looks safe — the collision is invisible until the DB enforces the CHECK at runtime.

**Latent broader bug:** the SAME collision breaks **single-task deletion**. `DELETE /api/operations/projects/[id]/tasks/[taskId]/route.ts:427` does a plain `prisma.operations_project_tasks.delete()`. If that task is on the Daily Plan, the identical SET-NULL→CHECK collision aborts it. So any task that's been scheduled cannot be deleted today either — the project-delete path is one of two ways to hit it.

**Silent failure or error:** NOT silent at the HTTP layer — the endpoint returns 500 with the Postgres message and the UI renders it (`ProjectRow:426-428`). But the message is an opaque constraint-violation string, so to Alex it reads as "it just won't delete." Effectively-opaque, not literally-silent.

C. FIX OPTIONS

- **Option A — change the task→daily_plan_items FK from SET NULL to CASCADE (schema migration).**
  - When a task is deleted, its task-linked daily-plan items are deleted too (and their `operations_calendar_blocks` cascade away via the existing `daily_plan_items → calendar_blocks ON DELETE CASCADE`, PR-4.0 `:50`).
  - Makes the schema internally consistent — eliminates the SET-NULL-into-CHECK contradiction permanently.
  - Fixes BOTH the project-delete cascade path AND the latent single-task-delete bug in one change.
  - Blast radius: deleting a task removes its daily-plan entry. Defensible — a task-linked daily-plan item has no meaning once its task is gone; the daily plan is "today's intent", not a historical ledger (audit_log already records the deletion).
  - Schema + migration: alter the FK; `onDelete: SetNull → Cascade` in `schema.prisma:2649`; `npx prisma generate`.

- **Option B — endpoint-level: convert task-linked daily-plan items to ad-hoc before deleting (no schema change).**
  - Before deleting the project's tasks, for each task-linked daily-plan item, copy `task.title → ad_hoc_title` and set `task_id = NULL`. Now the CHECK passes (ad_hoc_title is non-null), the SET NULL is moot (already null), the daily-plan record is PRESERVED as an ad-hoc entry.
  - Honors the original SET-NULL intent ("keep the plan record even if the task is gone").
  - More code; must run inside a transaction in BOTH the project-delete and task-delete endpoints; the project-delete currently relies on pure DB cascade, so this means replacing the single `delete` with an explicit transaction that walks tasks → daily-plan items first.

- **Option B' — endpoint-level: explicitly delete the project's tasks' daily-plan items first, then delete the project (no schema change).**
  - Simpler than B; loses the daily-plan record (same outcome as Option A but in code rather than FK).

- **Recommended: OPTION A (FK → CASCADE).**
  - It removes the contradiction at the schema layer (where the bug actually lives), is one migration, and fixes the single-task-delete bug for free.
  - The "preserve the daily-plan record as ad-hoc" behavior (Option B) is a nice-to-have, but a task-linked plan entry losing its task is an edge case that doesn't warrant carrying transaction logic in two endpoints; the audit log already preserves the evidentiary record of what existed.
  - Pairs with the existing project-delete confirm copy ("This will also delete its tasks and dependencies") — extend it to mention daily-plan entries if desired.

**No-silent-failure requirement:** with Option A the delete simply SUCCEEDS (no collision), so the user gets the clean delete they expect. As defense-in-depth, also recommend the DELETE endpoint translate any residual DB constraint error (P2003/P2010/23514) into a human-readable message instead of forwarding the raw Postgres string — so any FUTURE constraint blocker surfaces a clear "why" rather than an opaque code.

D. RECOMMENDATION

- **Root cause:** `operations_daily_plan_items.task_id → operations_project_tasks(id) ON DELETE SET NULL` (PR-4.0 migration `:28`, schema `:2649`) collides with the table's CHECK `task_id IS NOT NULL OR ad_hoc_title IS NOT NULL` (PR-4.0 `:25-26`). Deleting a task that's been scheduled into the Daily Plan — directly or via the `project → tasks` CASCADE (foundation `:135`) — triggers a SET NULL that violates the CHECK and aborts the whole delete. "Complete the Operations Tab" had pilot-generated tasks that were added to the Daily Plan; the empty/unscheduled projects Alex deleted had no such collision.

- **Fix:** **Option A** — change the FK `operations_daily_plan_items.task_id → operations_project_tasks(id)` from `ON DELETE SET NULL` to `ON DELETE CASCADE`. This makes the schema self-consistent and fixes both the project-delete and single-task-delete paths. Additionally, translate residual constraint errors in the project-delete + task-delete endpoints into clear messages (defense-in-depth, no-silent-failure).

- **Schema / endpoint / both:** **SCHEMA (primary)** — the FK change is a migration + a one-line `schema.prisma` edit (`:2649` SetNull → Cascade) + `npx prisma generate`. **ENDPOINT (secondary, optional)** — add constraint-error translation for clear messaging. No change to the cascade behavior itself is needed in code; the DB does the work once the FK is corrected.

- **No raw SQL data deletion:** CONFIRMED. The fix is a schema FK migration (Alex runs the `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE CASCADE` via psql, mirroring the established migration discipline) + a Prisma schema edit + generate. **No `DELETE FROM` is run against the stuck project.** Once the FK is fixed, Alex deletes the project through the existing UN-bypassed feature. The feature is repaired; the data is removed by the user through the product, not by us via SQL.

- **Existing stuck project:** after the migration ships and Alex runs the ALTER, clicking "delete" on "Complete the Operations Tab" will cascade cleanly (project → tasks → task-linked daily-plan items → calendar blocks) and succeed. No manual data surgery.

- **Scope + files (estimated for Phase 2):**
  1. `prisma/migrations/<timestamp>_pr_ops_5_18_daily_plan_task_cascade/migration.sql` (NEW) — `ALTER TABLE operations_daily_plan_items DROP CONSTRAINT operations_daily_plan_items_task_id_fkey; ALTER TABLE operations_daily_plan_items ADD CONSTRAINT operations_daily_plan_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES operations_project_tasks(id) ON DELETE CASCADE;` — ~10 lines incl. header. Alex runs via psql.
  2. `prisma/schema.prisma` (modify) — line 2649 `onDelete: SetNull` → `onDelete: Cascade`. 1 line. Then `npx prisma generate`.
  3. (optional) `src/app/api/operations/projects/[id]/route.ts` + `.../tasks/[taskId]/route.ts` (modify) — translate Prisma P2003/raw 23514 constraint errors into clear `{ error, message }` responses. ~10 lines each.
  - **Total: 1 new migration + 1 schema line + optional ~20 lines of error-translation. No data deletion, no new table.**

- **Open decisions for Alex:**
  1. **Option A (FK → CASCADE, recommended) vs Option B (preserve daily-plan items as ad-hoc)?** Recommend A — simpler, self-consistent, fixes single-task delete too. Choose B only if you want a task's daily-plan entry to survive the task's deletion as an ad-hoc record.
  2. **Update the project-delete confirm copy** to also mention daily-plan entries ("...delete its tasks, dependencies, and daily-plan entries")? Recommend yes — accurate disclosure.
  3. **Add the constraint-error-translation defense-in-depth** (so any future constraint blocker surfaces a clear message rather than a raw PG string)? Recommend yes — cheap, aligns with the no-silent-failure value.
  4. **Audit the broader schema for other SET-NULL-into-CHECK collisions?** Out of scope here, but the same anti-pattern (a nullable FK with SET NULL plus a CHECK requiring that column or a sibling) could exist elsewhere. Flag for a future schema-hygiene pass; not blocking this fix.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.18-phase-1.md.
