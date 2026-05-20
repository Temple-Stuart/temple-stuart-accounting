PR-OPS-5.2 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3 commits: `d6559b8` (merge #539 PR-Ops-5.1.5 lint harness) → `cedf5e2` (5.1.5 commit itself) → `6d5eeb0` (merge #538 PR-Ops-5.1.7 entity_id threading). **PR-Ops-5.1.5 (cedf5e2) is present on main ✓.**
- current branch: `claude/pr-ops-5.2-calendar-block-audit`

A. TASKROW CURRENT STATE (post-5.1.x)
- **Props (TaskRow.tsx:21-28):**
  ```
  task: Task; projectId: string; index: number; coaAccounts: CoaAccountSummary[]; onUpdate: () => void; onDelete: () => void;
  ```
  No `entity_id` prop on TaskRow — that prop was added to TaskList in 5.1.7, not propagated down. TaskRow has `task.entity_id` available via the task object.
- **↗ schedule behavior (TaskRow.tsx:206-229):** `handleSchedule(targetDate)` POSTs to `/api/operations/daily-plan/items` with **only `{ plan_date, task_id }`**. **No block side-effect, no second call.** Unchanged from audit a67a97c.
- **Renders calendar blocks:** **NO.** No `calendar_block`, `scheduled_start`, or `scheduled_end` reference in TaskRow. Blocks are rendered exclusively by DailyPlanItemRow.
- **Expanded grid (TaskRow.tsx:482-529)** — 6 cells in `grid-cols-3` (2 rows of 3):
  - Row 1 (`:483-516`): est. minutes · est. cost (usd) · category (coa_code with name lookup against `coaAccounts`, amber-warning fallback for stale codes)
  - Row 2 (`:517-528`): actual minutes · actual cost (usd) · completed at
- **Inline-form pattern in TaskRow:** TaskRow has **TWO inline-expanding sub-forms** today: (a) the schedule date-picker menu (`scheduleMenuOpen`, `:343+`) and (b) the status-history popdown (`showHistory`, `:389+`). Full task edit lives in a separate `editing` mode toggle (`:547+`) — a full-form rewrite, not inline cells. So the inline-expanding pattern is already established and available for a "+ schedule block" affordance if E2 is chosen.

B. DAILYPLANITEMROW + BLOCKS
- **Read-only block render (DailyPlanItemRow.tsx:156-164):**
  ```jsx
  {item.calendar_blocks.length > 0 && (
    <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-border-light">
      {item.calendar_blocks.map((b) => (
        <div key={b.id} className="text-xs font-mono text-text-muted">
          {formatTime(b.scheduled_start)}–{formatTime(b.scheduled_end)} · {b.status}
        </div>
      ))}
    </div>
  )}
  ```
  Confirmed identical to audit a67a97c.
- **`CalendarBlockSummary` shape (dailyplan/types.ts:3-11):** `id, scheduled_start, scheduled_end, actual_start, actual_end, status, notes`. Missing client-side: `daily_plan_item_id, user_id, entity_id, created_*, updated_*`.
- **Block creation UI present here: NO.** Comment at `DailyPlanItemRow.tsx:5-6` says *"calendar_blocks are listed read-only beneath (block creation/editing is PR-Ops-4.5)"* — a stale forward-reference; the work slipped into the 5.x series. PR-Ops-5.2 is the actual delivery.
- **Blocks data source:** DailyPlanItemRow receives `item: DailyPlanItem` as a prop (`:16-17`); `item.calendar_blocks` is populated **server-side via the GET items include** (`items/route.ts:92-95`):
  ```
  include: {
    calendar_blocks: { orderBy: { scheduled_start: 'asc' } },
    task: { select: { id: true, title: true, status: true } },
  }
  ```

C. API SURFACE
- **GET `/api/operations/daily-plan/items` returns blocks nested: YES** (`items/route.ts:90-97`, ordered by `scheduled_start` asc).
- **GET items `?task_id=` filter: NO.** The GET handler only honors `?from=YYYY-MM-DD` and `?to=YYYY-MM-DD` (`items/route.ts:51-88`). The Prisma where clause (`:91`) filters by `user_id` + `plan_date` range only. **If TaskRow needs a task's plan items, a filter expansion or new endpoint is required.**
- **POST `/api/operations/daily-plan/items/[itemId]/blocks` request body:**
  - `scheduled_start: string` (ISO datetime, required, `:58-64`)
  - `scheduled_end: string` (ISO datetime, required, must be > start, `:65-77`)
  - `status?: CalendarBlockStatus` (default `'scheduled'`; valid: scheduled | in_progress | completed | missed | cancelled, `:79-88`)
  - `notes?: string` (trimmed, empty → null, `:90-93`)
  - `allow_conflicts?: boolean` (default false, `:95`)
- **409 conflict shape (`:99-102`):**
  ```json
  { "error": "Conflict", "conflicting_block_ids": ["uuid", "uuid", ...] }
  ```
  Returned only when conflicts exist **and** `allow_conflicts !== true`.
- **201 success shape (`:135`):**
  ```json
  { "block": { /* full operations_calendar_blocks row */ }, "conflicts": ["uuid", ...] }
  ```
  Note: `conflicts` is returned **even on success** — when `allow_conflicts: true` overrides a conflict, the array tells the UI which existing blocks were overlapped (so it can render a visual indicator). Empty array means no conflict.
- **Auth pattern (`:41-54`):** `getVerifiedEmail` → `prisma.users.findFirst` → `loadAuthorizedDailyPlanItem(itemId, user.id)` (ownership-scoped; cross-user → 404 defensive). `user_id` and `entity_id` for the new block are derived from the parent item (`:107-108`), **never trusted from the client**.
- **Conflict definition + scope (`src/lib/operations/detectBlockConflicts.ts`):**
  - Postgres `OVERLAPS ((s1,e1),(s2,e2))` operator. **Half-open intervals** — a block ending at T does NOT conflict with one starting at T.
  - Filters out `cancelled` and `missed` blocks (those slots are free).
  - **Scoped per-user (NOT per-entity).** A user with multiple entities will see cross-entity overlap as a conflict. (This is consistent with the schema — calendar_blocks have user_id but the conflict check doesn't partition by entity.)
  - Race note: detection is not transactional with the subsequent write — α-1 single-user race-acceptance.

D. DATA FLOW (task → plan_item → block)
- **Does a task always have a daily_plan_item before scheduling? NO.** Items are created on demand by the existing ↗ schedule button. Schema: `operations_daily_plan_items.task_id String? @db.Uuid` is **nullable**, FK SetNull (audit a67a97c, line 2649). A never-scheduled task has zero plan items.
- **Two-step required if entering from TaskRow:** (1) `POST /api/operations/daily-plan/items {plan_date, task_id}` → get `item.id`, (2) `POST /api/operations/daily-plan/items/[itemId]/blocks {scheduled_start, scheduled_end, ...}`. Two API calls, two failure modes (item-create can succeed while block-create 409s → orphan empty item).
- **One-step if entering from DailyPlanItemRow:** item already exists in scope (it's `item.id` in the row's props). Only step 2 fires.
- **Recommended flow:** depends on placement (Section E). If E1 (DailyPlanItemRow): one-step, simpler. If E2 (TaskRow): two-step, with orphan-cleanup question (do we delete the empty item if block-create fails? probably yes via DELETE /api/operations/daily-plan/items/[itemId] — but that's extra error-path complexity).

E. FORM PLACEMENT RECOMMENDATION

**Option E1 — DailyPlanItemRow** (add "+ schedule block" inline form next to the existing read-only block list at `:156-164`):
- **Pros:**
  1. Single API call (item already exists in scope; only the blocks POST fires).
  2. Conflict UX is local to a day the user is already focused on.
  3. Read + write block UI co-located in one component (consistency).
  4. Daily Plan tab is the canonical time-scheduling surface — schema + existing UI already point here.
  5. No new endpoint or filter expansion needed (no `?task_id=` GET filter required).
- **Cons:**
  1. Project-task-centric users must navigate to the Daily Plan tab to assign a time window — context switch.
  2. The block affordance only appears after the task has been scheduled to a day (the existing ↗ schedule covers item creation).

**Option E2 — TaskRow** (add "+ schedule block" in the expanded body):
- **Pros:**
  1. User schedules from the project task list without leaving — one-stop shop for the task lifecycle.
  2. Closes the visible gap between ↗ schedule and "actually pick a time window."
- **Cons:**
  1. **Two-step API call** with orphan-item risk if block-create 409s.
  2. Requires `?task_id=` filter on items GET (or a new endpoint, or include items in tasks GET) so TaskRow can see existing items + their blocks. **New API surface needed.**
  3. Duplicates block-rendering in TaskRow (mirror DailyPlanItemRow), or accepts that TaskRow shows no existing blocks (then user can't see what they already scheduled — bad).
  4. Date picker (which day) + time pickers (window within day) in one form — more state to manage.
  5. Splits the source-of-truth: now block creation has two homes (TaskRow + DailyPlanItemRow).

**Recommendation: E1 (DailyPlanItemRow).**

Reasoning:
1. The Phase 1 prompt's own locked design language ("a separate '+ schedule block' inline-expanding form **near the block list**") describes DailyPlanItemRow's existing block list — that phrasing implies E1.
2. Single API call, no new endpoint, no duplicated UI, no orphan-cleanup logic.
3. The current user flow already ends at Daily Plan: ↗ schedule → success toast → user navigates to Daily Plan to verify. Adding "+ block" inside DailyPlanItemRow completes that flow naturally without forcing a UI split.
4. If we later want a task-centric shortcut (E2 as a convenience), it can call the same primitive (POST `/api/operations/items` then POST `/blocks`) via a single button in TaskRow without duplicating the form UI. Build E1 first; layer E2 later if Alex wants the shortcut.

**Flag for Alex decision:** if the product intent is "user lives in the project task list and never touches Daily Plan," then E2 wins despite its costs (new endpoint, two-step, duplicate UI). If the product intent is "Daily Plan is where the day is owned, project list is where work is defined," E1 wins. **Confirm E1 vs E2 before Phase 2.**

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.2-phase-1.md.
