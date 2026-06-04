# OPS-CE-7C — Fix CE-7B regression: draft step fetch + cross-entity tasks list

**Branch:** `claude/ops-ce-7c` (off `main`; CE-7B merged)
**Date:** 2026-06-03
**One concept:** restore section 2 (Scenify draft) + the project-tasks list after
the CE-7B entity unification broke them on Alex's cross-entity day.
**0-schema, no new write paths, minimal diff** (1 file, +26/−12).

> ✅ `git diff` = `ContentPipeline.tsx` only. No `prisma/schema.prisma`, no `api/`.
> tsc exit 0; eslint exit 0.

---

## Diagnosis (root cause — cited)

CE-7B added a **forced concrete-entity default** to the pipeline
(`ContentPipeline.tsx`, CE-7B commit `b6179cca`):
```
useEffect(() => {
  if (!selectedEntityId && entities.length > 0) setSelectedEntityId(default ?? first);
}, [selectedEntityId, entities, setSelectedEntityId]);
```
Before CE-7B, `selectedEntityId` was often `null` ("All") and the **SOURCES were
unfiltered**, so both lists showed everything. CE-7B forced a single concrete entity
(e.g. *Personal Finances*) — and that scope was wired into **both source lists**:

1. **Tasks list (symptom 2 — confirmed):** `visibleTasks` filtered by entity
   (CE-7B `ContentPipeline.tsx`): `tasks.filter((t) => !t.project ||
   entityScope(t.project.entity_id))`. With the entity forced to *Personal*, every
   **Business**-entity task was hidden → "No unscheduled tasks", even though the
   `/api/operations/tasks/unscheduled` GET returns them all (it has **no** entity
   param — `tasks/unscheduled/route.ts:32`). Alex's day is **cross-entity**, so a
   single-entity scope on the reference list hides his work.

2. **Scenify draft (symptom 1):** the `load` callback fetched routines **entity-scoped**
   — `fetch(\`/api/operations/routines${qs}\`)` with `qs = ?entity_id=…`, and its deps
   were `[selectedEntityId, loadCounts]`. So the entity-default effect (null→concrete)
   **re-ran `load`**, which `setRoutines(new array)` → `selectedRoutines`
   (`useMemo([selected, routines])`) churned to a new reference, and `visibleRoutines`
   was also entity-filtered. The draft's inputs were unstable and could be emptied
   (any selection/entity mismatch drops the routine from `selectedRoutines` →
   "0 routines · 0 scenes · no steps"); the per-routine step GET in `ScenifyDraft`
   (`/api/operations/routines/${r.id}`) had **no recovery** because its load only
   re-runs when the selected id-**set** changes (`key`), so a transient
   "Failed to fetch" stuck. The fetch URL itself was never the bug — its **inputs**
   were destabilized by entity-scoping the sources.

**Conclusion:** CE-7B correctly unified entity for the OUTPUT side (grid, daily log,
piece creation), but wrongly applied that scope to the INPUT side (the routine +
task source menus). The fix is to **decouple the sources from the entity scope**.

---

## Fix (minimal)

In `ContentPipeline.tsx`:

1. **Sources load once, cross-entity, independent of the selector.** `load` now
   fetches `/api/operations/routines` (no `entity_id`) + `/tasks/unscheduled`, with
   deps `[]` — it no longer re-runs on entity change, so `routines`/`selectedRoutines`
   are **stable** and the draft's inputs stop churning.
2. **Counts stay entity-scoped, separately.** A dedicated
   `useEffect(() => void loadCounts(), [loadCounts])` refetches the grid
   scene/answered counts when the selector changes (the header counts remain
   entity-accurate). `load` no longer calls `loadCounts`.
3. **Sources show everything.** `visibleRoutines = routines`, `visibleTasks = tasks`
   — no entity filter; the menus never hide his routines or tasks.
4. **Entity labels** added to each routine + task row (via an `entityNameById` map
   from the context `entities`), so the cross-entity menu is legible at a glance.

The **entity selector still scopes the output side**: `PieceGrid` + `DailyLog` read
`selectedEntityId` from context; piece creation uses it; the header
scene/answered counts use `entityScope`. Draft saves derive `entity_id` **server-side
from the step** (`/content/scene-rows`), so scenifying any routine works regardless of
the selected entity.

---

## ⚠️ Cross-entity day — design flag (for CE-8 restructure)

Alex's day is **inherently cross-entity**: personal routines (the mindset scenes) +
business tasks (the execution record) belong to one reel. CE-7B's "one entity scopes
everything" model fights that. This PR restores the sources as cross-entity but leaves
a real seam for the upcoming restructure:
- **Sources** (what's available to film/do) = cross-entity — fixed here.
- **Output** (grid/day-log/piece) = currently single-entity-scoped. A personal
  routine scenified while the selector is on *Business* creates personal-entity
  scene-rows that then only appear when the selector is *Personal*.
- **Recommendation (CE-8):** make the confirmed grid + day timeline **cross-entity for
  a day** (a reel spans entities), or pin the piece to the day rather than one entity,
  so the unified timeline (CE-6) shows personal scenes + business task blocks together
  without an entity toggle hiding half the day.

---

## Verify
- **Draft:** `routines`/`selectedRoutines` are now stable (load runs once); selecting
  a routine resolves it from the full list → `ScenifyDraft` gets a valid `{id,name}`
  → its step GET (`/api/operations/routines/${r.id}`) loads → AI suggest
  (`/content/enrich-routine`) + save (`/content/scene-rows`) unchanged, work end to
  end. ✅
- **Tasks:** `visibleTasks = tasks` → all open unscheduled tasks across entities show
  again, each labeled with its entity. ✅
- **Entity selector still scopes** grid + daily log + piece creation + header counts
  (counts via the separate `loadCounts` effect). ✅
- **0-schema; no new/changed write routes** (reads only changed which params they
  send; no `api/` in diff). Auth unchanged. ✅
- **tsc:** exit 0. **eslint:** exit 0. **Diff:** 1 file, +26/−12.

## git diff scope
`src/components/workbench/operations/content/ContentPipeline.tsx` (+ this report).
No schema, no routes, no other component.

---

## Result
The CE-7B regression is fixed by decoupling the **source menus from the entity
selector**: routines + tasks now load once and show **cross-entity** (labeled), so
the Scenify draft gets stable, complete inputs (steps load, AI suggest + save work)
and the project-tasks list shows Alex's open work again. The entity selector keeps
scoping the **output** side (grid, day log, piece, counts). The cross-entity-day
tension is flagged for the CE-8 restructure. 0-schema, minimal diff; tsc + eslint
exit 0.
