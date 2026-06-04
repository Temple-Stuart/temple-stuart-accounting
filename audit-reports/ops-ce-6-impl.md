# OPS-CE-6 — Unified day timeline (committed task blocks interleaved between scenes)

**Branch:** `claude/ops-ce-6` (off `main`; CE-4-flat merged)
**Date:** 2026-06-03
**One concept:** the Daily Log becomes one flat, time-ordered timeline — mindset
**SCENE rows** (questions/answers) interleaved with **TASK rows** (the committed
project-task blocks, read-only execution proof). Per `audit-reports/ops-content-
engine-audit.md` (Aspect 2: `daily_plan_items → calendar_blocks` already works).
Also fixes the default-day timezone bug.

> ✅ **0-schema, zero new write paths, no AI.** Task rows are READ-ONLY (committing
> blocks stays on the Daily Plan tab). Reads add `/daily-plan/items` +
> `/operations/projects`; writes still only the existing
> `/content/grid/cell` + `/content/grid/piece`.

**DESIGN LAW:** everything on the surface — the timeline is one flat table, no
drawer/modal/expander/collapse anywhere in the diff.

---

## STEP 1 — Audit (cited)

### Calendar models (the execution record)
- `operations_daily_plan_items` (`prisma/schema.prisma:2714-2736`): `plan_date Date`,
  `task_id?`, `ad_hoc_title?`, `entity_id`; relations `task` + `calendar_blocks`.
- `operations_calendar_blocks` (`:2738-2758`): `scheduled_start`/`scheduled_end`,
  **`actual_start`/`actual_end`** (the logged proof), `status`
  (`CalendarBlockStatus`: scheduled/in_progress/completed/missed/cancelled).
- `operations_project_tasks` (`:2672-2706`): `title` (`:2677`), `project_id`
  (`:2674`), `status` (`:2679`).

### The read route (reused as-is)
`GET /api/operations/daily-plan/items?from=&to=` (`daily-plan/items/route.ts:90-108`)
returns items for a `plan_date` range, **including** `calendar_blocks` (ordered by
`scheduled_start`) and `task: { select: { id, project_id, title, status, … } }`
(`:92-105`). The `select` carries `project_id` but **not the project name** → I fetch
`GET /api/operations/projects` (`projects/route.ts:40-91`, returns `{id, title}`) and
build an id→name map client-side. Both are **reads** — no route added/changed.

### DailyLog current (CE-4-flat) + the time-sort field
- DailyLog renders active scenes as a flat answer table for a picked day; day
  selection defaulted via `new Date().toISOString().slice(0,10)` (the UTC bug).
