# Audit — Day-List Calendar: Existing Day-Feed Reuse Map

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Branch:** `claude/audit-day-list-calendar`
**Goal:** A day-list calendar above section "0 · CREATE" on Operations › Content — day nav,
stacked time blocks in clock order, entity+source filters, gaps + collisions. **HARD
CONSTRAINT:** a PRESENTATION layer over the EXISTING merged day feed (the interleaved
routine-scenes + task-blocks that "3 · ANSWER + RECORD" renders; CE-8B, DAY_START=04:00).
**No new fetcher, no new tables.**

Every claim cites `file:line` / `schema:line`. Each finding tagged **EXISTS / MISSING /
REUSABLE**.

---

## 1 · The existing day feed

### Where it's assembled — **client-side, INLINED in `DailyLog.tsx`** (not an endpoint, not a shared fn)
The merged day is built inside the `DailyLog` component (rendered by section 3). **EXISTS /
REUSABLE-with-extraction.**

**Fetches** (three, client-side):
- `GET /api/operations/content/grid` → `{ scenes, pieces, cells }` (`DailyLog.tsx:119-127`;
  server `content/grid/route.ts:48-76`). Scenes filtered to active steps
  (`grid/route.ts:53`). **Cross-entity** (no `entity_id` param sent — `DailyLog.tsx:120`).
- `GET /api/operations/projects` → project names map (`DailyLog.tsx:121, 128-133`).
- `GET /api/operations/daily-plan/items?from=<date>&to=<date>` → `{ items }` with
  `calendar_blocks` + `task` (`DailyLog.tsx:142-150`; server `daily-plan/items/route.ts:90-107`,
  full item row via `include` so `entity_id` is present).

**Merge / sort** (all inlined useMemos in `DailyLog.tsx`):
- `dayScenes` — scenes sorted by `step_order` (`:170-176`).
- `taskBlocks` — flatten each plan item into one **timed row per calendar block**
  (`:248-270`) plus one **untimed "planned" row** for an item with no block yet
  (`:228-246`, base order `UNTIMED_TASK_ORDER_BASE = 100000` at `:203`).
- `timeline` — concatenates scenes + task rows and sorts with the shared comparator
  (`:280-293`).

**DAY_START midnight-wrap** — the one canonical ordering lives in `src/lib/content/dayOrder.ts`:
`DAY_START_MINUTE = 240` (04:00, `:19`), `dayAnchoredMinute` wraps `minute < 240 → +1440`
(`:22-24`), `compareDayOrder` (`:58-69`: timed by anchored minute; untimed sink by order;
ties → scene before task). **EXISTS / REUSABLE as-is** (already shared by DailyLog +
PieceGrid; the calendar should reuse it verbatim).

### Shape of one merged item (`TimelineRow`, `DailyLog.tsx:277-279`)
**Scene row** — `{ kind:'scene', minute:number|null, order:number, scene:SceneRow }`, where
`SceneRow` (`:40-47`) =
| field | source | note |
|---|---|---|
| `id`, `entity_id` | scene row | entity present ✓ |
| `assigned_question_text`, `narrative_purpose`, `b_roll` | scene row | |
| `routine_step.{id, step_order, activity, time_of_day, routine_id}` | join (`grid/route.ts:56-62`) | **start time only**; `routine_id` (no name) |

**Task row** — `{ kind:'task', minute:number|null, order, block }`, where `block`
(`DailyLog.tsx:205-220`) =
| field | present? | note |
|---|---|---|
| `id, itemId, blockId, taskId, projectId` | ✓ | |
| `title`, `projectName`, `status` | ✓ | name resolved from `/projects` |
| `scheduledStart`, `scheduledEnd` | ✓ | raw ISO kept |
| `label` ("HH:MM–HH:MM (actual\|scheduled)"), `minute` | ✓ | `actual ?? scheduled` folded in (`:249-252`) |
| `planned` (bool) | ✓ | true = no block yet |

### Which calendar fields are already in the shape vs. need an add
| Calendar needs | State |
|---|---|
| start time (clock placement) | **EXISTS** — scene `time_of_day`; task `scheduledStart`/`minute` |
| end time | **task: EXISTS** (`scheduledEnd`). **scene: MISSING** — scenes carry only a start; `routine_steps.duration_minutes` exists (`schema:2842`) but the grid GET does NOT select it (`grid/route.ts:56-62`) → not in the feed |
| **actual** start/end (planned-vs-actual bars) | **MISSING on the flattened task row** (only `scheduledStart/End` + `label` are kept; raw `actual_start/actual_end` are dropped at `:248-270`) — but **REUSABLE**: they exist raw in `planItems[].calendar_blocks[]` (`CalendarBlock` `:59-66`). One-line add to copy them onto the row. |
| **entity** (for the entity filter) | **scene: EXISTS** (`scene.entity_id`). **task: MISSING on the flattened row** — `PlanItem.entity_id` exists (`:67-73`) but is NOT copied into `taskBlocks` (`:205-220`) → **REUSABLE** with a one-line add. |
| source discriminator | **EXISTS** — `kind: 'scene'\|'task'` |
| status | **EXISTS** — scene (answered/`saved`); task (`block.status`) |
| title / project | **EXISTS** — `activity` / `title` + `projectName` |

