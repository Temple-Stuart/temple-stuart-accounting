# CALENDAR-RENDER-AUDIT — flight all-day, routines past end-date, cross-view disagreement

**Branch:** `claude/audit-calendar-render` · **Base:** main @ `3b344ce2` · **Date:** 2026-06-16
**Scope:** READ ONLY. No code changes.

---

## TL;DR

Two distinct problems:

1. **Flight still all-day (symptom 1):** *not a code bug.* PR-Flight-Times **is** correctly on
   main (write + map). An all-day flight is almost certainly an **old commit** whose
   `calendar_events.start_time` is **NULL** (committed before the ALTER/PR). Confirm with the
   psql query in §1. Code path is correct; new commits should render timed.

2. **Routines-past-end + week/month inconsistency (symptoms 2, 3, 4):** **one shared root** —
   the calendar's **fetch/expansion window is MONTH-scoped, computed independently from each
   view's DISPLAY window, and routine recurrence is expanded with no per-occurrence end-date
   bound.** Week view crosses month boundaries but only one month is fetched, and recurrence
   leaks occurrences past `end_date` whenever the window extends beyond it. Different views show
   different window slices → they disagree. This needs a real **window-unification rework**, not
   a one-liner.

---

## 1. The flight all-day — did PR-Flight-Times take effect? (YES)

PR-Flight-Times is merged (`git log`: `9ece8652`, merge `3b344ce2`). Both halves are on main:
- **Write:** `vendor-commit/route.ts:341-346` — for flights, `calStartTime/calEndTime` →
  `INSERT ... start_time, end_time ... VALUES (... ${calStartTime}::time, ${calEndTime}::time ...)`.
- **Map:** `HubCalendar.tsx:48` `toClock()` + `:172-173` `startTime: toClock(e.start_time)` /
  `endTime: toClock(e.end_time)`.
- **Read:** `/api/calendar/route.ts:30` `SELECT * FROM calendar_events` returns `start_time`/
  `end_time`; the renderer draws a timed block whenever `startTime` is present
  (`CalendarGrid.tsx:146`).

So a flight committed **after** the ALTER + PR will have times and render timed. An all-day
flight means its row has **NULL `start_time`** — i.e. it was committed **before** this shipped
(or before Alex ran the ALTER). Note: if the ALTER had *not* run, the INSERT referencing
`start_time` would throw and the whole calendar row would be skipped (`route.ts:339` non-fatal
catch) → the flight would have **no** calendar event at all, not an all-day one. Since it shows
all-day, a row exists → it's an **old/null-time** row.

### psql query for Alex (check the committed flight's row)
```sql
-- Inspect recent committed flight calendar rows: do they have times?
SELECT id, title, start_date, end_date, start_time, end_time, source_id, created_at
FROM calendar_events
WHERE source = 'trip'
  AND (title ILIKE '%flight%' OR source_id LIKE 'trip:%:vendor:flight-%')
ORDER BY created_at DESC
LIMIT 20;
```
- **`start_time` IS NULL** → old/pre-times commit. Fix = re-commit it (uncommit + Save again)
  so the new write captures times; no code change needed. (Optionally a one-off backfill.)
- **`start_time` HAS a value but still renders all-day** → then re-open the map/serialization
  (but the code path above is correct, so this is unlikely).

---

## 2. The recurrence / end-date bug — routines show past 2026-06-30

### How routines become calendar events (expanded at read time)
Routines are **not** stored as calendar rows — they're **expanded on every fetch** from an
RRULE:
- `HubCalendar.tsx:132-135` fetches `/api/hub/operations-routines?from=…&to=…`.
- The route expands each active routine's `schedule_rrule` into occurrences in the window:
  `operations-routines/route.ts:146` `occurrences = expandBetween(r.schedule_rrule, r.timezone,
  from, windowEnd)`.
- `expandBetween` (`rruleHelpers.ts`): `rule.between(from, to, true)` — it expands **only**
  between `from` and `to`; it does **not** know the routine's `end_date`.
- `mapOperationsRoutines.ts:89-98` maps each occurrence ISO → a `CalendarEvent` (one tile per
  occurrence).

