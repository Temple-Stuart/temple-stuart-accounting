# Audit — Task Lifecycle: Un-assign from Day + Delete/Archive

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Branch:** `claude/audit-task-lifecycle`
**Context:** Two missing lifecycle operations found while dogfooding —
(A) no un-assign path for a day-assigned task that is not yet time-committed;
(B) tasks/projects "cannot be deleted/archived when out of scope" (hard-delete
exists, but **soft archive that preserves the audit trail does not**).

Every claim cites `file:line`. Migration SQL is **drafted, not run** (Alex runs psql).

---

## 1 · DAY ASSIGNMENT MODEL (gap A)

### What "✓ on day" writes — full path
1. **Button** — Content INPUTS "+ add to day" / "✓ on day":
   `ContentPipeline.tsx:338-349` (button), handler `addTaskToDay`
   `ContentPipeline.tsx:187-212`.
2. **Request** — `POST /api/operations/daily-plan/items` with
   `{ task_id, plan_date }` (`ContentPipeline.tsx:191-196`).
3. **Persistence** — `src/app/api/operations/daily-plan/items/route.ts:216-228`
   inserts one `operations_daily_plan_items` row (`user_id`, `entity_id` derived
   server-side from the task at `route.ts:177-178`, `plan_date`, `task_id`,
   `display_order = max+1`). Audits `operations_daily_plan_item_created`
   (`route.ts:230-233`).
4. **Table** — `operations_daily_plan_items` (`schema.prisma:2714-2736`):
   `task_id String?`, `plan_date Date`, `@@unique([task_id, plan_date])`
   (`schema.prisma:2731`). A 409 on re-add is treated as "already on day"
   (`ContentPipeline.tsx:197`).

### PLANNED vs SCHEDULED in the data model
There is **no status column** on `operations_daily_plan_items`. The distinction is
**presence of a child `operations_calendar_blocks` row**:
- **PLANNED** = a `daily_plan_items` row with **no** `calendar_blocks`.
- **SCHEDULED / COMMITTED** = a `daily_plan_items` row that **owns ≥1**
  `calendar_blocks` (with `scheduled_start`/`scheduled_end`)
  (`schema.prisma:2738-2758`).

This is exactly how the UI branches: `TaskBand.tsx:202`
`planned && !blockId ? <TaskTimeCommit/> : …` and how the unscheduled-task query
is written: `tasks/unscheduled/route.ts:36`
`daily_plan_items: { none: { calendar_blocks: { some: {} } } }`.

> **Consequence (important for the fix):** a PLANNED task (added to a day, no
> block) STILL satisfies the unscheduled filter — it stays in the Content INPUTS
> pool and is marked "✓ on day" only via the separate `loadDayItems` read
> (`ContentPipeline.tsx:93-106`, the `addedTaskIds` Set). So "un-assign" must
> delete the `daily_plan_items` row, which clears the "✓ on day" mark.

### What "uncommit" does exactly
- Button: `TaskBand.tsx:254-256` → mode `uncommit` confirm at `TaskBand.tsx:238-247`
  → `uncommit()` `TaskBand.tsx:144-159`.
- Mutation: `DELETE /api/operations/daily-plan/blocks/[blockId]`
  (`TaskBand.tsx:149-152`).