### Is the merge extractable?
**Inlined, not shared.** The three useMemos (`dayScenes` `:170-176`, `taskBlocks` `:204-273`,
`timeline` `:280-293`) live in `DailyLog`. The *comparator* is already shared (`dayOrder.ts`).
**REUSABLE-with-extraction.** Clean path: lift the **read + merge** into a shared hook, e.g.
`useDayFeed(date) → { timeline, loading, error, reload }`, plus the three interfaces
(`SceneRow`/`PlanItem`/block-row). Extraction touches **only the read/merge** — the
**answer drafts + `saveRow` + `startDay`** (scene-write state, `DailyLog.tsx:108-111, 298-352`)
**stay in DailyLog**. Answer+Record keeps working identically because the lift is pure (same
fetches, same comparator, same row shapes); DailyLog then consumes `useDayFeed(date)` for its
`timeline` and keeps its own write UI. The calendar consumes the same hook → one source of
truth, no second fetcher (honors the hard constraint). *(Alternative — have the calendar
re-call the three endpoints + comparator independently — duplicates the merge and risks drift;
not recommended.)*

---

## 2 · Day navigation
- **State:** `const [date, setDate] = useState(todayLocal())` in `ContentPipeline`
  (`:79`); format **`YYYY-MM-DD`** (`todayLocal` `:62-65`). **EXISTS / REUSABLE.**
- **Picker:** section 3's `<input type="date" value={date} onChange={(e)=>setDate(...)}>`
  (`ContentPipeline.tsx:547-549`).
- **Refetch on change:** `DailyLog` receives `date` (`:555`); its `loadBlocks` is
  `date`-keyed (`:142-154`, effect `:159-161`). The grid fetch is date-independent (the day's
  piece is resolved client-side by `date`, `:182-185`). **The calendar should reuse the same
  `date` state** — it already lives in `ContentPipeline` (the calendar mounts in the same
  component), so no new state/picker is needed; the calendar reads `date` and renders its own
  compact day-nav buttons that call `setDate`.

---

## 3 · Filters
- **entity_id present on every item?** Scene rows ✓ (`SceneRow.entity_id`, `:41`). Task —
  **present in source** (`PlanItem.entity_id`, `:69`; full item row from
  `daily-plan/items/route.ts:90-107`) but **DROPPED in the flattened task row** (`:205-220`).
  → **REUSABLE:** add `entity_id: item.entity_id` to the pushed row (one line, no fetch/schema
  change). Scene entity already there.
- **source discriminator:** `kind: 'scene' | 'task'` ✓ (**EXISTS**). Finer "source" (which
  routine / which project): task → `projectId`/`projectName` ✓; scene → only
  `routine_step.routine_id` (**routine NAME not in the feed** — grid GET selects no routine
  name; `schema` `operations_content_scene_groups.routine_id @unique` holds the scene-group
  per routine). If the filter needs routine names, that's a small add (a `/routines` fetch or
  an include) — **MISSING** today. The `kind` + project axis is enough for a v1 source filter.

---

## 4 · Gaps + collisions
- **Committed task blocks:** full `scheduled_start/end` + `actual_start/end`
  (`schema:2744-2747`; feed `CalendarBlock` `:59-66`) → usable start+end. **EXISTS.**
- **Untimed planned task rows** (item with no block): `minute = null`, no time at all
  (`:230-245`). Existing UI **sinks them to the end** (order base 100000) — never placed on a
  clock. The calendar must render these in a separate "unscheduled" lane, not on the timeline.