### Where end_date is (and isn't) enforced — the bug
`operations-routines/route.ts:136-146`:
```
// COARSE routine-level skip only:
if (r.start_date) { if (startDateStr > toLocal) continue; }   // starts after window → skip
if (r.end_date)   { if (endDateStr   < fromLocal) continue; } // ended before window → skip
...
occurrences = expandBetween(r.schedule_rrule, r.timezone, from, windowEnd);  // NOT clamped to end_date
```
The routine is skipped **only if its `end_date` is entirely before the window start**. Once the
routine overlaps the window at all, **every** occurrence between `from` and `windowEnd` is
emitted — **including occurrences after `end_date`.** The RRULE itself carries **no `UNTIL`**
(the route relies on the separate `end_date` column, hence the coarse check), so `expandBetween`
runs to `windowEnd` regardless. **Per-occurrence end-date filtering is missing.** → A routine
ending 2026-06-30 emits occurrences on any window days after 6/30.

### Why Week vs prior-week disagree
The **fetch window is month-scoped** but the **displayed window is per-view**, so each view feeds
`expandBetween` a different `[from, windowEnd]` and shows a different slice:
- Fetch window = the selected month: `from = first of selectedMonth`, `to = last day`
  (`HubCalendar.tsx:132-134`); week nav sets `selectedMonth = weekStart.getMonth()`
  (`CalendarGrid.tsx:272-273`).
- Week view renders 7 days from `selectedWeekStart` that **can cross into the next month**
  (`CalendarGrid.tsx:295,298`), while the data only covers one month.
- So when the window/month combination has `windowEnd` past 6/30 (a boundary week, or a month
  whose fetched window includes post-end days **for the routine's timezone** — `windowEnd` is
  `to + 1 day − 1ms` UTC, `operations-routines/route.ts:103`, then `expandBetween` shifts to the
  routine tz, `rruleHelpers` `shiftFloatingToZone`), occurrences past 6/30 leak onto July cells;
  in a month/window that ends exactly at 6/30, they don't. The two views compute different
  windows → they disagree. The timezone shift at the month edge makes the exact boundary day
  fuzzy, which is why it manifests as a few days (Jul 1-4), not a clean cutoff.

**Definitive defect:** `expandBetween` is never bounded by `end_date` (`route.ts:146`); the
only guard is the coarse routine-level skip (`:139-142`). Fix = clamp the expansion `to` to
`min(windowEnd, end_date end-of-day)` **or** filter `occurrences` to `≤ end_date` in the routine
timezone.

---

## 3. Cross-view consistency (Day vs Week vs Month) + month scroll

### Each view computes its window independently (no single window function)
`CalendarGrid` derives three different display ranges:
- **Day:** `gridDays = [selectedDay]` (`:298`); `selectedDay` driven by `prevDay/nextDay`
  (`:279-280`).
- **Week:** `weekDays` = 7 days from `selectedWeekStart` (`:295`), `selectedWeekStart =
  selectedDay − getDay()` (`:216`); `prevWeek/nextWeek` step ±7 and **set selectedMonth =
  weekStart.getMonth()** (`:272-273`). **A week can span two months.**
- **Month:** a 6-row grid from `firstDay` + `daysInMonth` of `selectedMonth` (`:241-244,
  291-292`) — leading blanks, **no trailing next-month days**.
There is **no shared "visible window" function** — each view computes its own day set, and the
parent fetch is month-only. That mismatch is the structural source of the disagreement.

### Fetch window vs displayed window (the month-scroll glitch)
- All three loaders fetch **the selected month only**: `/api/calendar?year=&month=`
  (`HubCalendar.tsx:108`), daily-plan `from/to` = month (`:119-121`), routines `from/to` = month
  (`:132-134`). The fetch effect re-runs on `[selectedYear, selectedMonth]`.
- The calendar grid (via the `onMonthChange` prop we added) only tells the parent the
  month/year to fetch — it does **not** communicate the actual visible range. So:
  - **Week view crossing a boundary** shows adjacent-month days with **no fetched data** →
    events "aren't mapped right," layout looks sparse/off vs Day view.
  - **Month-to-month scroll** swaps the whole month's data; boundary weeks (and any
    recurrence that should bleed across) flip in/out inconsistently → "glitches."
