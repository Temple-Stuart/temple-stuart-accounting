# tz-3 Render-from-Instant Audit (fixed home anchor "America/Los_Angeles") — READ-ONLY

**Mandate:** Truth-first, read-only, every claim cites file:line. ANCHOR = fixed const
`"America/Los_Angeles"`; tz-4 (later) swaps it for trip-local. Labels: EXISTS /
EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** every calendar render site reads the **naive** `start_time`/`start_date`
literally — i.e. in the *airport's own* clock, **not** a single anchor — so a flight whose
departure zone ≠ the home anchor lands at the wrong vertical position. The instant
(`start_at`) **is fetched** by `/api/calendar` (`SELECT *`) but is **dropped at HubCalendar's
map** before the grid (exactly like `duration_minutes` was pre-PR-3). tz-3 needs **(a) plumb
the instant to the grid, then (b) drive geometry/keys/labels from `instantToZoned(start_at,
anchor)`** — `lib/time.ts` is merged + proven. The **null-`start_at` case** (old rows + every
non-flight event) is the one decision tz-3 must define.

---

## 1. CalendarGrid render sites (each currently NAIVE)

| Site | file:line | Naive read today | tz-3 (instant in anchor) |
|---|---|---|---|
| `parseDate` | `CalendarGrid.tsx:109-112` | `dateStr.split('T')[0].split('-')` → local `Date` | day-key from `instantToZoned(start_at,'America/Los_Angeles').date` |
| `dateToKey` | `:114` | local Y-M-D components | (key already in anchor once date comes from instant) |
| `timeToMinutes` | `:116-119` | `"HH:MM"` → minutes (naive clock) | minutes from `instantToZoned(start_at,anchor).time` |
| `formatTime12h` | `:121-…` | naive `"HH:MM"` → 12h label | label from the anchor wall-clock |
| **`getBlocksForDay` geometry** | **`:156`** `const startMin = timeToMinutes(event.startTime)` | **block top/height from the naive depart clock** | `startMin` from `instantToZoned(start_at,anchor)` |
| getBlocksForDay arrival label | `:185-186, 207` | `arr ${formatTime12h(event.endTime)}` (naive arrival clock, the OTHER zone) | `arr ${instantToZoned(end_at,anchor).time}` |
| `eventsByDateKey` (month) | `:290-307` | day-keys via `parseDate(e.startDate)` / `e.endDate` (naive) | keys via `instantToZoned(start_at,anchor).date` |
| Block draw (top/height) | `:637-638` | `(block.startMin/60)*HOUR_HEIGHT` | unchanged — consumes the (now anchor-correct) `startMin` |
| Day/week/month **headers** | `:361-364` | `selectedDay`/`weekDays` local — these are the **viewer's nav dates**, not event data | **leave** (nav calendar, not event geometry) |

— all RISK (naive), except headers (fine).

**Visible window:** `START_HOUR=0 … END_HOUR=24` (`:104-106`) — the grid shows a full 24h, so
it does **not** clip the geometry; a misplaced block is a *positioning* error, not a window clip.

## (a) WEEK-VIEW BUG ROOT — naive geometry, NOT a path PR-3 missed
**Day and week share the SAME path:** `gridDays = calendarView==='day' ? [selectedDay] :
weekDays` (`:359`), and `getBlocksForDay(dayKey, dayEvents)` is called once per grid day at
`:606`. There is **no separate week renderer** — both run the PR-3 duration geometry. So the
week bug is **not** a missed path.

**The root is the naive depart-clock at `CalendarGrid.tsx:156`:**
`const startMin = timeToMinutes(event.startTime)` positions the block by the **airport-local**
`start_time`, not the home anchor. For a flight whose **departure zone differs from the anchor**
(e.g. a DPS→LAX return: `start_time` is Bali-local), the block is placed at the *Bali* clock
position, which is ~15h off the correct LAX-anchor position — it visually "shifts/clips" into
the wrong part of the day. The PR-3 duration geometry is correct *relative to the depart clock*,
but the depart clock itself is in the wrong zone. (For a LAX-*origin* flight the depart clock
already equals the anchor, so only the **arrival label** disagrees — `arr 10:05` Bali vs the
19:05 LAX geometry end, `:185-186`.) **Fix:** drive `startMin` (and the arrival label) from
`instantToZoned(start_at/end_at, 'America/Los_Angeles')`. — RISK, `:156`.

## 2. HubCalendar plumbing — instant DROPPED before the grid
- `/api/calendar` returns it: **`SELECT * FROM calendar_events`** (`src/app/api/calendar/route.ts:30,41`)
  → `start_at`/`end_at`/`start_zone`/`end_zone` ARE in the response. — EXISTS.
  *(Aside: the WHERE filters on naive `start_date` `:32-33`, not `start_at` — fine for tz-3.)*
- **HubCalendar's local `CalendarEvent` interface (`HubCalendar.tsx:32-46`) declares only
  `start_date/end_date/start_time/end_time`** — no `start_at`. — MISSING.
- **The `events.map(...)` to GridEvent (`HubCalendar.tsx:166-185`) carries `startDate`
  (`:171`), `startTime: toClock(e.start_time)` (`:175`), `durationMinutes` (`:177`) — but NOT
  `start_at`/`end_at`/`start_zone`/`end_zone`.** So the instant reaches the API response and is
  **dropped at the map** — identical to the pre-PR-3 `duration_minutes` gap. — MISSING / RISK.