- **Scenes:** `time_of_day` may be `null` → `minute = null` (existing UI sinks by `step_order`,
  `:284`). Scenes have **a start only, never an end** in the feed (`duration_minutes` exists at
  `schema:2842` but isn't selected) → a scene can't draw a duration bar without an added
  include. **MISSING (schema-present).**
- **Collisions:** **nothing computes overlaps today** — the timeline just stacks in sorted
  order (`:280-293`). **MISSING entirely** → the calendar adds collision detection as pure
  client logic over `start/end` (only meaningful for rows that have an end, i.e. task blocks;
  scenes/untimed rows can't collide without an end).

---

## 5 · Mount point
- **Insert** a new `<section>` in `ContentPipeline` **immediately before line 341** (the
  `{/* 0 · CREATE */}` comment), i.e. between the page-level error banner (`:336-339`) and
  section 0. That places the calendar **above 0 · CREATE** as required.
- **Reuse the section-0 collapse pattern verbatim** (`ContentPipeline.tsx:344-358`):
  a `<section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">`
  whose header is a `<button type="button" aria-expanded={open} onClick={() => setOpen(o=>!o)}>`
  with an `<h2 className={sectionHeader}>` title + a `{open ? '▾ hide' : '▸ show'}` chevron,
  body gated behind `{open && (…)}`. **Collapsed by default** (`useState(false)`, mirroring
  `createOpen` at `:89`) — the page is long, so default-compact.

---

## psql verification queries (Alex runs these — I cannot reach the DB)
Replace `:uid` with the user id and `:day` with a `YYYY-MM-DD`.
```sql
-- 1. A day's task blocks: planned vs actual present? (gaps/collision inputs)
SELECT i.id AS item_id, i.entity_id, t.title, b.scheduled_start, b.scheduled_end,
       b.actual_start, b.actual_end, b.status
FROM operations_daily_plan_items i
LEFT JOIN operations_calendar_blocks b ON b.daily_plan_item_id = i.id
LEFT JOIN operations_project_tasks t ON t.id = i.task_id
WHERE i.user_id = ':uid' AND i.plan_date = ':day'
ORDER BY b.scheduled_start NULLS LAST;

-- 2. Untimed items (no block) on the day → the "unscheduled lane" count
SELECT count(*) FROM operations_daily_plan_items i
WHERE i.user_id = ':uid' AND i.plan_date = ':day'
  AND NOT EXISTS (SELECT 1 FROM operations_calendar_blocks b WHERE b.daily_plan_item_id = i.id);

-- 3. Scene time coverage: how many active scenes have NO time_of_day (can't be placed)
SELECT count(*) FILTER (WHERE rs.time_of_day IS NULL) AS untimed,
       count(*) AS total
FROM operations_content_scenes s
JOIN operations_routine_steps rs ON rs.id = s.routine_step_id
WHERE s.user_id = ':uid' AND rs.is_active = true;

-- 4. Entity spread on the day (does the entity filter have >1 value to filter?)
SELECT entity_id, count(*) FROM operations_daily_plan_items
WHERE user_id = ':uid' AND plan_date = ':day' GROUP BY entity_id;

-- 5. Real overlaps today (do collisions actually occur for this user's blocks?)
SELECT a.id, b.id
FROM operations_calendar_blocks a
JOIN operations_calendar_blocks b
  ON a.user_id = b.user_id AND a.id < b.id
 AND a.scheduled_start < b.scheduled_end AND b.scheduled_start < a.scheduled_end
WHERE a.user_id = ':uid';
```

---

## One-PR-sized implementation recommendation
**Reuse the feed via a small extraction; build the calendar as pure presentation. No new
endpoint, no schema.**

1. **Extract `useDayFeed(date)`** (new `src/components/workbench/operations/content/useDayFeed.ts`
   or `src/lib/content/`): lift the three fetches + `dayScenes`/`taskBlocks`/`timeline` merge
   out of `DailyLog` (`:115-293`), returning `{ timeline, loading, error, reload }`. Reuse
   `compareDayOrder` unchanged. While extracting, **add the two missing row fields**:
   `entity_id` on the task row (`item.entity_id`) and raw `actualStart/actualEnd` (from the
   block) — both pure copies of data already fetched. Refactor `DailyLog` to consume the hook
   (keeps its own answer-write UI) → Answer+Record behaves identically.
2. **New `DayCalendar` component**, mounted collapsed above 0·CREATE
   (`ContentPipeline.tsx:341`), reusing the section-0 collapse pattern and the shared `date`
   state. It renders `useDayFeed(date).timeline` as stacked clock blocks (DAY_START-anchored),
   an "unscheduled lane" for `minute == null` rows, **entity** + **source(`kind`)** filter
   chips (client-side `.filter`), and **client-derived gaps/collisions** over rows that have a
   start+end (task blocks). Day-nav = prev/next/today buttons calling `setDate`.
3. **No new fetcher / table** — every byte comes from the existing grid + daily-plan-items +
   projects calls already firing for section 3.

**Scope note:** if the routine-name source filter or scene duration bars are wanted, each is a
small additive follow-up (a `/routines` fetch / a `duration_minutes` include) — call them out
of the v1 PR to keep it one-sized. Flag for the implementer: confirm whether v1's source
filter is just `scene` vs `task` (no added fetch) or needs per-routine/per-project names.
