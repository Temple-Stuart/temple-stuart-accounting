PR-OPS-HUB-1 PHASE 1 AUDIT REPORT
=================================

BRANCH STATUS
- main top 3: `734dcd6` (merge #569 PR-Ops-5.18 project-delete-audit) → `f6d420e` (merge #568 PR-Ops-5.18 project-delete-fix) → `d8581a1` (5.18 fix commit).
- **PR-Ops-5.17 confirmed merged** (#567). **PR-Ops-5.18 confirmed merged** (#568 fix + #569 audit).
- **PR-Ops-5.13 routine-cost-capture: ⚠ NOT MERGED.** Only the 5.13 AUDIT landed (#560, commit `b528629`). The Phase 2 implementation (commit `15e137b`, branch `claude/pr-ops-5.13-routine-cost-capture`) is still open — verified: `operations_routines` (schema.prisma:2716) has NO `estimated_cost_usd` / `coa_code` columns. **FLAG for Alex: 5.13 Phase 2 is unmerged. Not a blocker for THIS Hub task (routines aren't involved here), but the routine cost-capture work is sitting un-merged.**
- current branch: `claude/pr-ops-hub-1-task-assign-audit`

A. TASK DATA

**`operations_project_tasks` model — `schema.prisma:2596-2632`. FULL field list:**

| line | field | type |
|---|---|---|
| 2597 | `id` | `String @id @default(uuid()) @db.Uuid` |
| 2598 | `project_id` | `String @db.Uuid` |
| 2599 | `user_id` | `String` |
| 2600 | `entity_id` | `String` |
| 2601 | `title` | `String @db.VarChar(500)` |
| 2602 | `description` | `String? @db.Text` |
| 2603 | `status` | `OperationsTaskStatus @default(open)` |
| 2604 | `estimated_minutes` | `Int?` |
| 2605 | `estimated_cost_usd` | `Decimal? @db.Decimal(15, 2)` |
| 2606 | `deadline` | `DateTime? @db.Timestamptz(6)` |
| 2607-2610 | `priority_score / priority_inputs_hash / priority_computed_at / priority_rationale` | priority engine |
| 2611 | `unblocks_label` | `String? @db.Text` |
| 2612 | `link_url` | `String? @db.Text` |
| 2613 | `notes` | `String? @db.Text` |
| 2614 | `coa_code` | `String? @db.VarChar(50)` |
| 2615 | `actual_cost_usd` | `Decimal? @db.Decimal(15, 2)` |
| 2616 | `actual_minutes` | `Int?` |
| 2617 | `display_order` | `Int @default(0)` |
| 2618 | `completed_at` | `DateTime? @db.Timestamptz(6)` |
| 2619-2621 | `created_at / updated_at / created_by` | audit cols |

Relations (`:2623-2625`): `project` (→ operations_projects, Cascade), `daily_plan_items operations_daily_plan_items[]`, `status_history operations_task_status_history[]`.

- **There is NO date/time-block field ON the task itself.** No `scheduled_start`, no `scheduled_end`, no `plan_date`. `deadline` (`:2606`) is a due-date, NOT a schedule slot. The `OperationsTaskStatus` enum is `open / in_progress / blocked / completed / cancelled` (status, not schedule).
- → **Scheduling is EXTERNAL to the task** — it lives in `operations_daily_plan_items` + `operations_calendar_blocks`, linked via `task_id`.

**Cross-project task query:**
- **No existing cross-project / user-scoped task endpoint.** Tasks are fetched only per-project at `GET /api/operations/projects/[id]/tasks/route.ts` (`where: { project_id }`). The only other `operations_project_tasks.findMany` callers are `projects/[id]/tasks/route.ts` and `ai/optimize-north-star-section/route.ts` (which fetches by `project_id IN [...]`).
- **Recommended unscheduled-pool query (NEW endpoint):** `prisma.operations_project_tasks.findMany({ where: { user_id: user.id, status: { in: ['open','in_progress','blocked'] }, /* unscheduled filter, see A3 */ }, include: { project: { select: { title, entity_id } } } })`. User-scoped by `user_id` (every task carries `user_id` at `:2599`).

**"Unscheduled" signal — DEFINITIVE (not assumed):**
- A task is "scheduled onto the calendar" when it has an `operations_daily_plan_items` row (`task_id` = the task) that owns at least one `operations_calendar_blocks` row (a timed block with `scheduled_start`/`scheduled_end`).
- A task is "**unscheduled**" when it has **NO calendar_block via any daily_plan_item**. Two sub-cases collapse into "unscheduled":
  1. No `daily_plan_item` at all (never added to any day).
  2. A `daily_plan_item` exists but has zero `calendar_blocks` (added to a day's list but never given a time) — this is "planned but untimed", still effectively not ON the calendar grid.
- **There is no boolean/flag column for this** — "unscheduled" is a DERIVED state from the absence of a timed calendar_block. The cleanest Phase-2 query: tasks where NOT EXISTS a calendar_block joined through the task's daily_plan_items. Concretely: `where: { user_id, status: { in: [...] }, daily_plan_items: { none: { calendar_blocks: { some: {} } } } }` (Prisma relation filter — tasks that have no daily_plan_item with any calendar_block). **Recommend this as the canonical "unscheduled" predicate; confirm the open/in_progress/blocked status filter with Alex (exclude completed/cancelled).**

B. ASSIGN → CALENDAR PATH

**`operations_daily_plan_items` — `schema.prisma:2635-2655`:**
- `id` (`:2636`), `user_id` (`:2637`), `entity_id` (`:2638`), `plan_date DateTime @db.Date` (`:2639`), `task_id String? @db.Uuid` (`:2640`), `ad_hoc_title String? @db.VarChar(500)` (`:2641`), `ad_hoc_description` (`:2642`), `display_order` (`:2643`), `notes` (`:2644`), audit cols.
- Relations (`:2649-2650`): `task operations_project_tasks? @relation(..., onDelete: Cascade)` — **NOW CASCADE per PR-Ops-5.18** (was SetNull); `calendar_blocks operations_calendar_blocks[]`.
- CHECK constraint (migration-only, PR-4.0 `:25-26`): `task_id IS NOT NULL OR ad_hoc_title IS NOT NULL` — a row is either task-linked or ad-hoc.
- **Note:** `plan_date` is a `@db.Date` (no time) — the DAY. The TIME-OF-DAY lives on the calendar_block, not the daily_plan_item.

**`operations_calendar_blocks` — `schema.prisma:2658-2678`:**
- `id`, `user_id`, `entity_id`, `daily_plan_item_id String @db.Uuid` (`:2662`), `scheduled_start DateTime @db.Timestamptz(6)` (`:2663`), `scheduled_end` (`:2664`), `actual_start? / actual_end?` (`:2665-2666`), `status CalendarBlockStatus @default(scheduled)` (`:2667`), `notes`, audit cols.
- Relation (`:2673`): `daily_plan_item operations_daily_plan_items @relation(..., onDelete: Cascade)` — block dies with its item.

**The chain: task → daily_plan_item → calendar_block.** A task is placed on a specific DAY via a daily_plan_item (`plan_date`), and given a TIME on that day via a calendar_block (`scheduled_start`/`scheduled_end`).

**Existing "schedule a task" path (two endpoints, both exist):**
1. **Create the daily_plan_item:** `POST /api/operations/daily-plan/items/route.ts` — body `{ plan_date, task_id }` (task-linked) — derives `entity_id` from the task (β-1: never trust client), computes `display_order`, audits `operations_daily_plan_item_created`. (Per PR-Ops-5.3 audit.)
2. **Create the calendar_block (the time):** `POST /api/operations/daily-plan/items/[itemId]/blocks/route.ts:36-143` — body `{ scheduled_start, scheduled_end, status?, notes?, allow_conflicts? }`. Derives `user_id`/`entity_id` from the parent item (`:107-108`). **Conflict detection** via `detectBlockConflicts` (`:97`) → returns **409 with `conflicting_block_ids`** unless `allow_conflicts: true` (`:98-103`). Audits `operations_calendar_block_created`.
- → **"Assign a task to the calendar" = create daily_plan_item(task_id, plan_date) THEN create calendar_block(start, end).** Both endpoints already exist with auth + conflict handling. The category (COA) + cost already live on the TASK (`coa_code`, `estimated_cost_usd`) — "set category on assign" likely means PATCHing the task's `coa_code`/`estimated_cost_usd` (existing task PATCH) as part of the assign flow, OR just reading what's already there.

**How the Hub calendar READS events (`src/app/hub/page.tsx`):**
- `loadOperationsBlocks()` (`:213-235`) fetches `GET /api/operations/daily-plan/items?from=&to=` (`:222`) for the visible month → `operationsItems` state.
- `gridEvents` useMemo (`:353-...`) calls `mapOperationsBlocks(operationsItems)` (`:365`) → one `CalendarEvent` per calendar_block (`mapOperationsBlocks.ts:62-77`), carrying title, date, start/end time, `budgetAmount` (cost), `details` ("<coa> · $<cost>").
- → **An assigned task ALREADY renders on the Hub calendar automatically** once its daily_plan_item + calendar_block exist — NO new Hub-read wiring needed. The assign action just needs to create the item+block and trigger a refetch (`loadOperationsBlocks()`).

C. HUB LAYOUT

**`/hub` page:** `src/app/hub/page.tsx`. The `CalendarGrid` renders at `:397-403` (`<CalendarGrid events={gridEvents} onEventClick={handleEventClick} ... />`) inside the calendar Card. Below it are the year-calendar nav (`:428-430`) and the budget panels (BudgetDrillDown, nomad/business budget Cards further down).
- **Insertion point for the unscheduled-task table:** directly UNDER the `<CalendarGrid>` block (after `:403`, before the year-nav / budget panels). A new section/Card "Unscheduled Tasks" slots cleanly there.

**Reusable task-list/table component:**
- `src/components/workbench/operations/projects/TaskList.tsx` + `TaskRow.tsx` — the per-project task table (columns: title, status, est. minutes, est. cost, COA dropdown). Pattern reusable for the unscheduled table's columns.
- `src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx` — the daily-plan row with a "+ schedule block" inline form (PR-Ops-5.2) that already does the item→block creation flow. **This is the closest existing "assign" affordance** — its schedule-block form (start/end datetime inputs + conflict handling) is the exact UX to reuse for the Hub assign action.
- **Recommend:** build a LEAN new table (not reuse TaskList wholesale — that's project-scoped with edit forms); borrow TaskList's column styling + DailyPlanItemRow's schedule-block form pattern for the assign action.

D. POP-UP

**Existing pop-up/drawer pattern to reuse:** `src/components/hub/HubEventCard.tsx` (PR-Ops-5.5). It is EXACTLY the pop-up:
- Right-side slide-in panel (`max-w-lg`), `bg-black/30` backdrop, click-outside + Escape to close, × button, brand-purple header (mirrors BudgetDrillDown).
- **Header doc (`:15`): "Renders only sections that have data — no empty rows, no placeholders."** — this component ALREADY embodies the no-fabrication constraint. It is the right base to extend.
- Currently READ-ONLY (`:1` "read-only info card"). Reads from the already-fetched `DailyPlanItem` + `CalendarBlockSummary` — zero new fetches (`:20-22`).
- Wired in the Hub at `handleEventClick` (`page.tsx:160-172`): clicking an `operations`-source event resolves the `item` + `block` from `operationsItems` by `event.id` (= block.id) and sets `cardSelection` → renders `<HubEventCard>` (`:408`).

**Task data available to show in the pop-up TODAY** (all confirmed present, via `DailyPlanItem.task` + the block):
- `title`, `description` (task `:2601-2602`)
- `status` (`:2603`)
- `estimated_minutes` / `estimated_cost_usd` (`:2604-2605`), `actual_minutes` / `actual_cost_usd` (`:2615-2616`)
- `coa_code` (category) (`:2614`)
- `deadline` (`:2606`)
- `project` name + `entity_id` (via the task's project relation)
- block `scheduled_start`/`scheduled_end`, `actual_start`/`actual_end`, `status` (`:2663-2667`)
- → mission/principles aside, **everything the brief lists (title, project, entity, est. time, est. cost, COA, status, deadline) EXISTS today.**

**Data that does NOT exist yet (the future-extension sections — DO NOT render now):**
- Trading module data (P&L, positions per task) — module unbuilt.
- Tax module data (tax treatment, deduction class) — unbuilt.
- Compliance module data (regulatory linkage) — unbuilt.
- Budget-vs-actual variance LINE (the budget-line rewire) — **separate later task, explicitly out of scope.**
- → These become new HubEventCard sections AS those modules ship. Per the no-fabrication rule, **render nothing for them now** (HubEventCard's "only sections with data" pattern handles this naturally — just don't add the sections).

**Edit / reschedule / reconcile — existing vs new (all three have endpoints TODAY):**
- **Edit task:** `PATCH /api/operations/projects/[id]/tasks/[taskId]/route.ts:79` — updates title, description, status, estimated_*/actual_*, coa_code, deadline, etc. EXISTS.
- **Reschedule:** `PATCH /api/operations/daily-plan/blocks/[blockId]/route.ts:38` — mutates `scheduled_start`/`scheduled_end` (per its header `:4-5`). EXISTS.
- **Reconcile:** SAME block PATCH (`blocks/[blockId]/route.ts:38`) — mutates `actual_start`/`actual_end`/`status` (`:4-5`). EXISTS. (Plus task PATCH for `actual_cost_usd`/`actual_minutes`.)
- → **No new write endpoints needed for the pop-up actions.** The pop-up wires existing PATCH endpoints; the work is UI (forms in the card + the fetch calls + refetch on success).

E. RECOMMENDATION

- **Unscheduled-pool query (NEW endpoint, e.g. `GET /api/operations/tasks/unscheduled` or `/api/hub/unscheduled-tasks`):**
  `prisma.operations_project_tasks.findMany({ where: { user_id: user.id, status: { in: ['open','in_progress','blocked'] }, daily_plan_items: { none: { calendar_blocks: { some: {} } } } }, include: { project: { select: { id: true, title: true, entity_id: true } } }, orderBy: [{ deadline: 'asc' }, { priority_score: 'desc' }] })`. Auth: `getVerifiedEmail` + `prisma.users.findFirst` (mirror every operations endpoint). User-scoped by `user_id`.

- **Lean table (under CalendarGrid, `page.tsx` after `:403`):** columns `Task · Project · Est. time · Est. cost · COA · [assign]`. Borrow TaskList column styling. Each row's `[assign]` opens the assign affordance.

- **Assign action:** reuse the DailyPlanItemRow "+ schedule block" form pattern — inputs for `plan_date` + `scheduled_start`/`scheduled_end` (+ optional category/cost edit via task PATCH). On submit: (1) `POST /api/operations/daily-plan/items` `{ plan_date, task_id }` → get `itemId`; (2) `POST /api/operations/daily-plan/items/[itemId]/blocks` `{ scheduled_start, scheduled_end }`. On 409 conflict, surface the conflict + offer `allow_conflicts: true` retry (mirror DailyPlanItemRow's existing conflict UX). On success, refetch `loadOperationsBlocks()` (block appears on the calendar) + refetch the unscheduled pool (task leaves the table). "Category on assign" = optionally PATCH the task's `coa_code`/`estimated_cost_usd` first; **confirm with Alex whether assign edits the task's COA or just reads it.**

- **Calendar-click pop-up:** EXTEND `HubEventCard` (don't build new). Keep its read-only sections, ADD edit/reschedule/reconcile action buttons that open inline forms wiring the existing task PATCH + block PATCH endpoints. Render ONLY the real-data sections (task detail, project, entity, est/actual time + cost, COA, status, deadline, block times). **Add NO sections for Trading/Tax/Compliance/budget-variance** — they ship later as the modules land. HubEventCard's "only sections with data" doctrine (`:15`) already enforces this.

- **Auth:** every new/extended path uses `getVerifiedEmail` + `prisma.users.findFirst`; the unscheduled query is `user_id`-scoped; the assign endpoints already derive entity/user from the task/item server-side (never trust client); the pop-up's PATCH targets go through the existing ownership-checked task/block endpoints. No new auth model.

- **No-fallback:** assign conflict → 409 surfaced with the conflicting block (no silent placement); assign failure (bad date, DB error) → clear error in the form (no silent success, no fabricated block); pop-up action failure → error in the card (no optimistic lie). Mirror the existing DailyPlanItemRow + HubEventCard error conventions.

- **Schema change: NONE.** Confirmed — reuses `operations_project_tasks` + `operations_daily_plan_items` + `operations_calendar_blocks`, all existing. The "unscheduled" state is a derived query, not a new column. No migration.

- **Scope + files (estimated for Phase 2):**
  1. `src/app/api/operations/tasks/unscheduled/route.ts` (NEW) — the user-scoped unscheduled-pool GET. ~50 lines.
  2. `src/components/hub/UnscheduledTaskTable.tsx` (NEW) — the lean table + the assign affordance (reusing the schedule-block form pattern). ~180 lines.
  3. `src/app/hub/page.tsx` (modify) — fetch the unscheduled pool, render `<UnscheduledTaskTable>` under the CalendarGrid, refetch both pools after an assign. ~30 lines.
  4. `src/components/hub/HubEventCard.tsx` (modify) — add edit/reschedule/reconcile action sections + inline forms wiring the existing task PATCH + block PATCH; keep the no-placeholder doctrine. ~120 lines.
  - **Total: 2 new files + 2 modified. ~380 lines. No schema, no migration, no new write endpoint** (the assign + edit + reschedule + reconcile all use endpoints that already ship).

- **Open decisions for Alex:**
  1. **"Unscheduled" signal — confirm the predicate:** "tasks with NO timed calendar_block" (recommended: `daily_plan_items: { none: { calendar_blocks: { some: {} } } }`) — this treats a task that's on a day's list but never time-blocked as STILL unscheduled. Alternative: "no daily_plan_item at all" (a task added to a day but untimed would then NOT show in the pool). Recommend the former (timed-block is the real "scheduled" signal, matching what renders on the calendar).
  2. **Status filter for the pool:** open/in_progress/blocked only (exclude completed + cancelled)? Recommend yes.
  3. **"Category" on assign = COA?** The brief says "set category + start/end". Category most likely = the task's `coa_code` (the existing category field). Confirm: does assign EDIT the task's `coa_code`/`estimated_cost_usd` (PATCH the task), or just READ what's already set? Recommend: allow editing COA + est. cost inline in the assign form (PATCH task), since the unscheduled task may not have them set yet.
  4. **Drag-drop now or date-set now?** Recommend date/time SET via a form now (mirrors the proven DailyPlanItemRow schedule-block form); drag-drop onto the calendar is a richer follow-up. Confirm Alex is fine with form-based assign for the June 1 demo.
  5. **Pop-up edit scope:** full task edit (title/description/status/cost/COA/deadline) in the card, or a lean "reschedule + reconcile + link-out to full edit"? Recommend lean in-card reschedule + reconcile + a couple of high-value task fields (status, actual cost/time), with a "open in Projects" link for deep edits — keeps the card focused.
  6. **New endpoint location:** `/api/operations/tasks/unscheduled` (operations-namespaced) vs `/api/hub/unscheduled-tasks` (hub-namespaced)? Recommend operations-namespaced (it's operations data; the Hub is just one consumer).
  7. **5.13 routine-cost Phase 2 is unmerged** — not part of this task, but flagging: merge it or consciously leave it. No impact on Hub-1.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-hub-1-phase-1.md.