- **CalendarGrid's `CalendarEvent` type (`CalendarGrid.tsx:17-35`)** also has no `start_at`. — MISSING.

**Must be plumbed:** add `start_at`/`end_at` (+ optionally `start_zone`/`end_zone`) to (i)
HubCalendar's interface, (ii) its map, (iii) CalendarGrid's `CalendarEvent` type. (Other
CalendarGrid callers — `hub/page.tsx:440`, `trading/page.tsx:837` — pass their own events;
trip instants only flow through HubCalendar, so only it needs the map change. Trading P&L /
hub events have null `start_at` → naive path, see (c).)

## 3. TripBudgetActual ledger — LEAVE IT (recommendation)
`fmtDate` (`TripBudgetActual.tsx:57-69`), `fmtTime` (`:71-73`), `toDateInput`/`toTimeInput`
(`:86-95`) read the **naive** `homeDate/homeTime/destDate/destTime` from `/budget`. For a flight
the ledger shows **departure in departure-local + arrival in arrival-local** (`00:00 LAX` /
`10:05 Bali`) — which is a *correct and intuitive* ledger semantic (each leg in its own
clock). Forcing both into one anchor would make the ledger *less* readable.
**Recommendation: tz-3 does NOT touch the ledger** — tz-3 is about the **calendar** (one
timeline ⇒ one zone). If a unified-anchor ledger is ever wanted, that's a separate, explicit
decision. — leave (EXISTS, correct-as-is for a ledger).

## 4. `tzMode` — still dead; tz-3 needs NO change to it
Declared `CalendarGrid.tsx:129` (`type TzMode`) + `:266` (`useState`), set by the dropdown
`:461-462`, **read nowhere that affects output** (grep: only those 4 lines). — EXISTS-BUT-UNUSED.
tz-3 hardwires a **const `HOME_ANCHOR = 'America/Los_Angeles'`** and leaves `tzMode` untouched;
**tz-4** later swaps `HOME_ANCHOR` for the `tzMode`-selected zone. Confirmed: **tz-3 = no
`tzMode` change.**

## (b) INSTANT-AVAILABLE CHECK — what must be plumbed
- API response: `start_at` present (`SELECT *`, `calendar/route.ts:30`). ✅
- HubCalendar interface (`:32-46`): **missing** → add `start_at`/`end_at`/`start_zone`/`end_zone`.
- HubCalendar map (`:166-185`): **drops them** → add to the GridEvent object.
- CalendarGrid type (`:17-35`): **missing** → add the fields.
- Then `getBlocksForDay` (`:156, 185-207`) + `eventsByDateKey` (`:290-307`) can read `event.start_at`.
This is the same plumbing pattern PR-3 used for `duration_minutes` — REUSABLE approach.

## (c) FALLBACK RISK — the one decision tz-3 must define
Old rows + **every non-flight event** (hotels, transfers, operations, routines, trade P&L)
have **null `start_at`** (no backfill; only flight commits write it). So the render needs a
defined null-instant behavior.

- A **"⚠" marker** (like the duration-null policy) is **WRONG here** — duration-null was
  *flight-specific and expected*; `start_at`-null is *legitimate for the majority of events*.
  Flagging them all would be noise.
- **Recommended (institutional bar): a clean dual-path, gated EXPLICITLY on
  `event.start_at != null`** — when present, render from `instantToZoned(start_at, anchor)`
  (anchor-correct); when null, render the **existing naive path unchanged** (the pre-tz-3
  behavior, correct for same-zone events). This is **not a silent catch-and-default** — it's a
  strict presence gate (`if (event.start_at)`), documented as "instant-path for zoned events,
  naive-path for the rest." No try/catch swallow; if `start_at` is present but
  `instantToZoned` throws, let it throw (bad data, surfaced).
- **Visibility:** the gate is in code, not the UI. If Alex wants the *distinction* visible, the
  honest minimal signal is on **cross-zone** rows only (`start_zone !== HOME_ANCHOR`) — but that
  is a UI choice, not required for correctness. **Flag for decision: marker on cross-zone
  blocks, or none?**

---

## Recommended atomic PR sequence for tz-3

1. **PR-tz-3a — plumb instant to the grid (SMALL).** Add `start_at`/`end_at`/`start_zone`/
   `end_zone` to: HubCalendar's `CalendarEvent` interface (`:32-46`), its `events.map`
   (`:166-185`), and CalendarGrid's `CalendarEvent` type (`:17-35`). **No render change** — the
   fields just ride along (invisible, like PR-3's duration plumb step). Independently shippable.
2. **PR-tz-3b — render geometry/keys/label from the instant (MED-LARGE).** Add
   `const HOME_ANCHOR = 'America/Los_Angeles'`. In `getBlocksForDay` (`:156` startMin, `:185-207`
   arrival label) and `eventsByDateKey` (`:290-307` day-keys): when `event.start_at` is present,
   derive the clock/day from `instantToZoned(start_at/end_at, HOME_ANCHOR)`; else keep the naive
   path (the (c) gate). This fixes the week/day positioning + the geometry↔label disagreement.
   The keystone PR.
3. **(Not tz-3)** Ledger untouched; `tzMode` wired in **tz-4** (swap `HOME_ANCHOR` → selected
   zone). The (c) cross-zone marker, if wanted, is a tiny add to 3b or its own PR.

*Do not implement — audit only.*
