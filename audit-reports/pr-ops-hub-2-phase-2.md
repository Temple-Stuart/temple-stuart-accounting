# PR-OPS-HUB-2 — Phase 2 Build Report

Implements the Phase 1 audit (`audit-reports/pr-ops-hub-2-phase-1.md`): the flat
unscheduled-tasks table on `/hub` is regrouped into per-project queues, stacked
vertically, each a bounded card with its own internal scroll. Presentation +
one additive `select` field + ordering. No schema, no migration. Built off
`main` (includes Hub-1 #571 and DPI-Unique, both merged). Alex confirmed
`display_order` is populated per project, so server-side ordering on it is
meaningful.

---

## 1. Endpoint — additive select + ordering

`src/app/api/operations/tasks/unscheduled/route.ts`:

- **Added** `display_order: true` to the task `select` (now line 47) — it was
  used in `orderBy` but never returned (the audit gap); the client needs it in
  the type and the payload.
- **Changed** `orderBy` (line 50) from
  `[{ deadline: { sort: 'asc', nulls: 'last' } }, { display_order: 'asc' }]`
  to:
  ```ts
  orderBy: [{ project_id: 'asc' }, { display_order: 'asc' }, { id: 'asc' }],
  ```
  `project_id` makes each project's tasks contiguous; `display_order` is the real
  intra-queue sort (populated, verified); `id` is the deterministic tiebreaker so
  queues never shuffle on display_order ties.
- `project.id` was already in the select (`project: { select: { id, title,
  entity_id } }`, line 48) — unchanged. **No other field changes. Auth /
  user-scoping unchanged** (the `where` clause, `getVerifiedEmail`, and the user
  lookup at lines 24-37 are untouched). No schema change — `display_order` is an
  existing column on `operations_project_tasks`.

---

## 2. Component — regroup into stacked bounded queues

`src/components/hub/UnscheduledTaskTable.tsx`:

- **Type widened** (line 31): added `display_order: number` to the
  `UnscheduledTask` interface. Import widened to `{ useMemo, useState }`.
- **Grouping `useMemo`** (the new `queues`): groups tasks into
  `{ projectId, projectTitle, tasks[] }[]` using a `Map` keyed on **`t.project.id`
  (the UUID, never `project.title`)**. It iterates `tasks` in arrival order and
  pushes into first-seen groups, so it **preserves the server order with no
  client-side re-sort** (tasks already arrive contiguous-per-project + sorted by
  `display_order, id`). Cited:
  ```ts
  const queues = useMemo<ProjectQueue[]>(() => {
    const byId = new Map<string, ProjectQueue>();
    for (const t of tasks) {
      let q = byId.get(t.project.id);
      if (!q) { q = { projectId: t.project.id, projectTitle: t.project.title, tasks: [] }; byId.set(t.project.id, q); }
      q.tasks.push(t);
    }
    return Array.from(byId.values());
  }, [tasks]);
  ```
- **Each queue card** reuses the existing card chrome (`border border-border
  rounded bg-white`). Inside, a `max-h-[300px] overflow-y-auto` scroller caps
  every queue to ~6 visible rows then scrolls internally, so a 13-task and an
  8-task project occupy equal footprint. A `sticky top-0 bg-white z-10` block
  holds the project header (`projectTitle` + `queue.tasks.length`) and the column
  legend, so both stay visible while the rows scroll (idiom from
  `SectionK_AuditTail.tsx:262-264`).
- **Row markup is the verbatim existing markup**, minus the dropped Project
  column (see §5), and still renders `<AssignForm task={t} onDone={() => {
  setOpenId(null); onAssigned(); }} />` exactly as before.
- **Empty state**: when `tasks.length === 0`, the single existing empty-state
  message renders (not 8 empty cards).

---

## 3. AssignForm + saving gate + 409 handling — byte-unchanged

`AssignForm` (the function and its body) and the row's assign logic were **not
edited**. Verified: `git diff` on the component shows hunks only in the header
comment, the import line, the `UnscheduledTask` interface, and the default-export
render function; **zero diff lines touch** `submit` / `saving` / `conflictIds` /
`allow_conflicts`. So the in-flight `saving` gate (`useState(false)` + `setSaving`
around the fetch + `disabled={saving}` on every submit button) and the 409
conflict handling (`setConflictIds` on status 409 + the "schedule anyway / pick
another time" UI) are preserved exactly. The assign endpoint, conflict detection,
and auth were not touched.

---

## 4. Single shared `openId`

`openId` remains a **single top-level `useState<string | null>`** in
`UnscheduledTaskTable` (not per-queue). The assign toggle is `setOpenId(openId
=== t.id ? null : t.id)` and the form renders only where `openId === t.id`.
Because the state is global to the component, opening a form in one queue closes
any open form in another — one task assigned at a time across all 8 queues.

---

## 5. Project-column decision: DROPPED (per-row), moved to card header

Each queue is exactly one project, so the per-row `Project` column was redundant.
I **dropped it from the rows and the column legend** and moved project identity to
the sticky card header (`projectTitle · count`). The row/header grid template
changed from `grid-cols-[2fr_1.5fr_auto_auto_auto_auto]` (6 cols) to
`grid-cols-[2fr_auto_auto_auto_auto]` (5 cols: Task / Est. time / Est. cost / COA
/ assign-button). Everything else (est time/cost/coa, the assign button, blocked
dimming + chips) is unchanged. Rationale: cleaner, removes duplicated data, and
the row markup stays simple — the only change to a row cell was deleting the one
`{t.project.title}` cell.

---

## 6. Outer container — page wiring

`src/app/hub/page.tsx`: the `<UnscheduledTaskTable>` render region (was lines
442-445) is now wrapped in a fixed-height scroll container:
```tsx
<div className="max-h-[640px] overflow-y-auto">
  <UnscheduledTaskTable
    tasks={unscheduledTasks}
    onAssigned={() => { loadOperationsBlocks(); loadUnscheduledTasks(); }}
  />
</div>
```
so the whole queue-stack scrolls as a unit below `CalendarGrid` (the calendar
stays in view). **The page's fetch and `onAssigned` are unchanged** — same
`unscheduledTasks` forwarded, same refetch (`loadOperationsBlocks` +
`loadUnscheduledTasks`). `loadUnscheduledTasks` (lines ~245-258), its state
(line ~150), and the mount effect (line ~189) are untouched; the `display_order`
type widening passes through transparently. **Budget panels, actuals wiring, and
the calendar render are untouched** (only the unscheduled-pool wrapper changed).

---

## 7. Verification

- **`tsc --noEmit`:** ✓ exit 0, no type errors.
- **`next build`:** ✓ `Compiled successfully in 41s`, "Checking validity of
  types" passed. The build then errored only at page-data collection on the
  **unrelated** route `/api/admin/backfill-transaction-fields`
  (`PLAID_CLIENT_ID and PLAID_SECRET must be set` at module load) — the same
  sandbox-env limitation seen in Hub-1 / DPI-Unique (the `build` script also
  chains `prisma migrate deploy`, which needs an unreachable `DATABASE_URL`).
  Not produced by this change; compilation of the edited Hub page + component +
  endpoint succeeded.

No fallback logic, no schema, no migration. Assign flow, conflict detection,
auth, budget/actuals, and the calendar are untouched.
