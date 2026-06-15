# TIMED-BLOCKS-AUDIT — committed flights/hotels render all-day instead of timed

**Branch:** `claude/audit-timed-blocks` · **Base:** main @ `922a32e1` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code changes.

---

## TL;DR — root cause

**The bug is in the WRITE/STORAGE path, not the renderer.** `CalendarGrid` renders timed
blocks correctly whenever an event carries a `startTime` (operations blocks prove it, and it
even has flight-style depart→arrive logic). But the trip commit writes to **`calendar_events`,
a date-only table** (`start_date`/`end_date` are `@db.Date` — **no time columns, no all-day
flag**), and `HubCalendar` maps those events **without any times**. So every committed
flight/hotel reaches the grid with `startTime === undefined` → the grid drops it into the
**all-day row** (`CalendarGrid.tsx:146`, `:491-495`).

The times *are* captured at commit — but into **`trip_itinerary`** (`homeTime`/`destTime` for
flights, `block_start_time`/`block_end_time` + `recurrence` for lodging) — which the home
calendar never reads. The date-only `calendar_events` row is the lossy copy that renders.

Hotels have a **second** problem on top: even with times, the renderer treats a multi-day
event as depart/arrive (block on day 1 + day N only), not a **nightly** block, and the commit
writes **one** range row (`is_recurring=false`), not N per-night events.

---

## 1. What the commit writes — flights

### The `calendar_events` insert (the lossy write)
`src/app/api/trips/[id]/vendor-commit/route.ts:332-338`:
```
const calStart = new Date(startDate);                 // a DATE (midnight), no time
const calEnd = endDate ? new Date(endDate) : calStart;
INSERT INTO calendar_events
  (..., start_date, end_date, is_recurring, ...)
  VALUES (..., ${calStart}, ${calEnd}, false, ...)     // is_recurring ALWAYS false
```
- **No `start_time`/`end_time` written** — and the table has no such columns (see §schema).
- `is_recurring` hard-coded `false`.
- So a flight = one row, `start_date` = depart date, `end_date` = return/arrive date, **no
  times** → renders all-day / multi-day-all-day.

### The times DO exist at commit — they just go elsewhere
- `PublicFlightSearch` sends `startTime` (depart) + `endTime` (arrive) + `arriveDate` in the
  commit body (`PublicFlightSearch.tsx:179-189`, from `offer.outbound.departure.localTime` /
  `arrival.localTime`/`date`). ✅ the wheels-up/wheels-down times are available.
- The route writes them into **`trip_itinerary`** (flight branch): `homeTime: startTime`,
  `destTime: endTime` (`route.ts:266-267`).
- **But they are NOT written to `calendar_events`** — the calendar insert (`:336`) ignores
  `startTime`/`endTime` entirely.

**→ For flights the times are captured but dropped on the way to the calendar.**

## 2. What the commit writes — hotels

- Lodging takes the date-range branch (`route.ts:273-305`): it writes **ONE**
  `trip_itinerary` row with `recurrence: 'daily'` (`:301`) + `block_start_time`/
  `block_end_time` (the overnight 22:00–07:00 fallback, `:287-292`) — explicitly **"ONE
  recurrence-template row, NOT N amortized per-day rows"** (`:275`).
- The **`calendar_events`** insert is the same single date-range row as flights (`:332-338`):
  `start_date` = check-in, `end_date` = check-out, **`is_recurring=false`**, **no times**,
  `recurrence_rule` left null.
- So a 30-night stay = **one** date-only `calendar_events` row spanning check-in→check-out,
  not 30 nightly rows, and not recurring. `recurrence:'daily'` lives **only** on the
  `trip_itinerary` template the calendar never reads.

**→ Hotels write one all-day-style span, never per-night, never with times.**

## 3. What the calendar renders

### The table is date-only (the storage ceiling)
`prisma/schema.prisma` `model calendar_events` (`:1325`):
```
start_date      DateTime  @db.Date     // DATE — cannot hold a time
end_date        DateTime? @db.Date     // DATE
is_recurring    Boolean?  @default(false)
recurrence_rule String?   @db.VarChar(50)
```
There are **no `start_time`/`end_time` columns and no `all_day` column.** `calendar_events`
is structurally an all-day/date table. (`/api/calendar` just `SELECT *`s it —
`api/calendar/route.ts:29-45`.)

### The mapping drops times
`HubCalendar.tsx` reads `/api/calendar` (source `'trip'`) and maps each to a `GridEvent`
(`:149-159`): sets `startDate: e.start_date` (`:154`) but **no `startTime`/`endTime`** (its
`CalendarEvent` interface `:29-39` has no time fields). So trip events arrive at the grid with
`startTime` undefined.

### The grid's all-day vs timed decision (renderer is fine)
`CalendarGrid` keys entirely off `startTime`:
- Timed placement: `getBlocksForDay` **`:146` `if (!event.startTime) continue;`** — no
  `startTime` ⇒ never a timed block.
- All-day row: `:491-495` `dayEvts.filter(e => !e.startTime)` — no `startTime` ⇒ rendered in
  the all-day strip.
- **Proof the renderer works for timed events:** operations blocks set `startTime`/`endTime`
  (`mapOperationsBlocks.ts:72-73`) and render as timed blocks. Same grid, same code path.
- It even has **flight depart/arrive** logic for multi-day timed events (`:157-166`): a block
  on the start day (depart time → end of day) + a block on the end day (start of day → arrive
  time). This would give wheels-up→wheels-down **if the flight event had times**.

