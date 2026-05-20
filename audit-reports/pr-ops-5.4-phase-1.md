PR-OPS-5.4 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `87dbbe0` (merge #543 PR-Ops-5.3) → `e79fbe1` (5.3 itself) → `17c27d0` (merge #542 PR-Ops-5.3 audit). 5.3 confirmed on main.
- current branch: `claude/pr-ops-5.4-date-flow-audit`

A. TASK DATE FIELD

- **`operations_project_tasks` date/time fields** (`prisma/schema.prisma:2596-2632`):
  - `deadline DateTime? @db.Timestamptz(6)` — `:2606`, indexed at `:2629`
  - **NO** `time_block_start` / `time_block_end` / `scheduled_for` / any other date-or-time column on this model. (Per prior audits, the time-block work in PR-Ops-5.2 used the existing `daily_plan_items → calendar_blocks` chain rather than denormalizing onto the task.)
- **`↗ schedule` POST body (`TaskRow.tsx:206-229`):**
  ```ts
  fetch('/api/operations/daily-plan/items', {
    method: 'POST',
    body: JSON.stringify({ plan_date: targetDate, task_id: task.id }),
  })
  ```
  `targetDate` is the string passed into `handleSchedule(targetDate)`.
- **Date-picker in schedule flow:** YES, and it's NOT auto-filled from `task.deadline`. The schedule menu UI (`TaskRow.tsx:339-388`) offers three sources for `targetDate`:
  1. `todayIso()` button (`:348-353`) — today UTC
  2. `tomorrowIso()` button (`:354-361`) — today+1 UTC
  3. A `<input type="date">` bound to `scheduleDate` state (`:363-369`), submitted via a `schedule` button (`:370-377`)
- **The `scheduleDate` state initial value** (`TaskRow.tsx:80-82`):
  ```ts
  const [scheduleDate, setScheduleDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  ```
  **Initialized to today's UTC date. Does NOT consult `task.deadline`.**

B. DAILY_PLAN_ITEMS DATE

- **`operations_daily_plan_items` schema** (verified prior, `:2635-2656`): `plan_date DateTime @db.Date` (NOT NULL), `task_id String? @db.Uuid` (nullable FK, onDelete SetNull).
- **POST items required body** (`items/route.ts:121-126`):
  ```ts
  if (typeof body.plan_date !== 'string' || body.plan_date.length === 0) {
    return 400 { error: 'Validation', field: 'plan_date', message: 'plan_date is required (YYYY-MM-DD)' };
  }
  ```
  **`plan_date` is required from the client.** The server does NOT derive it from the linked task's deadline — even when `task_id` is supplied, the server only uses the task lookup to derive `entity_id`, not `plan_date` (`items/route.ts:158-171`).
- **`plan_date` source when `↗ schedule` fires:** option **(b) user-pick** — but the user-pick options are today / tomorrow / a manually-set date that **defaults to today**, NOT to `task.deadline`. So in practice: if the user just clicks "today", they get today; if they manually pick the deadline date, they re-enter it. Either way, the deadline is not auto-flowed forward.

C. CALENDAR_BLOCK DATE+TIME (PR-Ops-5.2 block form)

- **Block date pre-fill logic** (`DailyPlanItemRow.tsx:44-61`, `defaultBlockWindow(item)`):
  ```ts
  function defaultBlockWindow(item: DailyPlanItem): { start: Date; end: Date } {
    let start: Date;
    if (item.calendar_blocks.length > 0) {
      const lastEnd = item.calendar_blocks[item.calendar_blocks.length - 1].scheduled_end;
      start = new Date(lastEnd);
    } else {
      const datePart = item.plan_date.slice(0, 10);
      start = new Date(`${datePart}T09:00`);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  }
  ```
  The date component of the start is **`item.plan_date.slice(0, 10)` — pre-filled from the daily_plan_item's `plan_date`** when opening a fresh block form.
- **User re-enters DATE at block step, or only TIME?** **ONLY TIME.** The `datetime-local` input opens pre-populated with the correct date (from `plan_date`); the user only needs to adjust the time portion. **No date re-entry at the block step. PR-Ops-5.2 already handles this correctly.**

D. REDUNDANCY POINTS — EXACTLY ONE

- **Re-entry point 1 — Task `↗ schedule`:** the `scheduleDate` state defaults to today (`TaskRow.tsx:80-82`), ignoring `task.deadline`. If a task has `deadline = 2025-05-30` and the user clicks `↗ schedule`, the date input shows today, not 2025-05-30. The user must either (a) accept today (wrong if the task was deadline-anchored to a future date), (b) click "tomorrow" (also wrong if deadline is further out), or (c) manually pick 2025-05-30 — **re-entering the date they already typed when setting the deadline.**
- **Re-entry point 2 — Block form (`+ schedule block`):** **NONE.** The date component of `scheduled_start` is pre-filled from `plan_date` per Section C. Only the time is entered fresh. This step is already clean.

**Conclusion: the redundancy Alex hit is at the task → daily-plan handoff, not at the daily-plan → block handoff.** PR-Ops-5.2's defaultBlockWindow already eliminated the second potential redundancy. Fixing the first is a single-file UI-default change.

E. FIX RECOMMENDATION — Option A (minimal, UI-default only)

- **Recommended: Option A.** Initialize `scheduleDate` from `task.deadline` when present, fall back to today when not.
- **Schema change needed:** **NO.** Pure UI default. No API change. No migration.
- **Files to touch:** 1 file — `src/components/workbench/operations/projects/TaskRow.tsx` (the `useState` initializer at `:80-82`, ~5 lines changed; possibly a small useEffect to re-sync when the menu reopens after an edit).
- **Estimated scope:** ~5–10 lines, single file, no new helpers.
- **Implementation sketch (for Phase 2):**
  ```ts
  const [scheduleDate, setScheduleDate] = useState<string>(() =>
    task.deadline ? task.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  ```
  Optionally re-sync on menu-open so a deadline edit after first render is honored:
  ```ts
  // when toggling the schedule menu open, refresh the picker default
  const openScheduleMenu = () => {
    setScheduleDate(task.deadline ? task.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setScheduleMenuOpen(true);
  };
  ```
- **Why not Option B/C:**
  - **Option B** (block form pre-fills from plan_date) — already done in 5.2 (`defaultBlockWindow:50-61`). Nothing to fix.
  - **Option C** (combined "schedule with time" in one step, merging the TaskRow menu and the DailyPlanItemRow block form) — significantly larger scope. Would require either a new combined endpoint or two-step orchestration in TaskRow, plus a new UI surface, plus duplicating the block-rendering view. Breaks the two-surface model (Projects = define work; Daily Plan = own the day; Hub = view the calendar). Defer; not justified by current pain.
- **Convention consistency note:** `task.deadline.slice(0, 10)` matches the existing `taskToForm` initializer at `TaskRow.tsx:54` (`t.deadline ? t.deadline.slice(0, 10) : ''`) — UTC date extraction, same string format that round-trips through the PATCH endpoint. The user sees the same date string in the deadline edit field, in the schedule date-picker, and in the eventual `plan_date`. **One canonical date string flows forward.**
- **Open decisions for Alex:**
  1. Should the "today" and "tomorrow" quick buttons remain even when the task has a deadline? **Recommend YES** — they're useful escape hatches when the user wants to schedule earlier than the deadline (e.g., front-load work). The deadline becomes the default; today/tomorrow stay as one-click overrides.
  2. Should the menu re-sync `scheduleDate` if the user edits the deadline after first opening the menu? **Recommend YES** via the `openScheduleMenu` helper (above) — re-initialize on every menu-open. Minor enhancement, prevents stale state.
  3. Should the success toast text be reworded ("scheduled for 2025-05-30" → "scheduled on deadline 2025-05-30" when deadline-matched) for visibility into what just happened? **Recommend NO for v1** — the existing toast is fine; adds noise.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.4-phase-1.md.
