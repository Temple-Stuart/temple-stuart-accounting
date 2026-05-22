# PR-OPS-HUB-3 — Collapsible per-project queues

Small, purely client-side change to `src/components/hub/UnscheduledTaskTable.tsx`
on top of Hub-2's per-project queues (now on `main`). Collapse state is ephemeral
UI: no endpoint, no schema, no `page.tsx` change. Built off `main` (Hub-2 queues
confirmed present — the `project.id` grouping `useMemo` is on main).

---

## Re-read of current main (post-Hub-2), cited

Before editing, the component on main was confirmed:
- Grouping `useMemo` keyed on `t.project.id` (lines 81-92).
- Single shared `openId` state (line 74).
- Per-queue bounded card: `max-h-[300px] overflow-y-auto` body (line 112) with a
  `sticky top-0 bg-white z-10` header holding **title + count** (lines 115-119)
  and the column legend (lines 120-126); row map at lines 129-161; `AssignForm`
  rendered at lines 156-158.
- `AssignForm` function at lines 170+ (`saving` gate, 409 handling).

The collapse seam: the title+count header (115-119) becomes a toggle; the
scroller body (112 + legend + rows) renders only when expanded.

---

## 1. Collapse state shape + all-collapsed-by-default

Implemented as the **inverse of a collapsed set — a `Set<string>` of EXPANDED
project ids** (component, after the `queues` useMemo):

```ts
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
```

**Why the inverse:** an empty set means *all collapsed*, which is simultaneously
(a) the load default, and (b) makes any newly-appearing project collapsed for
free — an id the user never expanded is simply absent, so it renders collapsed
with **no seeding from the first grouping, no reset on `tasks` change, and no
first-paint flash**. (A literal "collapsed set" seeded from the first grouping
would either flash all-expanded for one frame on the first async data arrival, or
need an effect that re-adds new ids every refetch — the exact reset hazard the
brief flagged.) Behaviorally identical to a collapsed set; strictly safer to keep
correct. Ephemeral only — `useState`, never written to `localStorage` or any
storage; resets on reload, as intended.

A queue is rendered expanded iff `expandedIds.has(queue.projectId)`
(`const isExpanded = expandedIds.has(queue.projectId)` at the top of the
`queues.map`).

---

## 2. Header toggle + chevron, cited

The always-visible header is a `<button>` that toggles the project's id and shows
title + count in **both** states (folding hides only the rows):

```tsx
<button type="button" onClick={() => toggleQueue(queue.projectId)}
  aria-expanded={isExpanded}
  className="w-full px-4 py-2 border-b border-border flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-bg-row/50">
  <span className="flex items-center gap-2 min-w-0">
    <span className="text-text-faint shrink-0" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
    <h4 className="text-xs font-mono font-bold text-text-primary truncate">{queue.projectTitle}</h4>
  </span>
  <span className="text-xs font-mono text-text-muted shrink-0">{queue.tasks.length}</span>
</button>
```

Chevron `▾` expanded / `▸` collapsed at the left, `cursor-pointer`, and
`aria-expanded` for accessibility. The toggle:

```ts
const toggleQueue = (projectId: string) =>
  setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    return next;
  });
```

No global collapse-all / expand-all control — per-header only.

---

## 3. Conditional body render, cited

When collapsed, **only the header bar renders** — the scroller, column legend,
rows, and AssignForm region are skipped entirely:

```tsx
{isExpanded && (
  <div className="max-h-[300px] overflow-y-auto">
    <div className="hidden md:grid … sticky top-0 bg-white z-10">…column legend…</div>
    <div className="divide-y divide-border-light">
      {queue.tasks.map((t) => ( …verbatim row + {openId === t.id && <AssignForm …/>}… ))}
    </div>
  </div>
)}
```

The row markup and the `<AssignForm task={t} onDone={…}/>` call are the **verbatim
Hub-2 body**, only nested one level deeper inside the `isExpanded` guard. The
title+count header moved *out* of the scroller to become the always-visible
toggle, so the column legend (which only makes sense with rows) now carries the
`sticky top-0 bg-white z-10` itself and renders only when expanded.

---

## 4. THE REFETCH RULE — how collapse persists, new/removed ids

- **Persistence across assign-refetch:** `expandedIds` is component state and is
  **never reset on `tasks` change**. Collapse keys on the stable `project.id`, so
  after an assign triggers a pool refetch, a queue the user expanded still has its
  id in `expandedIds` → it **stays expanded**; a collapsed queue (absent id)
  **stays collapsed** and never pops open. The grouping `useMemo` rebuilds
  `queues` from new `tasks`, but the expanded set is untouched by that.
- **Newly-appearing project ids** (a project that had 0 unscheduled tasks now has
  some): its id is absent from `expandedIds` → it renders **collapsed**,
  consistent with the load default. No add/seed needed.
- **Removed project ids** (all of a project's tasks got scheduled): pruned by a
  small effect so a project that later reappears starts collapsed again:
  ```ts
  useEffect(() => {
    setExpandedIds((prev) => {
      const live = new Set(queues.map((q) => q.projectId));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) { if (live.has(id)) next.add(id); else changed = true; }
      return changed ? next : prev;
    });
  }, [queues]);
  ```
  This **only removes ids no longer present** — it never adds ids and never
  alters a live project's expanded/collapsed state, so it does not reset user
  toggles (it returns the previous set unchanged when nothing was pruned, avoiding
  a needless re-render). Net effect: expanded state survives refetch for live
  projects; new and reappearing projects start collapsed.

---

## 5. openId-on-collapse

Collapsing a queue that owns the open assign form simply **hides** it with the
body (the `{openId === t.id && <AssignForm/>}` node is inside the `isExpanded`
guard, so it isn't in the tree when collapsed). **`openId` is NOT cleared on
collapse** — this keeps the existing `openId` behavior untouched (the brief
forbids touching it). Consequence: re-expanding that queue restores the open form
as it was. Acceptable per the brief.

---

## 6. Untouched confirmations

`git status` shows **only** `src/components/hub/UnscheduledTaskTable.tsx` changed.
Within it, `git diff` shows **zero** added/removed lines touching `setSaving`,
`conflictIds`, `allow_conflicts`, the `409` branch, or the `submit` signature — so
**`AssignForm`, the `saving` gate, and the 409 handling are byte-unchanged**. The
grouping `useMemo` logic is unchanged (only consumed). The `openId` declaration
and toggle semantics are unchanged. **The endpoint and `src/app/hub/page.tsx` are
not touched** (no other files in the diff). No fallback logic, no schema, no
migration.

---

## 7. Verification

- **`tsc --noEmit`:** ✓ exit 0, no type errors.
- **`next build`:** compilation + type-checking passed — the build progressed
  to "Collecting page data …" (which runs *after* both `Compiled successfully`
  and "Checking validity of types"), then errored only on the **unrelated** route
  `/api/admin/backfill-transaction-fields` (`PLAID_CLIENT_ID and PLAID_SECRET must
  be set` at module load). Same sandbox-env limit as Hub-1/Hub-2/DPI-Unique (the
  `build` script also chains `prisma migrate deploy`, needing an unreachable
  `DATABASE_URL`). Not produced by this change; the edited component compiled.