**→ The renderer renders all-day only because the trip events have no `startTime`. Give them
times and flights render timed; the renderer is not the bug.**

### Why hotels need more than times
Even with times, the multi-day branch (`:157-166`) renders **depart/arrive** (day 1 + day N
only) — and the event index (`:249-255`) indexes a multi-day event on its **start and end
days only**, nothing between. So a 30-night stay would show at most check-in day + check-out
day, never a block on the 28 nights in between. The grid does **not** expand a
`recurrence:'daily'` event into per-day blocks (it never reads recurrence at all). And an
overnight window (22:00→07:00) crosses midnight, so a naive "same-day" nightly block would
have `endMin < startMin` (`:149-150`) — needs handling.

---

## 4. Root cause + fix map

### Definitive cause
- **(a) The COMMIT/storage drops the data.** `calendar_events` is date-only and the insert
  writes no times + `is_recurring=false`; `HubCalendar` maps without times. **This is the
  root for BOTH flights and hotels.** Cite: `route.ts:332-338`, `schema.prisma:1325`,
  `HubCalendar.tsx:149-159`.
- **(b) The RENDERER is NOT the bug for the all-day symptom** — it renders timed blocks when
  `startTime` is present (`mapOperationsBlocks.ts:72-73` + `CalendarGrid.tsx:146`). Cite.
- **(c) Hotels ALSO need renderer/commit work for the per-night cadence** — the grid has no
  daily-recurrence expansion (`:152-166`, `:249-255`), so even timed hotel events wouldn't
  repeat nightly. This is a hotel-only second cause.

### FLIGHTS — what's needed (smaller)
Get the depart/arrive times onto the flight's calendar event so the existing multi-day
depart→arrive renderer (`CalendarGrid.tsx:157-166`) fires. Requires, end to end:
1. **Storage:** add `start_time`/`end_time` to `calendar_events` (schema migration) — or
   change `start_date`/`end_date` to timestamps — since the table can't hold a time today
   (`schema.prisma:1325`). *Alternative (no migration):* feed the home calendar's trip layer
   from **`trip_itinerary`** (which already has `homeTime`/`destTime`, `route.ts:266-267`)
   instead of the lossy `calendar_events`.
2. **Write:** include `startTime`/`endTime` in the `calendar_events` insert (`route.ts:336`)
   — the values are already in scope (`startTime`, `endTime` from the request body).
3. **Map:** carry `start_time`→`startTime`, `end_time`→`endTime` in `HubCalendar` (`:29-39`,
   `:149-159`) so the grid receives them.

### HOTELS — what's needed (bigger)
Render the stay as a nightly timed block × N (check-in time → check-out time each night). On
top of the flight storage/map fix, hotels need a per-night cadence, by **one of**:
- **(A) Write N per-night events at commit** — expand the `recurrence:'daily'` stay into one
  `calendar_events` row per night (each a same-day timed block) instead of the single range
  row (`route.ts:273-305`, `:332-338`). Must handle the overnight window crossing midnight
  (e.g. emit 22:00→24:00 that night, or 22:00→07:00 labeled as the night's stay).
- **(B) Expand recurrence in the renderer** — write `is_recurring=true` + `recurrence_rule`
  (the columns already exist, `schema.prisma`), and teach `CalendarGrid`/`getEventsForDate`
  (`:249-255`) + `getBlocksForDay` (`:142-168`) to emit a block on **every** day in the span
  for a daily-recurring timed event (today it only handles start/end days).
- Either way the times must reach the event first (the flight storage/map fix is a shared
  prerequisite).

### Recommended PRs (separate — different root depths)
1. **PR-Flight-Times** — depart/arrive times onto the flight calendar event (storage/write/map)
   so it renders wheels-up→wheels-down via the existing multi-day renderer. Self-contained.
2. **PR-Hotel-Nightly** — render the stay as a nightly block × N nights (per-night events or
   renderer recurrence expansion + overnight-window handling). Larger; depends on the same
   times-reach-the-calendar fix.
> Shared prerequisite for both: **`calendar_events` (or the trip→calendar feed) must carry
> times** — today it's date-only and `HubCalendar` drops the times `trip_itinerary` already
> holds. Decide once: add time columns / timestamps to `calendar_events`, **or** source the
> home calendar's trip layer from `trip_itinerary`.

---

## REPORT (summary)

- **Write (flights):** `calendar_events` insert writes date-only `start_date`/`end_date`, no
  times, `is_recurring=false` (`route.ts:332-338`); the depart/arrive times are captured but
  only into `trip_itinerary` (`:266-267`), never the calendar.
- **Write (hotels):** one date-range row, `is_recurring=false`, no times; `recurrence:'daily'`
  lives only on the single `trip_itinerary` template (`:273-305`), not the calendar — never N
  per-night rows.
- **Render:** the grid renders timed only when `startTime` exists (`CalendarGrid.tsx:146`,
  `:491-495`); operations prove the timed path works (`mapOperationsBlocks.ts:72-73`); trip
  events arrive without times (`HubCalendar.tsx:149-159`) → all-day. Table is date-only
  (`schema.prisma:1325`).
- **Root cause:** **the commit/storage + mapping drop the times** (root for both); hotels
  additionally need per-night cadence the renderer doesn't do.
- **Fix:** PR-Flight-Times (get times onto the flight event) + PR-Hotel-Nightly (per-night
  blocks), sharing a "calendar carries times" prerequisite.

**No code modified. Audit only.**
