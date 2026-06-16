# Ledger → Calendar Mapping Audit — flight/hotel timed blocks + the hotel time gap

**Scope:** read-only audit. (1) Make ledger dates/times map to the calendar as timed
blocks (flights wheels-up→wheels-down; hotels daily check-in→check-out across the stay).
(2) Hotels show blank check-in/out TIMES in the ledger ("—"), so they can't become a daily
timed block — find where to default them (check-in 15:00 / check-out 11:00). **No code
changed.**

**Headline:** flights already map to a **timed** calendar block; hotels do **not**, for
**three** stacked reasons:
1. **Ledger "—":** the ledger reads `trip_itinerary.homeTime/destTime`, which the lodging
   commit leaves **null**.
2. **Calendar all-day:** the `calendar_events` INSERT **hardcodes null times +
   `is_recurring=false` for every non-flight** — so even the 22:00/07:00 `block_*_time`
   already on the itinerary never reaches the calendar.
3. **No daily render:** even with times, `CalendarGrid` only draws a **depart-day +
   arrive-day** pair for a multi-day event (the flight pattern) and **expands no
   recurrence** — there is no per-night block across a stay. So a hotel needs both default
   times **and** a render/expansion fix.

---

## 1. What maps to the calendar today

**The unified path:** `vendor-commit` writes `calendar_events` (raw SQL) → `/api/calendar`
SELECTs the month/year rows → `HubCalendar` maps them to `GridEvent`
(`HubCalendar.tsx:161-180`, `startTime: toClock(e.start_time)` `:172`) → `CalendarGrid`
renders timed blocks from `startTime` (`CalendarGrid.tsx:146`).

### Flight — maps as a TIMED block ✅ (for new commits)
`vendor-commit/route.ts` calendar INSERT: `isFlight` → `end_date = arriveDate`,
`start_time = startTime`, `end_time = endTime` (`:339-344`); the INSERT writes those
(`:345-348`). `CalendarGrid.getBlocksForDay` (`:143-172`) then draws a **wheels-up→
wheels-down** block — same-day flight = one block (`:151-153`); overnight flight = a
**depart block** (startTime→midnight) on the start day + an **arrive block**
(midnight→endTime) on the arrival day (`:157-171`). The screenshot's LAX→DPS (Jun 30 00:00 →
Jul 1 10:05) is exactly this two-day split. ✅
**Caveat:** only flights committed **after** PR-Flight-Times carry times; older rows have
null `start_time` → fall to the all-day lane (`CalendarGrid.tsx:146` `if (!event.startTime)
continue;`). Those need a **re-commit**, not a code fix.

### Hotel — maps as an ALL-DAY single bar ❌
The lodging branch's `calendar_events` INSERT takes the **non-flight** path:
`calStartTime = isFlight ? (startTime || null) : null` and likewise `calEndTime`
(`vendor-commit/route.ts:343-344`), and `is_recurring` is hardcoded `false` in the INSERT
VALUES (`:345-348`). So the hotel becomes **one all-day event** spanning `start_date →
end_date` (Jul 1 → Jul 31) with **no clock and no recurrence** — regardless of what's on
`trip_itinerary`.

---

## 2. The hotel time gap (the core fix)

### Where the lodging commit sets dates/times/recurrence
The lodging (date-range) branch (`vendor-commit/route.ts:274-308`):
- `recurrence: recurrenceOverride ?? (isRange ? 'daily' : 'once')` (`:301`) — **'daily' is
  set** for a real range.
- `block_start_time` / `block_end_time`: time inputs when present, else **lodging falls back
  to an overnight 22:00–07:00 window** (`:288-292`, `:302-303`). **So block_* IS written**
  (22:00/07:00) — but that's a *sleep* window, not check-in/out, and **nothing reads it**.
