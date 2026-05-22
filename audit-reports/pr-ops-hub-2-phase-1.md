# PR-OPS-HUB-2 — Phase 1 Audit (read-only)

**Goal of the eventual PR:** replace the single flat unscheduled-tasks table on
`/hub` with eight per-project queues, stacked vertically in one outer container.
Each queue is a bounded card (project header + task count + its own internal
vertical scroll at a fixed max-height), all visible at once, tasks ordered by
`display_order` within each queue. **Presentation-only** — same data, same assign
flow, regrouped and re-rendered.

Audit branch cut from `main` (which now includes Hub-1 #571 **and** the merged
DPI-Unique work). No source edits. All citations verified against live files.

---

## 1. Unscheduled endpoint — returned task shape

`src/app/api/operations/tasks/unscheduled/route.ts`, the `select` (lines 39-48):

```ts
select: {
  id: true,                  // 40
  title: true,               // 41
  status: true,              // 42
  estimated_minutes: true,   // 43
  estimated_cost_usd: true,  // 44
  coa_code: true,            // 45
  deadline: true,            // 46
  project: { select: { id: true, title: true, entity_id: true } },  // 47
},
```

- **Stable `project_id` — PRESENT ✅** as `project.id` (line 47). This is the safe
  grouping key (a UUID, not the display string). Mirrored in the component's
  exported `UnscheduledTask` type: `project: { id: string; title: string;
  entity_id: string }` (`UnscheduledTaskTable.tsx:27`), so it's already available
  client-side.
- **Project title for the header — PRESENT ✅** as `project.title` (line 47).
- **`display_order` — NOT RETURNED ⚠️.** It is used in the `orderBy` (line 49) but
  is **not in the `select`**, so it never reaches the client. This is the one
  additive gap.

**What's missing / needed (additive, no schema change):**
1. Add `display_order: true` to the endpoint `select` (route.ts:39-48).
2. Add `display_order: number` to the `UnscheduledTask` interface
   (`UnscheduledTaskTable.tsx:19-28`).

Both are pure additive type/select widening — no migration, no schema change.
(Strictly, if ordering is done **server-side** per §2, the client doesn't need
`display_order` in the payload to *sort*; but returning it is cheap and lets the
component reason about/secondary-sort without a re-fetch. Recommend adding it.)

---

## 2. Ordering — recommend server-side `orderBy: [{ project_id }, { display_order }]`

**Today** (route.ts:49): `orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } },
{ display_order: 'asc' }]` — deadline-primary, cross-project.

**Recommendation: order server-side by `(project_id, display_order)`.** Change the
`orderBy` to:
```ts
orderBy: [{ project_id: 'asc' }, { display_order: 'asc' }]
```
This keeps the client dumb: tasks arrive already grouped (all of a project's rows
are contiguous) and already in `display_order` within each project, so the
component only has to slice consecutive runs (or `Map`-by-`project.id`, which
preserves insertion order) — no client-side sort. Preferred over client-side
group+sort, which would duplicate ordering logic the DB does for free.

**Caveat — `display_order` meaningfulness cannot be verified from source.** The
schema default is `display_order Int @default(0)`
(`operations_project_tasks.display_order`), so if rows were never explicitly
ordered, an entire project's tasks could all be `0`, making the within-queue
order effectively insertion/id order rather than a meaningful sequence. **This
needs a DB query — note for Alex:**
```sql
SELECT project_id, COUNT(*) AS n, COUNT(DISTINCT display_order) AS distinct_order
FROM operations_project_tasks
WHERE user_id = '<user>' AND status IN ('open','in_progress','blocked')
GROUP BY project_id;
```
If `distinct_order` is 1 for projects with many tasks, `display_order` is
all-zero there and the PR should either accept id-order as the tiebreaker or add
a secondary `orderBy` (e.g. `created_at asc`). The ordering *mechanism* above is
correct regardless; this only affects whether the within-queue sequence looks
intentional.

---

## 3. Component structure + the grouping seam

`src/components/hub/UnscheduledTaskTable.tsx`:

- **Receives** `tasks: UnscheduledTask[]` (flat) + `onAssigned: () => void`
  (Props, lines 30-33).
- **Renders** one outer card (line 62: `border border-border rounded bg-white`),
  a header with the total count (lines 63-68), a column-header row (lines 77-84),
  then a **flat `tasks.map`** (lines 86-117). Each row shows title/status chips,
  project title, est. time/cost, COA, and an "assign/close" toggle
  (`setOpenId`, line 105) that conditionally renders `<AssignForm>` (lines
  113-115).
- **`openId` state** (line 59) tracks which single row's form is open — one open
  form at a time across the whole list.
- **`AssignForm`** (lines 124-248) holds ALL the assign logic and **MUST be
  preserved untouched**:
  - in-flight `saving` gate: `const [saving, setSaving] = useState(false)` (131),
    set true/false around the fetch (146, 175), and gating every submit button
    via `disabled={saving}` (219, 227, 239);
  - 409 conflict handling: `setConflictIds` on status 409 (162-165) and the
    "schedule anyway / pick another time" UI (210-233);
  - submit/POST to `/api/operations/tasks/${task.id}/assign` (149-160).