- Effect: deletes **the calendar block only**. The `daily_plan_items` row
  **stays** — the piece **does NOT leave the day**, it returns to **PLANNED**
  (loses its time). Documented at `TaskBand.tsx:8` and `:154` ("the row becomes
  planned again").

### Therefore — what "remove from day" needs
"Remove from day" for a PLANNED piece = **delete the `daily_plan_items` row**.

**A route already exists** — `DELETE /api/operations/daily-plan/items/[itemId]`
(`daily-plan/items/[itemId]/route.ts:172-219`). It hard-deletes the item; its
`calendar_blocks` cascade-delete via FK `onDelete: Cascade`
(`schema.prisma:2753`), captured into the audit payload first
(`route.ts:192-202`, audit `operations_daily_plan_item_deleted`). User-scoped
(`route.ts:177-180`).

**No new route or schema is required for (A) — it is purely UI wiring:**
- `TaskBand` already receives `itemId` (`TaskBand.tsx:52,65`); the PLANNED branch
  (`TaskBand.tsx:202-203`) renders only `<TaskTimeCommit>` with **no remove
  affordance** — add a "remove from day" button there → `DELETE /items/[itemId]`
  → dispatch `CONTENT_DAY_PLAN_CHANGED_EVENT` (the existing refresh signal,
  `TaskBand.tsx:96`).
- Content INPUTS shows "✓ on day" as a **disabled** button with no inverse
  (`ContentPipeline.tsx:338-349`). It needs the item id to delete; `loadDayItems`
  already fetches full items (each with `id`) but currently keeps only `task_id`
  in a Set (`ContentPipeline.tsx:100-102`). Change that to a
  `Map<task_id, item_id>` and add a "remove from day" → `DELETE /items/[itemId]`.
  No new endpoint.

`TaskTimeCommit.tsx` confirms the planned surface only POSTs blocks today
(`TaskTimeCommit.tsx:53-54`); it has no delete path.

---

## 2 · DELETE / ARCHIVE LANDSCAPE (gap B)

### Current schema — soft-delete fields available?
| Model | Soft-delete field today | Notes |
|---|---|---|
| `operations_projects` (`schema.prisma:2632-2670`) | **`status` enum has `archived`** (`ProjectStatus`, `schema.prisma:2215-2222` → `not_started/in_progress/blocked/completed/cancelled/archived`). No `deleted_at`/`is_active`. | Project archive is **already expressible — no migration**. |
| `operations_project_tasks` (`schema.prisma:2672-2712`) | `status` enum = `OperationsTaskStatus` (`schema.prisma:2593-2600`) = `open/in_progress/blocked/completed/cancelled/superseded`. **No `archived`**, no `deleted_at`/`is_active`. | Needs either a new `archived` enum value (migration) or reuse `cancelled`. |
| `operations_routines` (`schema.prisma:2796-2829`) | **`is_active Boolean`** (`schema.prisma:2815`) | Soft-deactivate pattern (see §3). |
| `operations_routine_steps` (`schema.prisma:2831-2860`) | **`is_active Boolean`** with explicit "ARCHIVES it" doc (`schema.prisma:2843-2847`) | Precedent for soft-archive preserving downstream rows. |

### Both projects and tasks already have HARD delete (UI + route)
- Project: `DELETE /api/operations/projects/[id]` (`projects/[id]/route.ts:263-323`,
  **hard delete**, CASCADE tasks+deps per `route.ts:10`); UI button
  `ProjectRow.tsx:288-302` ("Delete project … will also delete its tasks and
  dependencies").
- Task: `DELETE /api/operations/projects/[id]/tasks/[taskId]`
  (`tasks/[taskId]/route.ts:402-474`, **hard delete**); UI button
  `TaskRow.tsx:256-263`.
- Project status (incl. `archived`) is **already settable** from the edit form
  dropdown: `STATUS_OPTIONS` includes `'archived'` (`ProjectRow.tsx:48-55`),
  written via `PATCH /projects/[id]` (`projects/[id]/route.ts:173-185`, audits
  `operations_project_status_changed`).

> **So the real gap (B) is NOT "can't delete" — it's that the only non-destructive
> option (project `status='archived'`) does not actually hide the project**, and
> tasks have no archive concept at all. Hard delete is the wrong tool for
> "out of scope" because the cascade chain destroys the audit trail (see cascade
> map below).

### Consumer filter map — who must hide archived records
| Consumer | Query site | Filters archived today? | Change needed |
|---|---|---|---|
| Project backlog list | `projects/route.ts:29-30` `where = { user_id, entity_id? }` — **no status filter** (archived only sorts last via `STATUS_ORDER`, `route.ts:43-46`) | **No** | Add `status: { notIn: ['archived'] }` + optional `?show_archived` toggle |
| Project's task list (TaskList) | `projects/[id]/tasks/route.ts:57-58` `where: { project_id }` — **no status filter** | **No** | Filter archived tasks (or render muted) + "show archived" toggle |
| Content INPUTS task queue | `tasks/unscheduled/route.ts:33-38` `status: { in: ['open','in_progress','blocked'] }` (allowlist) | **Yes (allowlist)** | **None** — an archived/cancelled task drops out automatically |
| Daily Plan / day pieces | `daily-plan/items/route.ts:90-107` joins `task` (selects `status`) but **does not filter** by task status | **No** | Decide: hide future planned items whose task/project is archived (see cascade) |
| North Star optimize (5.16/5.17) | `ai/optimize-north-star-section/route.ts:178-201` reads only the **user-selected** project ids + their tasks; copies `p.status`/`t.status` into context (`:222,:237`) | N/A (user selects) | Selection UI is fed by the projects GET → fixing that GET hides archived transitively; optionally reject archived ids |
| AI re-run version history (evolution) | `projects/[id]/evolution/route.ts` groups **all** of a project's tasks by `source_ai_usage_id` (`:9-13`) | Shows all (intended — it's history) | **Keep showing** archived tasks here (audit/version trail) — argues for soft archive, not delete |
| Calendar / time_block reads | `operations_calendar_blocks` via `daily-plan/items` include (`:91`); conflict detect `detectBlockConflicts` (per `tasks/[id]/assign/route.ts:16-19`) excludes only `cancelled`/`missed` block status | n/a (block-level) | Past blocks must remain (audit); only future planned items are hidden |

### Cascade map + recommended semantics
**Recommended semantics (from the brief): past/completed records stay (audit
trail); future *planned* items hidden.** Verdict: **expressible with soft archive;
NOT expressible with the existing hard delete** because of these FK cascades:

- `operations_project_tasks.project_id → projects` **onDelete: Cascade**
  (`schema.prisma:2700`) — hard-deleting a project erases every task.
- `operations_daily_plan_items.task_id → tasks` **onDelete: Cascade**
  (`schema.prisma:2728`) — erases **every** day item for the task, **past and
  future** (destroys the record of completed work).
- `operations_calendar_blocks.daily_plan_item_id → items` **onDelete: Cascade**
  (`schema.prisma:2753`) — erases all blocks incl. completed actuals.
- `operations_task_status_history.task_id → tasks` **onDelete: Cascade**
  (`schema.prisma:2770`) — erases the status audit trail.

**Project archive (status → 'archived'):** a status PATCH touches nothing else —
all tasks, past day items, completed blocks, and history rows survive untouched
(audit preserved). Hiding from views is a **read-filter** change (§ table above).
To honor "future planned items hidden," optionally delete only the project's
tasks' **future, block-less** `daily_plan_items` (`plan_date >= today` and no
`calendar_blocks`) via the existing item-DELETE path — past/committed items stay.

