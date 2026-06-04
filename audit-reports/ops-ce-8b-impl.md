# OPS-CE-8B — One canonical day order (S3 timeline + record grid)

**Branch:** `claude/ops-ce-8b` (off `main`; CE-8 merged)
**Date:** 2026-06-03
**One concept:** a single shared, day-anchored time sort so the S3 answer timeline
and the DAY-TO-DAY RECORD grid read in the **same** order as Alex's actual day.
**Presentation only — 0-schema, no payload/route changes.** S2 (the draft) keeps
selection order, untouched.

> ✅ `git diff` = the new helper `src/lib/content/dayOrder.ts` + the two sort sites
> (`DailyLog.tsx`, `PieceGrid.tsx`). No schema, no routes. tsc exit 0; eslint exit 0.

---

## The two old sorts (cited)

1. **S3 / DailyLog** (`DailyLog.tsx:239-246`, pre-change): the interleave sorted by
   **plain minute-of-day** —
   ```
   if (a.minute !== b.minute) return a.minute - b.minute;
   ```
   with `minute = minuteOfTimeOfDay(time_of_day)` / `minuteOfInstant(block)`. So a
   **Sleep scene at 00:00 sorts FIRST**, even though it's the LAST scene of Alex's
   day (his day wraps past midnight). A 00:30 task block likewise floats to the top.

2. **Record grid / PieceGrid** (`PieceGrid.tsx:154` + the row map `:369`): rendered
   `scenes` straight from the grid GET, which orders
   `routine_step.step_order asc, created_at asc` (`grid/route.ts:65`). Across multiple
   routines this **jumbles rows by step index** (0,0,0,1,1,2…) instead of by time —
   so S3 and the record disagreed.

---

## The fix — one shared comparator (`src/lib/content/dayOrder.ts`)

A single helper, imported by **both** sites (no copies → can't drift again):

- **`DAY_START_MINUTE = 240`** (04:00).
- **`dayAnchoredMinute(minute)`** → `minute < DAY_START ? minute + 1440 : minute`
  (early-morning times belong to the END of the content day).
- **`minuteOfDayFromTime(timeOfDay)`** — minutes from a `@db.Time` value (null if
  untimed). **`minuteOfDayFromInstant(iso)`** — local wall-clock minutes from a
  calendar-block Timestamptz.
- **`compareDayOrder(a, b)`** over `{ minute: number|null; order: number; kind? }`:
  - both untimed → by `order` (step_order);
  - untimed sinks **after** all timed (`return 1 / -1`);
  - timed → by **`dayAnchoredMinute`**;
  - tie at the same anchored minute → **scene before task** (the CE-6 rule), then by
    `order`.

**Applied in both:**
1. **DailyLog interleave** (`:239`): scenes (`minuteOfDayFromTime`) AND task blocks
   (`minuteOfDayFromInstant`) flow through `rows.sort(compareDayOrder)` — so a 00:30
   task block also lands at day-end. The local `fmtTimeOfDay`/`fmtClock` stay (display
   only); the duplicate minute helpers were **removed** in favor of the shared ones.
2. **PieceGrid row sort** (`:154`): `visibleScenes` now
   `[...(scenes ?? [])].sort(compareDayOrder(...))` keyed by each scene's
   `time_of_day` minute + `step_order` — replacing the inherited step_order order.

---

## Before → after (proved)

Replaying `compareDayOrder` on a representative day
(`07:00 pages`, `09:00 work`, `23:45 wind-down`, `00:00 Sleep`, `00:30 task block`,
two untimed steps):

```
Morning pages 07:00
Work 09:00
Wind-down 23:45
Sleep 00:00 (scene)      ← wrapped to day-end (was FIRST before)
Task block 00:30         ← wrapped to day-end, after the scene on the tie band
Untimed step2            ← untimed sink, by step_order
Untimed step3
```

- **Before:** S3 showed `00:00 Sleep → 00:30 task → 07:00 → 09:00 → 23:45`; the record
  showed step-order jumble. **After:** both read `07:00 → … → 23:45 → 00:00 Sleep last`,
  matching S2's selection order for Alex's data.
- **Untimed** scenes sink after timed, ordered by step_order — correct in both.
- **Tie rule** preserved (scene before task).

---

## Verify
- **S3 + record share one order:** both import `compareDayOrder` from the single
  helper; PieceGrid sorts scenes by it, DailyLog interleaves scenes+blocks by it. ✅
- **Midnight wraps to end; untimed last; scene-before-task tie** — proved above. ✅
- **S2 untouched:** ScenifyDraft not in the diff (keeps selection order). ✅
- **0-schema, no payload/route change:** diff is the helper + two component sort sites
  only; no `prisma/schema.prisma`, no `api/`. ✅
- **tsc:** exit 0. **eslint:** exit 0 (helper + both components).

## git diff scope
New: `src/lib/content/dayOrder.ts`. Modified: `DailyLog.tsx` (use shared minute fns +
`compareDayOrder`, drop local minute dupes), `PieceGrid.tsx` (sort `visibleScenes` by
`compareDayOrder`). No schema, no routes, no other file.

---

## Result
S3 and the DAY-TO-DAY RECORD now share **one** day-anchored comparator
(`src/lib/content/dayOrder.ts`): the content day starts at 04:00 and early-morning
times wrap to the end, so both surfaces read `07:00 → … → 23:45 → 00:00 Sleep last` —
matching the draft's selection order — with untimed scenes sinking by step_order and
scenes sorting before task blocks on a tie. One helper, two call sites, no drift.
Presentation only; 0-schema; tsc + eslint clean.
