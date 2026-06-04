# OPS-CE-8D — The script map is the day's map (tasks interleaved chronologically)

**Branch:** `claude/ops-ce-8d` (off `main`; CE-8C merged)
**Date:** 2026-06-03
**One concept:** S2 (the AI SCRIPT MAP) shows the whole selected DAY in chronological
order — the routines' scene rows interleaved with the day's project TASKS, positioned
by the CE-8B shared `dayOrder` comparator. Plus full task text everywhere (S1 no
longer truncates). **0-schema; zero new write paths; task rows read-only.**

> ✅ `git diff` = `ScenifyDraft.tsx`, `ContentPipeline.tsx` (S1 wrap + date prop +
> add-event), `DailyLog.tsx` (refresh-on-add listener), `ScenifyModal.tsx` (1-line
> event constant). No `prisma/schema.prisma`, no `api/`. tsc exit 0; eslint exit 0.

---

## The reused GET (cited)
`GET /api/operations/daily-plan/items?from=&to=` (`daily-plan/items/route.ts:90-108`)
returns every plan item for the date **with its `calendar_blocks`** (and `task`/
`ad_hoc_title`). ScenifyDraft now loads it for the pipeline's selected `date` (a new
`loadDay`, read-only) + `/operations/projects` for project-name labels. **No API
change.**

## 1 · S2 interleave (ScenifyDraft)
`ScenifyDraft` takes a new **`date`** prop and builds **one chronological `dayMap`**:
- **Scene rows** (all selected routines' steps) — `minute = minuteOfDayFromTime`,
  untimed `order = routineIndex*1000 + step_order` (selection-then-step sink). Rows
  are **unchanged/editable** (camera/angle/shot/b-roll/narrative + question, AI
  suggest, save); the routine name is kept as a **secondary label** under the
  activity (chronology wins ordering — the per-routine separator bands are gone).
- **Task rows** — timed per `calendar_block` (`minuteOfDayFromInstant`,
  actual-else-scheduled label) + block-less **planned** rows
  (`minute=null`, `order = 100000 + i`). **Read-only amber band** (S3's style):
  `time · full task title (break-words, never truncated) · project · status`.
- `dayMap.sort(compareDayOrder)` (the CE-8B helper) → timed rows interleave by
  anchored clock (midnight wraps to day-end), scene-before-task on ties, untimed
  scenes then planned tasks. The `#` column numbers **scene rows** in chronological
  order.

**Proved** (comparator replay on Alex's shape):
```
07:00 Morning pages → 07:15 Coffee → 08:00 Gym → 10:00 Deep work →
11:00–13:00 TASK build feature → 23:00 Wind-down → 23:45 Journal → 00:00 Sleep
```
Tasks slot between routines; Sleep (00:00) stays last.

## 2 · S1 task text (ContentPipeline)
The sources task title was `truncate` → now **`break-words`** (full title, multi-line
ok); the row aligns `items-start`. Project/entity/status stay secondary.

## 3 · S3 parity — SKIPPED (already merged)
The CE-8C block-less-planned-rows render is **already on `main`**
(`Merge #738 claude/ops-ce-8c`; `DailyLog.tsx` has the `planned`/
`no time committed` rows). So no S3 render change here. **One small S3 touch:** a
refresh-on-add listener (below) so the verify's "appears in S3 immediately" holds.

## Refresh on add-to-day (S2 + S3 immediate)
Adding a task in S1 changes the day's plan but not the `date`, so the children
wouldn't re-read. A shared window event closes that:
- `CONTENT_DAY_PLAN_CHANGED_EVENT` added to `ScenifyModal.tsx` (the existing event
  home).
- `ContentPipeline.addTaskToDay` dispatches it on success.
- `ScenifyDraft` (S2) and `DailyLog` (S3) listen → re-read the day's tasks.
So a "+ add to day" shows in **both** S2 and S3 immediately.

## AI / tasks
AI suggest stays **per-routine on scenes only** (unchanged). Tasks get **no shot
fields** this PR. **FLAG (follow-up, not built):** a "shotify a task" concept (filming
fields on a task) needs schema — deferred; task filming is covered by work-block
scenes.

## Payload-unchanged proof
`ScenifyDraft`'s `handleSubmit` still POSTs the **identical** body to
`/content/scene-rows` — `{ routine_step_id, camera_needed, filming_angle, shot_type,
b_roll, narrative_purpose, assigned_question_id, assigned_question_text }` (verified
verbatim) — and the enrich body is unchanged (`{ routine_id, cameras }`). Scene cell
handlers (`setField`/`setQuestionText`) and the per-routine enrich loop are byte-for-
byte preserved. Task rows issue **no writes**.

## Verify
- **S2 = the day in clock order, tasks between routines** — proved above. ✅
- **add-to-day → appears in S2 and S3 immediately** — `CONTENT_DAY_PLAN_CHANGED_EVENT`
  listeners. ✅
- **Full task text in S1 + S2** — S1 `break-words`; S2 task title `break-words`. ✅
- **Scene editing + save byte-identical payload** — preserved verbatim. ✅
- **Read-only task rows** — amber band, no inputs/writes. ✅
- **0-schema, zero new write paths** — reads the existing GET; only existing routes
  written; no schema/`api/` in the diff. ✅
- **tsc** exit 0; **eslint** exit 0.

## git diff scope
`ScenifyDraft.tsx` (interleave + date prop + day-task load + event listener),
`ContentPipeline.tsx` (S1 title wrap, pass `date`, dispatch event),
`DailyLog.tsx` (refresh-on-add listener + import), `ScenifyModal.tsx` (event
constant) (+ this report). No schema, no routes.

---

## Result
S2 is now THE DAY'S MAP: routine scenes (editable, AI-suggestable, save unchanged)
and the day's project tasks (read-only amber bands, full wrapped title · project ·
status) read top to bottom in clock order via the one shared `dayOrder` comparator —
`07:00 → … → [tasks between routines] → 00:00 Sleep last`. Adding a task to the day
surfaces it in S2 and S3 instantly; task titles are fully readable in S1 and S2.
0-schema, zero new write paths, scene payload byte-identical; tsc + eslint clean.
Gear-per-task ("shotify a task") flagged as a schema follow-up.
