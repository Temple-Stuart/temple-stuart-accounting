# OPS-CE-8E — Inline time commit on task rows

**Branch:** `claude/ops-ce-8e` (off `main`; CE-8D merged)
**Date:** 2026-06-03
**One concept:** first-commit a task's time inline on its day-map / timeline row,
without leaving the Content page — **reusing the existing Daily Plan block route**.
**0-schema; zero new write paths.**

> ✅ `git diff` = new `TaskTimeCommit.tsx` + the two row renders (`ScenifyDraft.tsx`,
> `DailyLog.tsx`). No `prisma/schema.prisma`, no `api/`. tsc exit 0; eslint exit 0.

---

## Audit — the reused route (cited)
`POST /api/operations/daily-plan/items/[itemId]/blocks`
(`daily-plan/items/[itemId]/blocks/route.ts:36-115`):
- auth: `getVerifiedEmail` → user → `loadAuthorizedDailyPlanItem(itemId, user.id)`
  (defensive 404 — **ownership unchanged**); `entity_id`/`user_id` derived server-side
  from the item.
- payload: **`{ scheduled_start, scheduled_end }`** required as ISO datetimes
  (`:58-71`), `end > start` (`:72-77`); optional `status`, `notes`, **`allow_conflicts`**
  (`:95`). Overlap → **409** with `conflicting_block_ids` unless `allow_conflicts:true`.
- creates the `operations_calendar_blocks` row (`:105-115`).

**This is exactly what the Daily Plan tab posts** — `DailyPlanItemRow.tsx:135-141`:
`{ scheduled_start: startDate.toISOString(), scheduled_end: endDate.toISOString() }`
(+ `allow_conflicts` on the 409 retry, `:139/151`). **Reuse is clean — 0-schema,
no new write path.** (Confirmed: a block-less planned item is a real
`daily_plan_item` the user owns, so the route accepts it directly.)

## Build — `TaskTimeCommit` (shared, no drift)
A small inline form rendered on every **block-less ("planned · no time yet")** task
row, in **both** S2 (`ScenifyDraft`) and S3 (`DailyLog`):
- the day's date is fixed (the row's day), so it uses two compact `<input type="time">`
  (start default 09:00, end 10:00) and composes ISO via `new Date(\`${date}T${HH:MM}\`)`
  → `.toISOString()` — the **same instants** the Daily Plan form produces.
- **"commit time"** POSTs the identical payload to the cited route. On **409** it
  surfaces "Overlaps another block." + a **"schedule anyway"** button that resubmits
  with `allow_conflicts: true` (mirroring Daily Plan).
- **On success it dispatches `CONTENT_DAY_PLAN_CHANGED_EVENT`** (the CE-8D event) —
  `ScenifyDraft` (`loadDay`) and `DailyLog` (`loadBlocks`) re-read the day's items, the
  item now has a `calendar_block` → it renders as a **timed** row and **re-sorts into
  its clock position** via the CE-8B `compareDayOrder`. The planned form unmounts.

Both row renders pass `itemId` (the `daily_plan_item.id`, newly carried on the planned
row) + `date` to `<TaskTimeCommit>`. **Rows that already have blocks are unchanged**
(times still editable only on Daily Plan — one concept: first-commit inline).

Contrast standard kept (brand-purple labels; white inputs `border-brand-purple/40` +
focus ring `brand-purple/20`).

## Verify
- **add task → set time inline → row jumps to its slot:** commit → 201 → event →
  S2/S3 re-read → the item is now timed → `compareDayOrder` places it at its clock
  position in both surfaces. ✅
- **Conflict path:** 409 → "schedule anyway" → resubmit `allow_conflicts` → committed
  (mirrors Daily Plan). ✅
- **Auth unchanged; reuse clean:** same route, same payload, server-derived entity. ✅
- **Already-timed rows untouched.** ✅
- **0-schema, zero new write paths;** **tsc** exit 0; **eslint** exit 0.

## git diff scope
New: `content/TaskTimeCommit.tsx`. Modified: `content/ScenifyDraft.tsx` (carry
`itemId`, render the form on planned rows), `content/DailyLog.tsx` (same) (+ this
report). No schema, no routes, no other file.

---

## Result
Every "planned · no time yet" task row in the S2 day map and the S3 timeline now
carries an inline **start / end + "commit time"** form that posts to the **same**
Daily Plan block route (`/items/[itemId]/blocks`, ISO start/end, 409→schedule-anyway).
On commit the task re-reads and **re-sorts into its clock position** in both surfaces
immediately. Set the time where you build the day — no tab-switch. 0-schema, zero new
write paths; tsc + eslint clean.
