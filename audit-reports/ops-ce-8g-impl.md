# OPS-CE-8G — Task lifecycle on the Content page (edit / uncommit / mark done)

**Branch:** `claude/ops-ce-8g` (off `main`; CE-8F merged)
**Date:** 2026-06-03
**One concept:** edit a committed time, uncommit a mistaken block, and mark done
(actuals + block completed + task completed) — inline, on the shared `TaskBand`.
**All reuse existing routes; 0-schema; auth unchanged; flat law (inline confirms).**

> ✅ `git diff` = `TaskBand.tsx` (the lifecycle, shared — no S2/S3 drift), the two
> row-data builders (`ScenifyDraft`, `DailyLog`), and a ContentPipeline S1-refresh
> listener. No `prisma/schema.prisma`, no `api/`. tsc exit 0; eslint exit 0.

---

## Audit — routes (all exist, cited; no STOP)

| Action | Route (existing) | Notes |
|---|---|---|
| **Edit time** | `PATCH /api/operations/daily-plan/blocks/[blockId]` (`blocks/[blockId]/route.ts:38`) | `{ scheduled_start, scheduled_end }`; re-checks overlap (excl. self) → **409** unless `allow_conflicts` (`:99-106`). |
| **Uncommit** | `DELETE /api/operations/daily-plan/blocks/[blockId]` (`:191`) | hard-deletes the block → item returns to block-less ("planned"). |
| **Mark done — block** | `PATCH /api/operations/daily-plan/blocks/[blockId]` | accepts `actual_start`/`actual_end` (`:111-139`) + `status:'completed'` (`:141-149`). |
| **Mark done — task** | `PATCH /api/operations/projects/[id]/tasks/[taskId]` (`tasks/[taskId]/route.ts:79`) | `{ status:'completed' }` → in a `$transaction` writes `operations_task_status_history` (`recordTaskStatusChange`, `:335-345`) + `completed_at = NOW()` (`:299-300`) + `operations_project_task_completed` audit (`:356-358`). |

**Done-flow mirroring (truth-first):** Daily Plan's `DailyPlanItemRow` does **not**
itself complete the *task* from a block (its only PATCH targets the *item*'s
notes/order; block status is the calendar side). The canonical **task** completion is
the project-task PATCH above (the Projects-tab flow: status history + completed_at +
audit). CE-8G **mirrors that exactly** — `{ status:'completed' }` — never reimplements
it. **commit ≠ completion:** committing a time only creates a `scheduled` block; DONE
is a separate explicit action that sets actuals + completes both block and task.

## Build (shared `TaskBand`, S2 + S3)
The lifecycle lives entirely in `TaskBand` (one component → no drift). Modes:
- **planned (no block)** → the CE-8E inline commit form (`TaskTimeCommit`).
- **committed, not done** → TIME label + **[edit time] · [uncommit] · [✓ mark done]**:
  - *edit time* — inline start/end (prefilled from scheduled) → block PATCH
    `scheduled_*`; **409 → "schedule anyway"** (allow_conflicts), mirroring commit.
  - *uncommit* — inline confirm ("Remove the time? Returns to planned.") → block
    DELETE (no modal — flat law).
  - *mark done* — inline **actuals** (prefilled from scheduled, editable) → block
    PATCH `{ actual_*, status:'completed' }` **then** (if the row has a task) task
    PATCH `{ status:'completed' }`.
- **done (block completed)** → permanent **"✓ DONE · {actual times}"** + a purple
  status pill; **no actions** (the provable completed record stays in the day map +
  the record forever).

Ad-hoc items (no `task`) complete only the block (no task PATCH). Every mutation
dispatches **`CONTENT_DAY_PLAN_CHANGED_EVENT`**. The two callers only **extend the
row data** they pass to `TaskBand` (blockId, taskId, projectId, scheduled ISO,
status, planned) — no logic duplicated.

## To-do pool (S1) — verdict: already excludes completed (cited)
`GET /api/operations/tasks/unscheduled` (`tasks/unscheduled/route.ts`) filters
`status: { in: ['open','in_progress','blocked'] }` **and**
`daily_plan_items: { none: { calendar_blocks: { some: {} } } }`. So a task **drops
out of S1 automatically** once it is **completed** (status filter) *or* has a
committed block (the unscheduled predicate). **No read-fix needed.** To make it
instant, `ContentPipeline` now listens to `CONTENT_DAY_PLAN_CHANGED_EVENT` and
re-runs `load` (the `/unscheduled` fetch) + day pre-marks + counts — so a done/
committed task leaves the to-do list in one click. S2/S3 already listen (CE-8D) and
re-read → the row flips to ✓ / re-sorts immediately.

## Verify
- **Edit** → block PATCH `scheduled_*` (409 → schedule-anyway) → event → re-sort. ✅
- **Uncommit** → block DELETE → event → row returns to planned (commit form). ✅
- **Mark done** → actuals + block `completed`, then task `completed` via the existing
  status flow (history + completed_at + audit) → event → row shows ✓ DONE; task
  leaves S1; stays in the map/record. ✅
- **commit ≠ completion** — committing never sets status completed (CE-8E unchanged). ✅
- **Reuse-only / no STOP** — every route pre-existing; auth unchanged. **0-schema.** ✅
- **Flat law** — inline confirms, no modal. **Contrast standard** — purple labels,
  white inputs `border-brand-purple/40` + focus ring `brand-purple/20`. ✅
- **tsc** exit 0; **eslint** exit 0.

## git diff scope
`content/TaskBand.tsx` (lifecycle), `content/ScenifyDraft.tsx` +
`content/DailyLog.tsx` (row-data: blockId/taskId/projectId/scheduled ISO),
`content/ContentPipeline.tsx` (S1 refresh on the day-plan event) (+ this report). No
schema, no routes.

---

## Result
Task rows in the S2 map and S3 timeline now carry the full lifecycle inline:
**edit** a committed time (409→schedule-anyway), **uncommit** a mistaken block back to
planned, and **mark done** — which logs actuals, completes the block, and completes
the task through the **existing** status flow (status history + `completed_at` +
audit). A done task drops from the S1 to-do pool (`/unscheduled` already excludes
completed) and remains in the day map/record as the permanent ✓ — all in one click via
`CONTENT_DAY_PLAN_CHANGED_EVENT`. Reuse-only, 0-schema, flat, contrast-clean; tsc +
eslint pass.