- This is an **off-by-window** problem (month granularity) rather than off-by-one: the fetched
  set and the rendered set are computed from different inputs.

---

## 4. Root-cause map + fix sequence

| Symptom | Cause | Shared? |
|---|---|---|
| 1 · flight all-day | **Data**, not code: old commit with NULL `start_time` (PR-Flight-Times correct + merged). | Independent |
| 2 · routine past 6/30 | `expandBetween` not bounded by `end_date`; only a coarse routine-level skip (`operations-routines/route.ts:139-146`). | Part of the windowing family |
| 3 · week layout vs day | Each view computes its own display window; fetch is month-only → cross-month week days are dataless (`CalendarGrid.tsx:295,298` vs `HubCalendar.tsx:132-134`). | **Shared root** |
| 4 · month-scroll glitch | Fetch window = month, display window = per-view; they don't align; `onMonthChange` only passes month, not the visible range. | **Shared root** |

**Shared root for 2/3/4:** the calendar fetches + expands on a **month window** that is computed
**independently** of what each view actually displays, and recurrence expansion has **no
per-occurrence end bound**. One coherent rework — unify the window — resolves 3 and 4 and removes
the view-dependent slicing that makes 2 visible across views.

### Recommended fix sequence (atomic PRs)
1. **PR-Routine-EndDate** (small, high-confidence, do first): in
   `operations-routines/route.ts`, clamp the expansion to the routine's `end_date` —
   `expandBetween(rrule, tz, from, min(windowEnd, endOfDay(end_date)))`, or filter the returned
   occurrences to `≤ end_date` in `r.timezone`. Also clamp `start_date` as a lower bound for
   symmetry. Fixes the "past 6/30" leak **definitively**, independent of windowing. Cite:
   `:139-142`, `:146`.
2. **PR-Calendar-Window** (real rework, do second): give the calendar **one visible-window
   function** and fetch/expand to **exactly that range**. The grid should report its full
   displayed range (week can cross months; optionally month grids include trailing days) via
   `onMonthChange` → a `onRangeChange(from,to)`, and `HubCalendar`'s three loaders fetch that
   range instead of the month (`HubCalendar.tsx:108,119-121,132-134`). Resolves 3, 4, and the
   cross-view disagreement. **Be honest: this is a windowing rework** (touches the grid's
   view/nav state + the parent's three fetches + the month-vs-range contract), not a patch — it
   should be scoped and tested carefully, ideally behind the existing additive-prop pattern so
   the 9 shared `CalendarGrid` consumers stay byte-identical.
3. **Symptom 1** (data, no PR needed): run the psql query (§1). If `start_time` is NULL on the
   shown flight, re-commit it (or backfill); future commits are already correct.

### Honest complexity note
Symptom 2 has a small, clean fix (PR-Routine-EndDate). Symptoms 3/4 are a genuine
**fetch-window vs display-window mismatch** that needs the window-unification rework
(PR-Calendar-Window) — don't expect a one-line patch. The month-scoped fetch + per-view display
+ timezone-at-boundary interaction is the through-line; fixing the window contract is the durable
solution.

---

## REPORT (summary)

- **Flight all-day:** PR-Flight-Times is merged and correct (`vendor-commit:341-346`,
  `HubCalendar:48,172-173`, `calendar/route:30 SELECT *`); the shown flight is old data with
  NULL `start_time` — verify via the psql query in §1, then re-commit.
- **Routine past end:** `expandBetween` (`operations-routines/route.ts:146`) isn't bounded by
  `end_date`; only a coarse routine-level skip exists (`:139-142`) → occurrences leak past
  `end_date` whenever the window extends beyond it.
- **Cross-view disagreement / glitches:** fetch is month-scoped (`HubCalendar.tsx:108,119-134`)
  while each view computes its own display range (`CalendarGrid.tsx:295,298`, week crosses
  months) — no shared window function; `onMonthChange` passes month, not the visible range.
- **Fix order:** PR-Routine-EndDate (small) → PR-Calendar-Window (rework) → re-commit the old
  flight (data).

**No code modified. Audit only.**