**Single-task archive (project stays):** task `status → 'archived'` (or
`'cancelled'`). It drops out of Content INPUTS automatically (allowlist,
`tasks/unscheduled:35`), stays visible in evolution history, and its past day
items/blocks are untouched. Same optional future-planned-item cleanup.

### FK / relation complications to note
- The **cascade chain above** is the central complication — it is why "delete"
  cannot be the out-of-scope verb without losing audit data.
- `operations_daily_plan_items.@@unique([task_id, plan_date])`
  (`schema.prisma:2731`) — a task can appear on a given day at most once; an
  un-assign (delete item) cleanly frees it to be re-added (matches the 409-on-
  re-add UX, `ContentPipeline.tsx:197`).
- `operations_content_pieces` relation `ProjectContentPieces`
  (`schema.prisma:2662`) links projects→content; a hard project delete can 409 on
  blocking links (`projects/[id]/route.ts:316`). Soft archive sidesteps this.

---

## 3 · ROUTINES PARITY CHECK

Routines have **both** patterns:
- **Soft-deactivate** via `PATCH /api/operations/routines/[id]` `{ is_active }`
  (`routines/[id]/route.ts:216-221`; audits `operations_routine_deactivated`
  on true→false, `route.ts:6,286-295`). The list UI exposes a **"show inactive"**
  toggle and fetches `?is_active=true` by default
  (`RoutineList.tsx:37,48-50,183-190`). Steps mirror this with their own
  `is_active` soft-delete (`schema.prisma:2843-2847`).
- **Hard delete** via `DELETE /api/operations/routines/[id]`
  (`routines/[id]/route.ts:332-373`, cascades `routine_completions`).

**Recommendation:** mirror the routine **soft pattern** (`is_active` /
status-archived + a "show archived" toggle) as the **primary** out-of-scope action
for tasks and projects — it is the established, audit-preserving precedent.
**Flag:** a hard-delete route also exists for routines; do **not** elevate
hard-delete as the default for tasks/projects (it already exists but is
destructive per the cascade map). Keep hard-delete as a separate, explicitly
confirmed action (as it is today), and add archive alongside it.

---

## 4 · AUTH + SCOPE

Every route to be extended uses the identical, user-scoped pattern —
`getVerifiedEmail()` → `users.findFirst({ email insensitive })` → all queries
filtered by `user_id` (or ownership-checked find):

- `projects/[id]/route.ts:40-46` (GET), `:67-77` (PATCH), `:268-278` (DELETE) —
  `findProject` scopes `{ id, user_id }` (`:30-31`).
- `tasks/[taskId]/route.ts:51-57`, `:84-100`, `:407-423` — `findTask` scopes
  `{ id, project_id, user_id }` (`:35-36`).
- `daily-plan/items/route.ts:43-46` (GET), `:122-125` (POST, entity derived from
  owned task `:177-178`).
- `daily-plan/items/[itemId]/route.ts:36-39`, `:69`, `:177-180` — item lookups
  scope `{ id, user_id }` (`:78-79`).
- `tasks/unscheduled/route.ts:25-30` (`where.user_id`).
- `routines/[id]/route.ts` (same pattern).

