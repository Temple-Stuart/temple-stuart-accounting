# Flight Timezones Audit — cross-zone flights render the wrong (ballooned) duration

**Scope:** read-only audit. A LAX→DPS flight (depart 00:00 LAX, arrive 10:05 next day Bali)
renders as a **~34h** block instead of its true **19h 05m**, because depart and arrive times
are in different zones (~15h apart) but the calendar plots both on ONE naive local timeline.
Map the zone/duration data from Duffel → commit → DB → calendar, and what's missing. **No
code changed.**

**Headline:** the **true duration is already in our hands and thrown away.** Duffel returns
`slice.duration` (`PT19H5M`) and `parseOffer` already computes `durationMinutes` — but the
commit payload **doesn't send it**, so nothing downstream stores it, and the calendar
reconstructs the span from two **naive, zone-less** local times (`00:00` LAX + `10:05` Bali)
across two dates → 34h. We also **capture the airport IATA but drop the airport time_zone**,
and the **"Trip Local" dropdown is dead UI** (set, never read). The cleanest fix stores the
duration and renders block-length from it — small, no timezone library.

---

## 1. What Duffel gives us (the source)

`parseOffer` in `src/lib/duffel.ts:274-325`:
- **Authoritative duration — CAPTURED then dropped downstream.** `slice.duration` is ISO-8601
  (`PT19H5M`); parsed at `duffel.ts:287-291` into `durationFormatted` ("19h 5m") and
  **`durationMinutes`** (`hours*60 + mins`, `:307`). **This is the truth for block length**
  and it already exists on the parsed offer (`FlightOffer.outbound.durationMinutes`,
  `FlightPickerView.tsx:30`).
- **Local times — offset stripped.** `departing_at` / `arriving_at` are read with
  `.substring(11,16)` → `localTime` ("00:00", "10:05") and `.substring(0,10)` → `date`
  (`duffel.ts:297-304`). Duffel's `departing_at` is the airport-LOCAL time (the zone offset
  is **not** in the captured "HH:MM"); the offset/zone lives on the airport object.
- **IATA — captured; time_zone — DROPPED.** `origin.iata_code` / `destination.iata_code`
  are kept (`:295, 301, 316, 320`), but the airport's **`time_zone`** (Duffel provides e.g.
  `"America/Los_Angeles"` on the airport) is **never read**. So we have the airport codes but
  not their zones.

**Net:** Duffel hands us (a) the exact elapsed duration and (b) IATA + (uncaptured) airport
time zones. We currently keep only naive local "HH:MM" + IATA, and we drop both the duration
(downstream) and the zone.

## 2. What we store (the commit)

**Client payload** (`src/components/trips/PublicFlightSearch.tsx:157-176`): on Save-to-trip
it sends `startTime = offer.outbound.departure.localTime` ("00:00", LAX-local),
`endTime = offer.outbound.arrival.localTime` ("10:05", Bali-local), and
`arriveDate = offer.outbound.arrival.date` ("2026-07-02", Bali-local). **It does NOT send
`durationMinutes`** (which it has on the offer) **nor any zone/IATA.**

**`vendor-commit` flight branch** (`src/app/api/trips/[id]/vendor-commit/route.ts:260-271`):
writes `trip_itinerary` with `homeTime = startTime` ("00:00") and `destTime = endTime`
("10:05"), `homeDate = start` (Jul 1), `destDate = flightArriveDate` (Jul 2) — all **naive
local strings/dates**. The calendar INSERT (`:343-348`) sets `start_time = startTime`,
`end_time = endTime` (still naive). **No zone, no offset, no duration, no IATA is stored
anywhere.**

**Schema** — there is **no** zone/offset/duration/IATA column:
- `trip_itinerary` (`prisma/schema.prisma:646-684`): `homeTime`/`destTime` are
  `String VarChar(10)`; `block_start_time`/`block_end_time` are `@db.Time(6)`. All naive.
- `calendar_events` (`prisma/schema.prisma:1325-1352`): `start_date`/`end_date` `@db.Date`,
  `start_time`/`end_time` `@db.Time(6)`. **No tz.**

## 3. How the calendar plots it (the render)

`getBlocksForDay` (`src/components/shared/CalendarGrid.tsx:142-172`) plots a multi-day timed
event as a **departure block on the start day** (`startMin → end-of-day`) and an **arrival
block on the end day** (`0 → endMin`), with the in-between span treated as continuous on one
**naive local timeline**. For this flight: start `00:00` Jul 1, end `10:05` Jul 2 →
the rendered span is `(1440 − 0)` + `(605)` ≈ **34h05m**, not 19h05m. The grid has **no zone
awareness** — `start_time`/`end_time` are `@db.Time(6)` with no offset, so `00:00 LAX` and
`10:05 Bali` are placed as if the same zone. **Confirmed: this is the ballooning mechanism.**

**The "Trip Local / Home (PST)" dropdown is DEAD UI.** `tzMode` is declared
(`CalendarGrid.tsx:228`) and bound to the `<select>` (`:405-406`, rendered `:398-407`) but is
**read nowhere else** — it performs **no** time conversion. There is **no existing tz
handling** to build on.

