# Timezone Model Audit — home-base anchor + live Trip Local toggle (READ-ONLY)

**Mandate:** Truth-first, read-only, every claim cites file:line; uncited = "NOT VERIFIED".
This is the foundation audit for the REAL timezone build — costs are stated honestly. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** Trip-local conversion is **NOT possible from stored data today** — every
date/time is a **naive local string with no zone/offset**, and the airport IANA zone Duffel
provides is **stripped at parse** (`duffel.ts:297-304`) and **never stored**. The `tzMode`
dropdown is **dead** (set, read nowhere). The good news: the repo **already proves native
`Intl` does DST-correct IANA conversion** (`lib/operations/rruleHelpers.ts`), so **no tz
library is needed** — but a capture + a storage migration + a conversion util + a render
rewire are all required. This is a **REAL-BUILD**, ~4–5 atomic PRs, one needing a migration.

---

## PART A — What Duffel actually gives

**1–2. The parse + strip (`src/lib/duffel.ts:293-304`):**
```js
departure: {
  airport: firstSeg?.origin?.iata_code || '',
  airportName: firstSeg?.origin?.name || '',
  localTime: firstSeg?.departing_at?.substring(11, 16) || '',   // chars 11–16 only
  date: firstSeg?.departing_at?.substring(0, 10) || '',          // chars 0–10 only
},
arrival: { ... lastSeg?.arriving_at?.substring(11, 16) ... substring(0, 10) ... }
```
The transform keeps **only `YYYY-MM-DD` (0-10) + `HH:MM` (11-16)** — **everything past char 16
is discarded**. What's LOST: **any offset** in the timestamp string **AND** the airport's
**IANA zone** (`origin.time_zone` / `destination.time_zone` on the raw Duffel airport object
is **never read** — only `iata_code` + `name` are captured, `:295-296, 301-302`). — RISK.

**The raw Duffel `departing_at` literal format: NOT VERIFIED** — there is no example string or
type in the repo, and `.substring()` would strip an offset whether or not one is present. (Per
Duffel's documented model, `departing_at` is a *naive local* ISO with no offset, and the zone
lives on the airport object as `time_zone` — but I cannot cite that from this codebase.)

**3. IANA zone availability:** the repo captures **none** — no `time_zone`/offset/IANA
reference anywhere in `duffel.ts` (grep: zero hits). There is **NO airport→IANA mapping table**
in the repo (grep for `America/…`/`Asia/…` hits only the *operations routine* tz code, not
airports). So enabling trip-local conversion requires **capturing `airport.time_zone` from
Duffel** (if it returns it — verify live) **or** building an **airport-IATA→IANA lookup**. —
MISSING.

---

## PART B — Storage model

**4. Current columns (no zone anywhere):**
- `calendar_events` (`prisma/schema.prisma`): `start_date DateTime @db.Date` (`:1336`),
  `end_date DateTime? @db.Date` (`:1337`), `start_time DateTime? @db.Time(6)` (`:1338`),
  `end_time DateTime? @db.Time(6)`, `duration_minutes Int?`. **No zone/offset column.**
- `trip_itinerary` (`:646-685`): `homeDate DateTime` (`:650`, a *timestamp* — no `@db.Date`),
  `homeTime String? @db.VarChar(10)` (`:651`), `destDate DateTime`, `destTime String? @db.VarChar(10)`,
  `block_start_time/end_time @db.Time(6)` (`:671-672`), `duration_minutes Int?`. **No zone/offset
  column.** — confirmed: everything naive.

**5. Anchor-storage options (institutional bar):**

| Option | What | Migration cost | Write-sites changed |
|---|---|---|---|
| (i) **UTC instant + zone** | add `start_at`/`end_at` **`timestamptz`** (the UTC anchor) + `start_zone`/`end_zone` **IANA** to both tables; keep naive cols for back-compat | **MED** — additive nullable ALTER (Alex psql); old rows stay null (no zone to backfill) | vendor-commit (compute UTC from naive+zone), calendar INSERT, PATCH save |
| (ii) keep naive + add zone col | leave `start_date/start_time`; add `start_zone`/`end_zone` only; "anchor" = each endpoint's own local | **LOW** — 2 nullable cols | capture zone at commit |
| (iii) trip-wide single zone | one `home_zone` on the trip + per-event source zone | MED — but conflates trip-level + event-level | commit + every render |