- `homeTime: startTime || null`, `destTime: endTime || null` (`:295-296`) — **null when the
  commit passes no times** (the hotel detail commit doesn't).

### Why the ledger shows "—"
The ledger reads `homeTime`/`destTime` (PR-Trip-Ledger-1 mapped `startTime=homeTime`,
`endTime=destTime` in `/budget`), which are **null** for hotels → "—". The 22:00/07:00 lives
on `block_start_time/block_end_time`, **which the ledger never reads**. So the data isn't
fully missing — it's the *wrong field* (a sleep window, not check-in/out), and unread.

### Where to inject default hotel times (check-in 15:00 / check-out 11:00)
The single spot is the lodging `trip_itinerary.create` (`:294-308`):
- `homeTime: startTime || '15:00'` and `destTime: endTime || '11:00'` (so the **ledger**
  shows them), and
- change the `blockStart`/`blockEnd` lodging fallback (`:288-292`) from 22:00/07:00 to
  **15:00/11:00** (so the *block* matches check-in/out), and
- in the `calendar_events` INSERT, **stop forcing null for lodging** — feed the check-in/out
  times (and handle the daily span, §below).
All editable later (they're plain columns). **No migration** — `trip_itinerary` and
`calendar_events` already have the time columns.

### Can the calendar render a daily hotel block once times exist? — NO, not yet
Two gaps in the renderer:
- **`getBlocksForDay` only draws depart-day + arrive-day** for a multi-day timed event
  (`CalendarGrid.tsx:157-171`) — the **middle nights get no block**. A 30-night stay would
  show a block on Jul 1 (15:00→midnight) and Jul 31 (midnight→11:00) and **nothing on the 29
  nights between**.
- **`eventsByDateKey` indexes an event only on its `startDate` and `endDate`**
  (`CalendarGrid.tsx:243-256`) — **not the middle days** — so a multi-day event literally
  isn't placed on in-between dates.
- **No recurrence expansion anywhere:** `/api/calendar` just SELECTs rows (no RRULE
  expansion); the INSERT never writes `recurrence_rule` and hardcodes `is_recurring=false`;
  `CalendarGrid` does not expand `isRecurring` into N occurrences.

→ So hotels need **both** default times **and** a daily render — either **per-night
expansion at commit** (insert N nightly `calendar_events`, each 15:00→11:00 next morning,
crossing midnight) **or** **render-time expansion** (teach `CalendarGrid`/the feed to expand
a daily-lodging event into a block per night). This confirms the earlier TIMED-BLOCKS audit:
**multi-night + midnight crossing is not handled today.**

---

## 3. The general date/time → calendar flow

**The rule that should hold:** every committed line with times → a timed `calendar_events`
block; **`cadence:'daily'` → a block repeated per day across the span**. Today only the
**flight one-time (and overnight two-day)** case satisfies it; **daily lodging does not**
(null times + no expansion).

**The consistent path:** `trip_itinerary` (homeTime/destTime/recurrence/block_*) →
`calendar_events` (start_time/end_time/is_recurring) → `/api/calendar` → `HubCalendar`
(`toClock`) → `CalendarGrid.getBlocksForDay`. The **break is at the INSERT** (non-flights
forced to null/non-recurring, `vendor-commit:343-348`) and at the **renderer** (no per-night
/ no recurrence expansion).

**Activities/others — same gap (flag, don't build):** the transfer/vehicle/activity
branches also pass times only when the commit provides them, and the INSERT writes null
times for every non-flight (`:343-344`). So a future timed activity will hit the **same
wall** — it won't draw a timed block until the INSERT stops special-casing only flights.
The clean long-term fix generalizes the INSERT to carry `start_time/end_time` for **any**
type that has them, not just `isFlight`.

---

## 4. The plan

### Separable pieces
- **(a) Hotel default times at commit (small):** inject 15:00/11:00 into the lodging branch
  (`homeTime/destTime` + the block fallback) so the **ledger shows times** and the data
  exists. No migration. This alone fixes the ledger "—".
- **(b) Daily timed render (larger):** make the hotel actually draw nightly blocks. Either
  per-night expansion at commit (N `calendar_events`, 15:00→11:00 crossing midnight) or
  render-time expansion in `CalendarGrid` + the feed. **This is the real complexity** —
  multi-night and midnight-crossing are unhandled (`getBlocksForDay` + `eventsByDateKey`
  only know start/end day; no recurrence expansion).
- **(c) Flight render:** already correct for **new** commits; **old** flights (null times)
  just need a re-commit — no code.

### Recommended atomic PRs (dependency order)
1. **PR-Hotel-Default-Times** *(small, no migration)* — lodging commit writes
   `homeTime='15:00'`/`destTime='11:00'` (+ block fallback 15:00/11:00). Fixes the ledger
   "—" immediately; editable later. **Ship first** — it's independent and low-risk.
2. **PR-Calendar-Lodging-Times** *(small–medium, no migration)* — stop forcing null times
   for lodging in the `calendar_events` INSERT; carry the check-in/out times (and set
   `is_recurring`/`recurrence_rule` from `recurrence`). Generalize the `isFlight`-only
   special-case so any timed type passes through (covers future activities too).
3. **PR-Calendar-Daily-Render** *(the heavy one, no migration)* — render a hotel as a block
   **per night** across the stay: per-night expansion (at write or render) + **midnight
   crossing** + indexing the **middle days** (`eventsByDateKey` / `getBlocksForDay`). This
   is where the honest complexity lives; scope it on its own.

### Migration?
**None needed.** `trip_itinerary` has `homeTime/destTime/block_start_time/block_end_time/
recurrence`; `calendar_events` has `start_time/end_time/is_recurring/recurrence_rule`. Every
fix is values/render, not schema.

### Honest complexity flag
The hotel **default times** are trivial; the **daily timed render** is not. Today the grid
models a multi-day event as a depart-day/arrive-day pair (built for flights), places events
only on their first/last day, and expands no recurrence. A correct nightly hotel block
(15:00→11:00, crossing midnight, on every night of a 30-night stay) is a genuine renderer
change — treat PR-3 as its own effort, not a rider on the default-times fix.

---

### Citation index
- `calendar_events` schema (start_time/end_time/is_recurring/recurrence_rule):
  `prisma/schema.prisma:1325-1352` (`:1337-1340`)
- Lodging itinerary create (homeTime/destTime null, block 22:00/07:00, recurrence 'daily'):
  `src/app/api/trips/[id]/vendor-commit/route.ts:274-308` (`:288-292, 295-296, 301-303`)
- Calendar INSERT (non-flight forced null times + is_recurring=false):
  `vendor-commit/route.ts:325-348` (`:343-344, 345-348`)
- Flight timed path: `vendor-commit/route.ts:339-344`
- Feed (no expansion): `src/app/api/calendar/route.ts:30-45`
- HubCalendar map (start_time→startTime via toClock): `src/components/hub/HubCalendar.tsx:39-41,
  108, 161-180` (`:172-174`)
- CalendarGrid timed/multi-day (no per-night, no recurrence): `src/components/shared/CalendarGrid.tsx:146,
  151-171, 243-256`
