# Week-spanning-month-boundary Audit — only one month's events load (READ-ONLY)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / MISSING / RISK.

**Headline:** the calendar fetch window is **MONTH-scoped**, not view-scoped. A week that
spans a month boundary (Jun 28–Jul 4) displays 7 days but the three loaders request only the
**week-start's month**, so the half of the week in the *other* month is **never fetched** (a
fetch-window bug, not a render filter). Navigating/​toggling changes which month is reported →
which half loads → why the flight and the routines never appear together.

---

## 1. Where the calendar fetches + the exact window

`HubCalendar.tsx` has three loaders, all **month-scoped to `selectedMonth`**:
- **Trip events:** `fetch('/api/calendar?year=${selectedYear}&month=${selectedMonth + 1}')`
  (`HubCalendar.tsx:117`) — a single month param.
- **Operations blocks:** `from = '${year}-${month}-01'`, `to = '${year}-${month}-${lastDay}'`
  (`:128-130`) — month-01 → month-lastDay.
- **Routines:** identical month window `:141-143`.

The server honours that window — **`/api/calendar`** (`route.ts:23-34`): with a `month` param it
runs `WHERE start_date >= ${startOfMonth}::date AND start_date < ${endOfMonth}::date` — **one
calendar month only** (a `month`/`year`/no-arbitrary-range API; there is no from/to mode). So
the range is derived from the **MONTH**, not the visible view. — EXISTS / RISK,
`HubCalendar.tsx:117,128-130,141-143` + `calendar/route.ts:24-33`.

## 2. Week DISPLAY range vs FETCH range — the gap

- **DISPLAYED:** `weekDays` = the 7 days from `selectedWeekStart`
  (`CalendarGrid.tsx:393-394`), `gridDays = calendarView === 'day' ? [selectedDay] : weekDays`
  (`:397`). For the Jun 28–Jul 4 week that's **Jun 28 … Jul 4** (crosses the month line).
- **REQUESTED:** only `selectedMonth`. And `selectedMonth` is set to the **week-start's month**:
  `nextWeek`/`prevWeek` do `setSelectedMonth(ns.getMonth())` where `ns` is the new
  `selectedWeekStart` (`CalendarGrid.tsx:371-372`); the grid then reports it via
  `onMonthChange?.(selectedYear, selectedMonth)` (`:439`) in an effect keyed on
  `[calendarView, selectedWeekStart, selectedDay]` (`:462`); HubCalendar's
  `onMonthChange` handler does `setSelectedYear(year); setSelectedMonth(month)`
  (`HubCalendar.tsx:241`).
- **THE GAP:** week-start Jun 28 → `selectedMonth = June` → fetch `[2026-06-01, 2026-06-30]`.
  **Jun 28/29/30 routines load; the Jul 1 flight (July) is never requested.** If navigation
  puts the week-start in July, the inverse happens (flight loads, June routines vanish). —
  RISK, `CalendarGrid.tsx:371-372,393-397,439,462`.

## 3. Re-fire on view/nav change

The fetch effect re-runs on **`[selectedYear, selectedMonth, demoEvents]`**
(`HubCalendar.tsx:163-166`) — i.e. only when the **month** changes. The grid pushes a new
`selectedMonth` whenever `selectedWeekStart` moves to a different month
(`CalendarGrid.tsx:371-372` → `onMonthChange` `:439`). So crossing the boundary by navigating
flips `selectedMonth` between June and July, which re-fires the fetch for the *other* single
month — **exactly the "toggling swaps which events appear" symptom.** — EXISTS,
`HubCalendar.tsx:166` + `CalendarGrid.tsx:439,462`.

## 4. Fetch-window vs render-filter — DECISIVE

**Purely a FETCH-WINDOW bug** — the cross-boundary events are never loaded:
- Server returns only the month (`calendar/route.ts:25-33` `WHERE start_date >= monthStart AND
  < monthEnd`).
- HubCalendar's only client filter is a **source** filter — `raw.filter((e) => e.source ===
  'trip')` (`HubCalendar.tsx:121`) — NOT a date/month filter.
- `getEventsForDate` (`CalendarGrid.tsx`) filters by the day-key + the category toggle
  (`visibleCategories`), **not** by month — so it never drops a loaded event for being in the
  "wrong" month.
→ The Jul 1 flight is absent because it was **never fetched**, not loaded-then-filtered. — EXISTS.

---

## Explicit answers

**(a) Month-scoped or view-scoped?** **MONTH-scoped.** Range = `selectedMonth` →
`[month-01, month-lastDay]` (`HubCalendar.tsx:117,128-130,141-143`; `calendar/route.ts:24-33`),
where `selectedMonth` = the week-start's month (`CalendarGrid.tsx:371-372,439`). Not the
visible week/day range.

**(b) Week spanning a boundary — requested vs displayed.** Displayed `weekDays` = Jun 28–Jul 4
(`CalendarGrid.tsx:393-397`). Requested = the week-start month only, e.g.
`[2026-06-01, 2026-06-30]`. **Gap = Jul 1–Jul 4** (the flight) is never requested — or, with the
week-start in July, Jun 28–30 (the routines) is never requested.

**(c) Smallest fix — fetch the full VISIBLE range.** Land it in three small spots:
1. **Grid reports the visible RANGE, not just a month** — emit `gridDays[0]` →
   `gridDays[gridDays.length-1]` (week view: the 7-day span; day: that day; month: the month)
   via an `onRangeChange(from, to)` callback (or extend `onMonthChange`), driven by the existing
   effect (`CalendarGrid.tsx:439,462`).
2. **`/api/calendar` accepts a `from`/`to` window** — add a 3rd mode alongside month/year:
   `WHERE start_date >= ${from}::date AND start_date < ${to}::date` (`calendar/route.ts:23-34`).
   *(MISSING today — the route only does single-month or whole-year.)*
3. **HubCalendar fetches `[from, to]` for all three loaders** — pass the grid's visible range to
   `/api/calendar` (new from/to params) and to the ops/routines routes (which **already** take
   `from`/`to`, `HubCalendar.tsx:125,138`), and key the effect on the range instead of
   `selectedMonth` (`:166`).

**Even-smaller interim** (no route change): in week view, when `weekDays[0].getMonth() !==
weekDays[6].getMonth()`, fetch **both** months and merge — but the clean fix is the visible-range
window (handles any view uniformly). — recommend the range fix; tag **SMALL-MED** (one route
param + one grid callback + HubCalendar wiring).

### Citation index
- Month-scoped loaders: `src/components/hub/HubCalendar.tsx:115-152` (`:117,128-130,141-143`),
  effect deps `:163-166`, onMonthChange handler `:241`, source-only client filter `:121`.
- Server month window: `src/app/api/calendar/route.ts:23-34`.
- Week display range + month reporting: `src/components/shared/CalendarGrid.tsx:371-372,
  393-397, 439, 462`.

*Do not implement — audit only.*