**Recommendation — (i): a true UTC instant (`timestamptz`) as the single anchor + an IANA
`zone` per endpoint, ADDED alongside the existing naive columns (nullable, no drops).** UTC is
the unambiguous "one home-base anchor"; the IANA zone drives trip-local rendering; keeping the
naive columns means old rows and non-flight events keep working untouched. **Migration: additive
`ALTER ADD COLUMN` (Alex via psql)** — `start_at timestamptz, end_at timestamptz, start_zone
text, end_zone text` on `calendar_events` and `trip_itinerary`. **Backfill of pre-existing rows
is impossible** (no stored zone → can't compute the true instant) → leave null; they render with
today's naive path. — REAL-BUILD (additive, safe).

---

## PART C — The conversion layer

**6. tz library:** **NONE** in `package.json` (no luxon / date-fns-tz / dayjs / moment — grep
empty). Only native `Date` + `Intl`. **REUSABLE / decisive:** the repo **already does
DST-correct IANA conversion with native `Intl`** — `lib/operations/rruleHelpers.ts`
(`shiftFloatingToZone(d, timezone)`, `:143-180+`; comment `:131-145`: *"interpreted in the given
IANA timezone … Intl.DateTimeFormat … handles DST correctly"*). So **native `Intl` SUFFICES — no
library warranted.** (luxon/date-fns-tz give nicer ergonomics but add bundle weight the repo has
already shown unnecessary.) **Pick: native `Intl`, generalizing the rruleHelpers pattern.**

**7. Conversion util — MISSING.** No `lib/time.ts`/datetime util exists (`ls src/lib` — only the
new `money.ts`). It should live at **`src/lib/time.ts`** and expose, built on
`Intl.DateTimeFormat({ timeZone })`:
- `zonedToInstant(date: 'YYYY-MM-DD', time: 'HH:MM', ianaZone): Date` — wall-clock in a zone →
  true UTC instant (the **commit/save** direction; seed: rruleHelpers `shiftFloatingToZone`).
- `instantToZoned(instant: Date, ianaZone): { date: 'YYYY-MM-DD', time: 'HH:MM' }` — UTC →
  wall-clock in the target zone (the **render** direction).
- `formatInZone(instant, ianaZone, opts)` — display string in a chosen zone.
— MISSING (REUSABLE basis exists in rruleHelpers).

---

## PART D — Every naive site the toggle must route through

**8. `tzMode` — EXISTS-BUT-UNUSED (dead):** declared `CalendarGrid.tsx:129` (`type TzMode`) +
`:266` (`const [tzMode, setTzMode] = useState<TzMode>('local')`); **set** by the dropdown
`:461-462` (`value={tzMode} onChange={… setTzMode …}`); **read nowhere that affects output**
(grep returns only those 4 lines). The "Trip Local / Home (PST)" selector does nothing.

**9. Blast radius — every date/time render/parse site (all assume NAIVE LOCAL today):**

| Site | file:line | Today | Must change |
|---|---|---|---|
| Duffel capture | `duffel.ts:297-304` | strips zone → naive | capture `airport.time_zone` per endpoint |
| Commit write | `vendor-commit` (`route.ts:231,345,354-359`) | `new Date(naive)` (UTC-midnight) + naive `::time` | write `*_at` instant + `*_zone` |
| `parseDate` | `CalendarGrid.tsx:109-112` | Y-M-D → local Date | parse anchor instant, not naive string |
| `dateToKey` | `CalendarGrid.tsx:114` | local components | key in the *display* zone |
| `timeToMinutes` | `CalendarGrid.tsx:116-119` | naive HH:MM | minutes in display zone |
| `formatTime12h` | `CalendarGrid.tsx:121` | naive HH:MM | format in display zone |
| `getBlocksForDay` | `CalendarGrid.tsx:145-211` | geometry from naive start/end + parseDate keys | geometry from instants → display zone |
| `eventsByDateKey` | `CalendarGrid.tsx:295-…` | naive day-keys | day-keys in display zone |
| headers / nav | `CalendarGrid.tsx:236-237, 355-364` | `now`/`weekDays`/`headerTitle` local | render in display zone |
| `toClock` | `HubCalendar.tsx:51-56, 175-176` | extracts naive HH:MM from `@db.Time` | derive from instant + zone |
| ledger `fmtDate`/`fmtTime` | `TripBudgetActual.tsx:57-71` | naive Y-M-D / raw HH:MM | render in display zone |
| ledger edit `toDateInput`/`toTimeInput` | `TripBudgetActual.tsx:86-93` | UTC slice / raw | seed input from instant + zone |
| PATCH save | `itinerary/[itineraryId]/route.ts:35-61` (`parseDayUtc`/`parseLedgerTime`) | UTC-midnight / naive HH:MM | save edited wall-clock back to instant + zone |

— all RISK (naive); the toggle must route each DISPLAY site through `lib/time.ts` with the
event's stored zone + the `tzMode` target (home vs trip-local).

---

## (a) IS TRIP-LOCAL CONVERSION POSSIBLE FROM STORED DATA TODAY?

**NO — this is the gating finding.** Stored data is naive local with **no zone/offset** on
`calendar_events` or `trip_itinerary` (Part B), and the Duffel zone is stripped at
`duffel.ts:297-304` (Part A). You cannot convert depart-local ↔ trip-local without knowing each
endpoint's IANA zone. **What must be captured FIRST:** the **IANA timezone per endpoint** —
ideally `airport.time_zone` from the Duffel airport object (verify live that Duffel returns it);
if it does not, build an **IATA→IANA airport lookup** (none exists in repo). Until a zone is
stored, every "Trip Local" render is impossible — the toggle has nothing to convert with.

## (b) STORAGE DECISION

**Add a true UTC-instant anchor + an IANA zone, additively.** Migration (Alex, psql):
```sql
ALTER TABLE calendar_events ADD COLUMN start_at timestamptz, ADD COLUMN end_at timestamptz,
  ADD COLUMN start_zone text, ADD COLUMN end_zone text;
ALTER TABLE trip_itinerary  ADD COLUMN start_at timestamptz, ADD COLUMN end_at timestamptz,
  ADD COLUMN start_zone text, ADD COLUMN end_zone text;
```
Nullable, additive, **no column drops** (naive cols stay for back-compat + non-flight events).
New flight commits populate them; **old rows stay null and render via the existing naive path**
(no fake backfill). **Honest cost: REAL-BUILD migration**, but low-risk because additive.

## (c) LIBRARY DECISION

**Native `Intl` — no new dependency.** Justification: the repo already runs DST-correct IANA
conversion on `Intl.DateTimeFormat` (`rruleHelpers.ts:131-180`); adding luxon/date-fns-tz would
be bundle weight for capability already proven present. Generalize `shiftFloatingToZone` into a
small `lib/time.ts`.

## (d) BLAST RADIUS (ordered, tagged)

1. `duffel.ts` capture zone — **SMALL** (read `airport.time_zone`) … **LARGE if** Duffel lacks it
   (needs an IATA→IANA table).
2. `vendor-commit` + `FlightPicker`/`PublicFlightSearch` payload — write `*_at`/`*_zone` — **MED**.
3. Migration (Alex psql) — **MED** (additive).
4. `lib/time.ts` conversion util — **SMALL-MED** (reuse rruleHelpers).
5. `CalendarGrid` (parseDate/dateToKey/timeToMinutes/formatTime12h/getBlocksForDay/
   eventsByDateKey/headers) — **LARGE** (the core render rewire) + wire `tzMode`.
6. `HubCalendar.toClock` + map — **MED**.
7. `TripBudgetActual` fmt/edit + PATCH save route — **MED**.

---

## Recommended atomic PR sequence (the whole tz build)

> Each PR is one concept, independently shippable + revertible. PRs 1–4 add data/util with **no
> visible change**; PR 5 flips the toggle live.

1. **PR-tz-0-airport-zone-capture** — **REAL-BUILD (SMALL if Duffel gives `time_zone`, else
   LARGE).** Capture `origin.time_zone`/`destination.time_zone` at `duffel.ts` parse; thread
   through the commit payload (`FlightPicker`/`PublicFlightSearch` → `vendor-commit`). **GATING** —
   if Duffel doesn't return it, this PR is instead an **IATA→IANA lookup table** first. No
   migration yet (just stops stripping + carries the zone).
2. **PR-tz-1-storage** — **REAL-BUILD + MIGRATION (Alex psql).** Add `start_at/end_at timestamptz`
   + `start_zone/end_zone text` (nullable, additive) to `calendar_events` + `trip_itinerary`;
   `vendor-commit` computes the UTC instant from naive+zone and writes both. Old rows stay null.
3. **PR-tz-2-conversion-util** — **SMALL-MED.** `src/lib/time.ts` (`zonedToInstant`,
   `instantToZoned`, `formatInZone`) built on native `Intl`, reusing the rruleHelpers pattern.
   Pure, unit-testable, no UI change.
4. **PR-tz-3-render-home-anchor** — **REAL-BUILD (LARGE).** Make all DISPLAY sites
   (CalendarGrid geometry/labels/headers, HubCalendar `toClock`, TripBudgetActual fmt/edit) read
   the stored instant + render via `lib/time.ts` in the **home zone** (default). Still no toggle —
   just correctness from the anchor. Falls back to naive for null-zone (old) rows.
5. **PR-tz-4-trip-local-toggle** — **MED.** Wire `tzMode` ('home' | trip-local) to switch the
   display zone passed to `lib/time.ts` across the same sites; make the dead dropdown live. PATCH
   save (`itinerary` route) round-trips edits through the zone.

**Migration flag:** only **PR-tz-1** needs Alex to run `ALTER` via psql (additive, nullable).

*Do not implement — audit only.*
