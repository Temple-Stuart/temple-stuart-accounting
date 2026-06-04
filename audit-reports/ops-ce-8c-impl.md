# OPS-CE-8C — Assigned-but-untimed tasks visible in the S3 timeline

**Branch:** `claude/ops-ce-8c` (off `main`; CE-8B merged)
**Date:** 2026-06-03
**One concept:** show tasks added to the day *before* a time is committed, as untimed
"planned" rows in the S3 answer timeline. **Read-only; 0-schema; zero write-path
changes; diff = DailyLog only.**

> ✅ `git diff` = `DailyLog.tsx`. No `prisma/schema.prisma`, no `api/`. tsc exit 0;
> eslint exit 0.

---

## Problem (cited)
`DailyLog` built its task rows by iterating **`item.calendar_blocks`** only
(`DailyLog.tsx:200-216`, pre-change): one row per BLOCK. A task added via "+ add to
day" (CE-8) creates a `daily_plan_items` row with **no block yet** → it produced zero
rows → **invisible in S3**. Alex adds a task and it appears to vanish (it's on the
Daily Plan tab, but the Content page is where he works).

## The GET already returns block-less items (cited — no API change)
`GET /api/operations/daily-plan/items` (`daily-plan/items/route.ts:90-108`) returns
**every** plan item for the date with its `calendar_blocks` array (and `task` /
`ad_hoc_title`). Items with no committed time come back with
`calendar_blocks: []` — already in the payload, just ignored by the old loop. So this
is a pure render change.

## Fix (DailyLog only)
`taskBlocks` now emits, per plan item:
- **with blocks →** one **timed** row per block (exactly as before:
  actual-or-scheduled clock label, `minute` from `minuteOfDayFromInstant`).
- **with NO blocks →** one **untimed "planned"** row: `minute: null`, status
  `planned`, label **"planned · no time committed — set times on Daily Plan"**, id
  `item-${item.id}`, and `order = UNTIMED_TASK_ORDER_BASE (100000) + plannedIndex`.

The timeline's `task` rows are now `minute: number | null` and map `order: b.order`.
They flow through the **CE-8B shared `compareDayOrder`** unchanged: untimed rows sink
after all timed rows; the large `order` base places planned tasks **after the untimed
scenes** (whose `order` = small step_order), and orders planned tasks among themselves
**in plan order** (the GET's `display_order`). `renderTaskRow` shows the same amber
band; the planned label renders as muted prose (not a bold clock) — one truthful row,
same style.

## Before → after (proved via the comparator)
Replaying `compareDayOrder` on a day with a planned (block-less) task:
```
07:00 pages (scene)          ← timed
09:30 task block             ← timed
00:00 Sleep (scene)          ← timed, wrapped to day-end (CE-8B)
UNTIMED scene step2          ← untimed scene, by step_order
PLANNED task A (no time)     ← planned task, after untimed scenes, in plan order
PLANNED task B (no time)
```
- **Before:** a just-added task with no block → **no row** (invisible).
- **After:** it appears immediately as a "planned · no time committed" amber row at
  day-end; committing a block on the Daily Plan tab gives it `calendar_blocks`, so it
  re-renders at its **clock position** (timed branch). Timed behavior unchanged.

## Verify
- **"+ add to day" → visible immediately:** block-less items now produce an untimed
  planned row (the GET already returns them). ✅
- **Commit a block → moves to clock position:** the item then has
  `calendar_blocks` → the timed branch renders it at its time. ✅
- **Timed/scene behavior unchanged;** untimed scenes still precede planned tasks
  (proof above). ✅
- **0-schema, zero write-path changes:** no schema, no `api/`; reads the existing
  GET; diff is DailyLog only. ✅
- **tsc** exit 0; **eslint** exit 0.

## git diff scope
`src/components/workbench/operations/content/DailyLog.tsx` (+ this report). No schema,
no routes, no other file.

---

## Result
A task assigned to the day now shows in the S3 timeline the instant it's added — an
untimed "planned · no time committed — set times on Daily Plan" amber row that sinks
to day-end after the untimed scenes (in plan order) via the CE-8B comparator. Commit a
time on Daily Plan and it snaps to its clock position. Read-only, 0-schema, DailyLog
only; tsc + eslint clean.