- Scene time: `operations_routine_steps.time_of_day` (`@db.Time`, returned on the
  grid scene's `routine_step.time_of_day`) — serialized `…T07:30:00Z`; parsed to
  minutes for sorting.

### Fallback ordering (defined)
- **Timed rows** sort by **minute-of-day**: task blocks use `actual_start ??
  scheduled_start` (local wall-clock minute); scenes use `time_of_day`'s minute.
- **Untimed scenes** (no `time_of_day`) sink to the **end by `step_order`** — no
  fabricated times (truth-first). Blocks always have times.

### 0-schema + zero new write paths — confirmed (no STOP)
The timeline reads existing endpoints; the only writes (answer, start-day) reuse the
existing cell/piece routes. Nothing to migrate or add server-side.

---

## STEP 2 — The interleaved timeline

DailyLog, same flat `<table>`, now renders a **merged, time-sorted** list of two row
kinds for the selected day:

- **SCENE rows (unchanged):** `# · activity(+time) · question · b-roll · inline
  answer` with per-row Save + visible state. Behavior identical to CE-4-flat
  (extracted into `renderSceneRow`, same handlers/payload).
- **TASK rows (new, read-only band):** a `colSpan={5}` row, **visually distinct**
  (`border-l-4 border-l-amber-400 bg-amber-50/50` — the amber accent already in the
  palette via ScenifyModal's "proposed new" badge): `▦  {time label} · {task title}
  · {project} · {STATUS}`. The **time label** is `actual_start–actual_end (actual)`
  when logged, else `scheduled_start–scheduled_end (scheduled)` — explicitly labeled
  which. One row **per calendar block** (a block = a committed time). No edit
  affordances.
- **Merge-sort** by minute-of-day; untimed scenes last by `step_order`; on a tie a
  scene sorts before a task.
- **Truthful empty state:** when the day has scenes (piece started) but **no
  committed blocks**, a quiet inline row: *"no task blocks committed — assign tasks
  on the Daily Plan tab"* (visible, not hidden).
- **`n of m answered`** counts **scenes only** (`answeredCount` over `dayScenes`) —
  tasks aren't answerable.

### Default-day timezone fix
`todayLocal()` computes `YYYY-MM-DD` from `getFullYear/getMonth/getDate` (local),
replacing `toISOString().slice(0,10)` (which flips to UTC and can show the wrong
day). The date `<input>` now defaults to the user's **local** today.

---

## STEP 3 — Verify (cited)

- **Interleave at correct positions with real times:** `timeline` merges
  `dayScenes` (minute from `time_of_day`) + `taskBlocks` (minute from
  `actual_start ?? scheduled_start`) and sorts ascending; task bands render between
  scenes by clock time, labeled actual/scheduled. ✅
- **Scenes still answer inline:** `renderSceneRow` keeps the always-present textarea
  + Save + `✓ saved`/error; saves via the unchanged `/content/grid/cell` upsert
  (same `{scene_id, piece_id, script}` payload). ✅
- **Empty-task day:** the truthful inline row renders when `taskBlocks.length === 0`. ✅
- **Local today default:** `todayLocal()` (no `toISOString`). ✅
- **Flat law:** no drawer/modal/expander/collapse in the diff — one `<table>`, all
  rows always visible (the only `collapse` is the `border-collapse` CSS class). ✅
- **0-schema, zero new/changed write routes:** `git diff` = `DailyLog.tsx` only; no
  `prisma/schema.prisma`, no `api/`. Auth unchanged (all reads/writes are existing
  user-scoped routes). ✅
- **Read-only task rows:** the band has no inputs/buttons; committing/editing blocks
  remains on the Daily Plan tab. ✅
- **No AI:** no `recordUsage`/AI in the diff (CE-5). ✅
- **tsc:** `npx tsc --noEmit` → **exit 0** (DailyLog clean).
- **eslint:** `npx eslint DailyLog.tsx` → **exit 0**.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Task rows READ-ONLY this PR | ✅ colSpan band, no inputs; committing stays on Daily Plan |
| No AI (CE-5 next) | ✅ none in diff |
| 0-schema | ✅ no schema change |
| Zero new write paths | ✅ reuses cell + piece routes; new calls are reads |
| Flat law (everything on the surface) | ✅ one flat table, no hidden UI |
| Existing palette; tables match grid family | ✅ `border-collapse text-xs font-mono`, `bg-bg-row` purple headers, amber accent (already in palette) |
| tsc + lint clean | ✅ both exit 0 |

---

## Scope notes (flagged)
- **Timeline is piece-gated:** the interleaved table renders once a content piece
  exists for the day (scenes need it to be answerable); before that the "Start
  {date} log" button shows. Committed task blocks therefore appear after the day is
  started — one click. (Showing blocks pre-start would need a second surface;
  deferred to keep one concept.)
- **Pre-existing legacy drawer** (`SectionG_Content`/`ScriptDrawer`) is untouched
  here and still flagged from CE-4-flat for retirement — not in this diff.

## git diff scope
`src/components/workbench/operations/content/DailyLog.tsx` (+ this report). No
schema, no routes, no other component.

---

## Result
The Daily Log is now one flat day timeline: mindset **scene rows** (answerable
inline) and **committed task blocks** (read-only amber execution bands showing
actual-or-scheduled time, task, project, and status) interleaved by clock time, with
untimed scenes ordered by step at the end. An honest "no task blocks committed" line
covers the empty case, and the date picker now defaults to **local** today. The
execution record CE-5 will script from is now visible beside the answers — **0-schema,
zero new write paths, read-only tasks, no AI, flat law intact**; tsc + eslint exit 0.