**The minimal seam (presentation-only):** the flat `tasks.map` at **line 86**
becomes group-by-project, then map-over-groups:

1. Derive groups once: `const groups = useMemo(() => …group tasks by
   t.project.id…, [tasks])` — preserving array order (which, per §2, is already
   `(project_id, display_order)`), yielding `{ projectId, projectTitle, tasks[]
   }[]`.
2. Keep the outer container (line 62) and overall heading (63-68, now "total
   across queues").
3. Replace the single `divide-y` block (75-118) with `groups.map(group => …)`,
   where each group renders **its own bounded card**: a project header (title +
   `group.tasks.length` count) and a `max-h-* overflow-y-auto` body (§5) that
   contains the **verbatim** existing column-header row (77-84) + per-row markup
   (87-116) including `<AssignForm task={t} … />` (113-115).

The per-row JSX, the `openId` toggle, `AssignForm`, the `saving` gate, and the
409 logic are all **reused as-is** — only their wrapping changes from one flat
list to N bounded lists. `openId` can stay a single top-level state (one open
form across all queues) with no change. **Do not reimplement assign.**

---

## 4. Page wiring — NO change needed

`src/app/hub/page.tsx`:

- **Render** (lines 442-445):
  ```tsx
  <UnscheduledTaskTable
    tasks={unscheduledTasks}
    onAssigned={() => { loadOperationsBlocks(); loadUnscheduledTasks(); }}
  />
  ```
- **Fetch** `loadUnscheduledTasks` (lines 245-258) → `GET
  /api/operations/tasks/unscheduled` → `setUnscheduledTasks(data.tasks || [])`;
  called once on mount (`useEffect`, line 189); state declared at line 150.
- **Refetch on assign**: `onAssigned` (line 444) re-runs `loadOperationsBlocks`
  + `loadUnscheduledTasks`, so a placed task leaves the pool.

The regroup is **entirely internal to `UnscheduledTaskTable`** — it consumes the
same `tasks` prop and the same `onAssigned` callback. **The page's fetch and
assign/refetch flow are untouched.** (The only file-level coupling is the
exported `UnscheduledTask` type; adding `display_order` to it per §1 is a type
widening the page passes through transparently — `unscheduledTasks` is typed
`UnscheduledTask[]` at line 150 and just forwards the API payload.)

---

## 5. Styling — reuse the existing bounded-scroll pattern

The codebase has one consistent bounded-scroll idiom: `max-h-* overflow-y-auto`
with a `sticky top-0 bg-white` header. Closest Operations-domain precedent:

`src/components/workbench/operations/SectionK_AuditTail.tsx:262-264`:
```tsx
<div className="text-xs font-mono max-h-96 overflow-y-auto">
  <table className="w-full">
    <thead className="sticky top-0 bg-white">
```
Same pattern is widespread: `BacktestPanel.tsx:238` (`max-h-[300px]
overflow-y-auto`), `ai/InspectionDrawer.tsx:72` (`max-h-96`),
`SectionB_NorthStar.tsx:652` (`max-h-48`), `dashboard/ExpenseSubAccountManager.tsx:181`
(`max-h-60`).

**For the eight queue cards:** wrap each queue's scroll body in `max-h-[
~300px ] overflow-y-auto` (pick a fixed height so a long project doesn't push the
next queue down), and make the per-queue column-header row `sticky top-0
bg-white` so it stays visible while scrolling. The queue card chrome should reuse
the component's existing Hub card classes — outer `border border-border rounded
bg-white` (UnscheduledTaskTable.tsx:62) and the `px-4 py-3 border-b border-border`
header (line 63) — so the queues match the current Hub visual language rather
than introducing a new style. Rows keep `divide-y divide-border-light` (line 75).

---

## Summary

| Item | Finding |
|------|---------|
| `project_id` to group on | **Present** — `project.id` (route.ts:47; type at component:27). Safe UUID key. |
| Project title for header | **Present** — `project.title` (route.ts:47). |
| `display_order` in payload | **MISSING** — used in `orderBy` (route.ts:49) but not `select`. Additive fix: add `display_order: true` to select + to the `UnscheduledTask` interface (component:19-28). No schema change. |
| Ordering approach | **Server-side** `orderBy: [{ project_id }, { display_order }]` (replace route.ts:49). Keeps client dumb. |
| `display_order` meaningful? | **Can't verify from source** (default 0). Needs a DB query — flagged for Alex; mechanism is correct regardless. |
| Component seam | Flat `tasks.map` (component:86) → group-by `project.id` (useMemo) → map groups, each a bounded card reusing the verbatim row markup + `<AssignForm>` (113-115). |
| Assign / `saving` gate / 409 | In `AssignForm` (124-248): `saving` (131), `disabled={saving}` (219/227/239), 409 handling (162-165, 210-233). **Preserve untouched — do not reimplement.** |
| Page fetch/refetch | **Untouched** — render (page:442-445), fetch (245-258), `onAssigned` refetch (444). Regroup is internal. |
| Bounded-scroll styling | Reuse `max-h-* overflow-y-auto` + `sticky top-0 bg-white` (SectionK_AuditTail:262-264); queue chrome reuses component's `border … rounded bg-white` card (62) + `px-4 py-3 border-b` header (63). |

No edits. Read-only audit only.