---

## 4. The options (how to account for zones)

### (A) Store the true DURATION + render depart-time + duration — RECOMMENDED
- **Why it's cleanest:** Duffel already gives `slice.duration` and `parseOffer` already
  computes `durationMinutes`; the client already has it on the offer. Nothing to derive.
- **Capture:** add `durationMinutes` to the commit payload (`PublicFlightSearch.tsx:157-176`
  → include `offer.outbound.durationMinutes`).
- **Store:** add a nullable `duration_minutes Int?` to `trip_itinerary` **and**
  `calendar_events`. **→ small migration (additive, nullable).**
- **Render:** for a flight, draw the block from `start_time` spanning `duration_minutes`
  (height = duration), splitting across midnight by **duration**, not by the naive
  `end_time`. A 00:00 depart + 19h05m → a single `00:00→19:05` block on the depart day
  (origin-local). Keep `end_time`/`destDate` only for the **arrival label** ("arr 10:05 DPS").
- **Needs:** the payload field + a 2-column migration + a small `getBlocksForDay` branch
  (prefer duration when present). **No timezone library.** Gives a TRUE-length block.

### (B) Store zone-aware timestamps + convert to one display zone
- **Capture:** keep the full offset on `departing_at`/`arriving_at` (stop substringing) OR
  capture each airport's `time_zone` (available on the Duffel airport object).
- **Store:** zone/offset columns (or `timestamptz` instead of `@db.Time`) on the itinerary +
  calendar rows. **→ larger migration (column-type change or new offset/zone columns).**
- **Render:** convert both endpoints to ONE display zone (trip/home) and compute the span;
  finally make the dead `tzMode` selector real. **Needs a tz library** (e.g. `date-fns-tz` /
  `luxon`) + IANA zones.
- **Trade-off:** the "correct general" model (handles layovers in third zones, accurate wall-
  clock labels per zone) but a **real build**, not a small fix.

### (C) Store IATA → derive zones → compute
- We already capture IATA. Add an **IATA→IANA** airport-timezone map + a tz library, then do
  (B)'s math. **Heaviest** — it reconstructs what Duffel's `duration` already tells us.

---

## 5. The plan

**Recommendation: Option A now, Option B later if needed.** Duffel literally returns the
elapsed time; the honest, low-risk path is to stop dropping it and render the block from it.
Option B is the right long-term model for precise multi-zone wall-clock display, but it's a
real timezone build (library + migration + the `tzMode` wiring) — not warranted just to fix
the ballooned span.

**Atomic PR sequence (Option A):**
1. **PR-Flight-Duration-Capture** — include `durationMinutes` in the flight commit payload
   (`PublicFlightSearch.tsx`) and write it through `vendor-commit` (flight branch) to a new
   `duration_minutes` column. **Migration:** add `duration_minutes Int?` to `trip_itinerary`
   + `calendar_events` (additive, nullable). Backfill is optional (old flights keep the naive
   render until re-committed).
2. **PR-Calendar-Duration-Render** — in `getBlocksForDay`, when an event has
   `durationMinutes`, draw the block as `start → start + duration` (split across midnight by
   duration), using `end_time`/`destDate` only for the arrival label. Falls back to the
   current start→end behavior when duration is absent (hotels, manual lines, old rows).

**Migrations:** Option A = **one small additive migration** (`duration_minutes Int?` on two
tables). Option B = a heavier migration (offset/zone columns or `timestamptz`).

**Scope notes / honest complexity:**
- **Hotels are unaffected** — a stay is same-zone (check-in/check-out in one locale); the
  15:00/11:00 block math doesn't cross zones.
- **Multi-city trips / future ground transit** across zones would hit the same naive-timeline
  issue; Option A's per-segment duration covers flights, but cross-zone ground legs would
  need the same duration treatment (or Option B) when they're built.
- **Timezones are a known-hard problem.** Option A sidesteps the hard part by trusting
  Duffel's computed elapsed time — that's the small fix. Anything that needs to show the
  *wall-clock* arrival in a chosen zone (and make `tzMode` real) is Option B — the real
  build. Don't conflate the two.

---

### Citation index
- Duffel duration + local times + IATA (time_zone dropped): `src/lib/duffel.ts:287-291,
  295-307, 316-321`; `FlightOffer.durationMinutes` `src/components/trips/FlightPickerView.tsx:30`
- Commit payload (no duration/zone): `src/components/trips/PublicFlightSearch.tsx:157-176`
- vendor-commit flight store (naive times): `src/app/api/trips/[id]/vendor-commit/route.ts:260-271,
  343-348`
- Schema, no tz/duration: `prisma/schema.prisma:646-684` (trip_itinerary), `:1325-1352`
  (calendar_events)
- Naive multi-day plot (the balloon): `src/components/shared/CalendarGrid.tsx:142-172`
- Dead `tzMode` selector: `src/components/shared/CalendarGrid.tsx:228, 398-407`