**Conclusion:** the un-assign (DELETE item) and archive (PATCH status) flows both
ride existing user-scoped routes; no new auth surface. ✓ security mandate met.

---

## RECOMMENDED APPROACH — TWO PRs

### PR 1 — Un-assign a planned task from the day (gap A) · UI-only, 0-schema, 0 new routes
Reuse `DELETE /api/operations/daily-plan/items/[itemId]`
(`daily-plan/items/[itemId]/route.ts:172-219`).
1. **`TaskBand` PLANNED branch** (`TaskBand.tsx:202-203`): add a "remove from day"
   button (inline confirm, like `uncommit` at `:238-247`) → `DELETE /items/[itemId]`
   → `window.dispatchEvent(new Event(CONTENT_DAY_PLAN_CHANGED_EVENT))`.
2. **Content INPUTS** (`ContentPipeline.tsx`): change `addedTaskIds: Set<string>`
   → `Map<task_id, item_id>` (the item id is already in the `loadDayItems`
   response, `:99-102`); render "remove from day" on "✓ on day" rows
   (`:338-349`) → same DELETE + event.
- **Risk:** low. The DELETE captures cascade blocks into the audit; only PLANNED
  rows (no block) are offered remove, so no committed time is silently destroyed.
- **No migration.**

### PR 2 — Archive (soft) for projects & tasks (gap B) · 1 small enum migration
**Projects (no migration):**
1. List GET filter: `projects/route.ts:29-30` add `status: { notIn: ['archived'] }`
   unless `?show_archived=true`.
2. UI: an explicit "archive" action on `ProjectRow` (PATCH `status='archived'`,
   route already supports it `projects/[id]/route.ts:173-185`) + a "show archived"
   toggle on `SectionD_ProjectBacklog`, mirroring RoutineList's "show inactive".

**Tasks (1 enum migration — recommended):** add an `archived` value to
`OperationsTaskStatus` for clean semantics distinct from `cancelled`.
1. Migration (below). 2. Allow `archived` in the task PATCH status validation
   (`tasks/[taskId]/route.ts:286-294` already validates against the enum — it
   accepts any valid enum value, so the new value works once added). 3. Filter
   `archived` in `projects/[id]/tasks/route.ts:57-58` + "show archived" toggle in
   `TaskList`. Content INPUTS needs **no** change (allowlist already excludes it).
   - *Alternative (0-migration):* reuse `status='cancelled'`. Rejected as the
     primary recommendation — "cancelled" ≠ "parked/out-of-scope," and conflating
     them muddies the audit. Flag for Alex's decision.

**Optional cascade (both):** on archive, delete only **future, block-less**
`daily_plan_items` for the affected task(s) (`plan_date >= today`, no
`calendar_blocks`) via the item-DELETE path — honors "future planned hidden, past
kept." Past/committed/completed items + blocks are never touched.

- **Risk:** medium-low. Read-filter changes must cover every site in the §2 table
  (project list, project-task list); miss one and archived rows leak into a view.
  Evolution history (`projects/[id]/evolution`) must **intentionally keep** showing
  archived tasks. No cascade writes unless the optional future-item cleanup is
  included (keep it behind explicit, owner-scoped deletes).

### DRAFTED MIGRATION SQL (PR 2 only — NOT run; Alex runs psql)
```sql
-- Add an explicit "archived" lifecycle value to the task status enum.
-- Postgres ALTER TYPE ... ADD VALUE is non-transactional and cannot be undone
-- in the same migration; run standalone. Existing rows are unaffected.
ALTER TYPE "OperationsTaskStatus" ADD VALUE IF NOT EXISTS 'archived';

-- (Prisma side, applied in schema.prisma:2593-2600 to match — for reference)
-- enum OperationsTaskStatus {
--   open
--   in_progress
--   blocked
--   completed
--   cancelled
--   superseded
--   archived            // <-- new
-- }
```
> Projects need **no** migration — `ProjectStatus.archived` already exists
> (`schema.prisma:2221`). No new columns, no `deleted_at`, on either model.

---

## Summary
- **(A)** is **UI-only**: the `DELETE /daily-plan/items/[itemId]` route already
  removes a planned piece from the day (cascading its blocks, with audit). Wire it
  into the `TaskBand` PLANNED state and the Content INPUTS "✓ on day" rows. No
  route, no schema.
- **(B)** the destructive hard-delete already exists; the missing piece is
  **audit-preserving soft archive**. Projects need only read-filter + UI (status
  `archived` exists). Tasks need one `ALTER TYPE … ADD VALUE 'archived'` plus
  read-filter + UI. Mirror the routine `is_active` "show inactive" precedent; do
  not make hard-delete the default. Cascade FKs make soft archive the only path
  that keeps the past intact.
