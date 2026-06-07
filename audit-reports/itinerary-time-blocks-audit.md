# Itinerary-as-Time-Blocks — Readiness Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-itinerary-time-blocks`
**Scope:** Read-only. No application code modified. Only this report was created.
**Method:** Every claim cites `file:line`. Anything not read is **NOT VERIFIED**. Findings only; suggestions last.

> **Bottom line:** The CE-8B timeline (`useDayFeed`) already merges **two** cross-entity sources
> (routine scenes + task blocks) into one `TimelineRow[]` ordered by a `DAY_START=04:00` comparator —
> adding travel as a third source is a **union-extension + one cross-entity fetch**, not a rewrite.
> The codebase already has **both** recurrence patterns the target needs: DAILY ≈ the **scene**
> pattern (a stable template row shown on every day, no per-day rows, no fabricated expense), ONCE ≈
> the **calendar-block** pattern (one dated row). The gaps are all on the **trip side**: `trip_itinerary`
> has **no recurrence flag, no COA-account column, no `@db.Time` window, and one shared name field**
> (Activity vs Vendor); there is **no Travel entity** and `budget_line_items`/`trips` carry **no
> `entity_id`**; and the multi-day lodging commit currently **does the opposite of the target** —
> it stores N per-day `trip_itinerary` rows with *amortized* cost.

---

## A. SCHEMA GAP TABLE — capture field → column / MISSING

**`trip_itinerary` columns** (`prisma/schema.prisma:641-667`): `id` cuid (`:642`), `tripId` (`:643`), `day Int` (`:644`), `homeDate DateTime` (`:645`), `homeTime String? @db.VarChar(10)` (`:646`), `destDate DateTime` (`:647`), `destTime String? @db.VarChar(10)` (`:648`), `category VarChar(50)` (`:649`), `vendor VarChar(255)` (`:650`), `cost Decimal(12,2)` (`:651`), `note` (`:652`), `splitNames` (`:653`), `splitBy` (`:654`), `perPerson` (`:655`), `location VarChar(255)` (`:656`), `verticalDrop/avgSnow` (`:657-658`), `vendorOptionId VarChar(100)` (`:659`), `vendorOptionType VarChar(20)` (`:660`), `createdAt` (`:661`).

| Target capture field | Existing column | Status |
|---|---|---|
| **Activity** (item name) | `vendor` `VarChar(255)` (`:650`) — but this is the *only* name field (commit writes `vendor: details.title`, `vendor-commit/route.ts:264`) | **PARTIAL / conflated** — see Vendor |
| **Location** | `location` `VarChar(255)` (`:656`) | **EXISTS** |
| **COA account** | none on `trip_itinerary`; COA lives on `budget_line_items.coaCode VarChar(20)` (`schema.prisma:1027`), derived server-side from `category` | **MISSING** (no account column/FK on the itinerary row; D) |
| **Vendor** (distinct from Activity) | only `vendor` exists — same column the item name uses | **MISSING** (one name field; Activity≠Vendor not separable) |
| **Price** | `cost Decimal(12,2)` (`:651`) | **EXISTS** (but per-row *amortized* for multi-day — E) |
| **Time Start** | `homeTime String? @db.VarChar(10)` (`:646`) | **PARTIAL** — free-text string, **not `@db.Time`** (gotcha, B) and semantically "home/departure" time |
| **Time End** | `destTime String? @db.VarChar(10)` (`:648`) | **PARTIAL** — "dest/arrival" time, VarChar |
| **Date(s)** | `homeDate`/`destDate DateTime` (`:645,647`) + `day Int` (`:644`) | **EXISTS** (range expressed as per-day rows) |
| **recurrence (once/daily)** | none | **MISSING** (no recurrence/class flag) |
| **daily time window** (start/end *time-of-day* distinct from the date range) | `homeTime`/`destTime` exist but are tied to each per-day row's date and are VarChar, not a reusable daily window | **MISSING as a concept** |

**`@db.Time` gotcha:** the Operations timeline parses time via `minuteOfDayFromTime`, which matches the Prisma `@db.Time` serialization `T(\d{2}):(\d{2})` (`src/lib/content/dayOrder.ts:30-35`). `trip_itinerary.homeTime`/`destTime` are `VarChar(10)` (e.g. `"09:00"`, no `T` prefix) — they would **not** match that regex. The Operations time columns are `@db.Time(6)` (`operations_routine_steps.time_of_day`, `schema.prisma:2838`; `operations_routines.start_time/end_time`, `:2814-2815`).

**Readers/writers a schema extension must respect:**
- **Writers:** `vendor-commit/route.ts` itinerary `create` (transfer `:230-237`, flight `:243-251`, multi-day `:260-267`); `commit/route.ts` (legacy whole-trip commit). `trip_itinerary` is also **deleted** by `vendor-commit` DELETE (`:354-356`).
- **Readers:** `GET /api/trips/[id]/itinerary` (`itinerary/route.ts:17-22`), `GET /api/trips/[id]/route.ts` (trip include), and the page transform `budgets/trips/[id]/page.tsx:430-474` → `CalendarEvent[]` → `ItineraryAgenda`/`CalendarGrid`. The uncommit reads `vendorOptionId` (string match). Any new column must not break the `CalendarEvent` transform.

---

## B. THIRD-SOURCE CONTRACT — exact shape CE-8B needs (cited)

**The merge** (`src/components/workbench/operations/content/useDayFeed.ts`):
- `TimelineRow` is a discriminated union: `{ kind: 'scene'; minute: number|null; order: number; scene } | { kind: 'task'; minute; order; block }` (`:108-110`).
- The timeline is built by mapping scenes + tasks into that shape and `rows.sort(compareDayOrder)` (`:296-308`). Scenes get `minute = minuteOfDayFromTime(routine_step.time_of_day)` (`:300`); tasks get `minute = minuteOfDayFromInstant(start)` (`:269`).
- **Ordering** `compareDayOrder` (`dayOrder.ts:58-69`): timed rows by **day-anchored minute** (`<04:00 → +1440`, `:22-24`); untimed rows sink by `order`; tie-break `scene` before `task` (`:65-67`). The `DayOrderRow.kind` type is currently `'scene' | 'task'` (`dayOrder.ts:50`).

**To join as a third source, a travel loader must produce rows of shape:**
```
{ kind: 'travel'; minute: number | null; order: number; block: <travel payload> }
```
…pushed into the `rows` array alongside scenes/tasks (`useDayFeed.ts:296-305`), with `minute` computed by `minuteOfDayFromTime` (if a `@db.Time`/`HH:MM` window) or `minuteOfDayFromInstant` (if a timestamptz). **`compareDayOrder` would need a tie rule for `'travel'`** (the `kind` union at `dayOrder.ts:50` is `'scene'|'task'` today — extending it is required for deterministic ties).

**Cross-entity already:** `useDayFeed.load()` fetches `/content/grid` + `/operations/projects` with **no entity filter** (`:152-155`), and `loadBlocks()` fetches `/daily-plan/items?from&to` with no entity filter (`:175-187`); both are commented "CROSS-ENTITY … regardless of entity" (`:146-147,202,236`). A travel loader would add a **4th cross-entity fetch** (e.g. trip blocks for `date`) and a `useEffect` mirroring `loadBlocks` (`:192-200`). The hook is keyed to a single `date` (`useDayFeed(date)`, `:137`) — so the travel read must return **that day's** blocks: ONCE items filtered to the date; DAILY items emitted when `date ∈ [trip.start, trip.end]`.

**What the current trip render is (vs this):** `ItineraryAgenda` (`src/components/trips/ItineraryAgenda.tsx`) consumes `CalendarEvent[]` (the trip page transform, `:19,22-23`), **not** `TimelineRow`. So an Operations-style render either (a) replaces `ItineraryAgenda` with the Operations `DayCalendar`/`DailyLog` fed a travel source, or (b) keeps `ItineraryAgenda` but it stays on the `CalendarEvent` shape — the two shapes are different (E/section 7).

---

## C. RECURRENCE PATTERN — how the codebase does it today (the pattern to follow)

**Three distinct mechanisms exist; the timeline uses the first two:**

1. **Scene pattern = "template row shown on every day" (this is the DAILY analog).** In `useDayFeed`, `dayScenes` is **ALL active scenes, unfiltered by date** — `(scenes ?? []).sort(step_order)` (`useDayFeed.ts:203-209`); they are rendered on **every** day's timeline. A routine step maps to exactly **one** stable `operations_content_scenes` row (`@unique(routine_step_id)`), created once via upsert — **no per-day scene rows, no RRULE in the timeline.** → DAILY travel items should follow this: one row, rendered on each in-window day, no per-day duplication, no per-day expense.

2. **Calendar-block pattern = "one dated row per occurrence" (this is the ONCE analog).** `operations_calendar_blocks` store **absolute** `scheduled_start/scheduled_end @db.Timestamptz(6)` (`schema.prisma:2744-2745`), one row per block, date-filtered via `daily-plan/items?from&to`. The task timeline rows come one-per-block (`useDayFeed.ts:264-289`). → ONCE travel items (cafe, flight) = one dated row.

3. **RRULE expansion = READ-TIME, not in the timeline.** `operations_routines.schedule_rrule String @db.Text` (`:2803`) is expanded **at read time** by `expandBetween(r.schedule_rrule, r.timezone, start, end)` (`routines/today/route.ts:140`, helper `src/lib/operations/rruleHelpers.ts:161`, using the `rrule` npm lib `:16`) — for the **today-strip / completions**, **not** the content-day timeline. **No stored per-day rows are ever created from a routine.**

**Verdict:** the existing precedent for "daily" on the timeline is **a stable template rendered every day (scene pattern), not per-day rows and not RRULE expansion**. This matches the target's DAILY-item requirement exactly. **The current trip lodging commit diverges from this** (D/E): it physically stores **N per-day `trip_itinerary` rows** with amortized cost (`vendor-commit/route.ts:252-271`), which is neither the scene pattern nor the target ("no fabricated per-day expense rows").

---

## D. COA + ENTITY WIRING — exists / missing

**COA assignment (server-side only):**
- `budget_line_items.coaCode String @db.VarChar(20)` (`schema.prisma:1027`) — a **plain string**, **no FK** to `chart_of_accounts`, **no `entity_id`** on the row (`:1022-1043`).
- Derived in `vendor-commit/route.ts`: `VENDOR_TYPE_TO_COA` map (`:9-15`, flight 9100 / lodging 9200 / vehicle 9300 / transfer 9600 / activity 9400) + `getCOACode(category)` (`travelCategories.ts:82-84`) + `TRAVEL_COA` registry (`travelCOA.ts`), with the `P-`/`B-` prefix from `trip.tripType` (`vendor-commit/route.ts:163,204`). Personal-only categories are blocked on Business trips (HTTP 422, `:134-139`).
- **No COA account-selector UI in the trips flow** — `PlaceCommitForm`/`AddToTripButton`/`FlightPicker` pass only `category`/`optionType`; the server derives the code. The only account-table UI is `COAManagementTable` (bookkeeping admin, reads `/api/chart-of-accounts`), **not** wired to trips. → **a "pick COA account" capture field is MISSING.**

**Entity wiring:**
- `trips` has **no `entity_id`** — only `tripType TripType` (`personal|business|mixed`) (`schema.prisma:515-559`).
- `budget_line_items` has **no `entity_id`** (`:1022-1043`) — user-scoped only.
- The Trading module finds its entity by `entity_type === 'trading'` (`trading/page.tsx:204`); **no `entity_type === 'travel'` exists** anywhere. → the target "Travel entity on Hub" is **MISSING** (neither the entity nor the trip→entity / budget→entity links exist).

---

## E. COMMIT-PATH DELTAS — per route, fields to add

**What each path writes today (time + recurrence):**
- **`vendor-commit` POST** (`vendor-commit/route.ts`): writes `day`, `homeDate`, `homeTime: startTime || null`, `destDate`, `destTime: endTime || null`, `cost`, `vendor`, `location`, `vendorOptionId/Type` — transfer (`:230-237`), flight (`:243-251`), **multi-day loop** (lodging/vehicle/activity, `:258-270`, `cost = details.amount / totalDays` amortized `:256`). **No recurrence flag; no class (once/daily); time is the same `startTime/endTime` stamped onto every per-day row.**
- **`PlaceCommitForm`** (Google place, ONCE): sends `optionType:'activity'`, `startDate/endDate`, `startTime/endTime`, `synthetic`, `notes: placeName` (`PlaceCommitForm.tsx:48-59`). Adequate for a ONCE block; **no recurrence field** for DAILY.
- **`AddToTripButton`** (hotel, DAILY in target): sends `optionType:'lodging'`, `synthetic`, `startDate/endDate`, `amount: rec.price` (whole-stay), and folds **per-night detail into a free-text `notes` string** `"$${perNight}/night · ${nights} nights · hotel:${id}"` (`AddToTripButton.tsx:65-69,79-82`). **The structured `perNight`/`nights` are NOT stored as columns.**
- **`activities` create** (`activities/route.ts:39-52`): writes `category/title/vendor/url/image_url/price/is_per_person/per_person/notes` — **no time/date fields** (those arrive at `vendor-commit`).

**Where the `$51/night × 28` data lives at commit time:** the detail page reads `nights = rec.nights`, `perNight = rec.pricePerNight`, `stayTotal = rec.price` (`discover/[category]/[rank]/page.tsx:212-214`), sourced from the LiteAPI mapper fields (`liteapiClient.ts` `nights`/`pricePerNight`/`price`) inside `trip_scanner_results.recommendations` JSON. At commit these become a **single `amount` (whole-stay total)** + a **notes string**; per-night is **display-only** (matches the target's "stored commitment = single real transaction"). **Delta to capture for the timeline:** to drive a per-day DAILY block + honest amortization display, `nights`/`pricePerNight` would need to be **structured fields** (today they survive only inside the `notes` string), and a **recurrence/class flag** + a **daily time window** must be added (none exist).

**Per-class deltas:**
- **ONCE:** essentially supported (single dated row + start/end time) — needs only an explicit `recurrence='once'` marker so the loader can classify.
- **DAILY:** needs (1) a `recurrence='daily'` flag, (2) a **daily time-of-day window** (`@db.Time`, distinct from the date range — e.g. gym 08:00–10:00, hotel 22:00–07:00), (3) the financial rule to stay a **single** `budget_line_items` row (already single) **without** the N amortized per-day `trip_itinerary` rows (`:252-271`) if following the scene "template, not per-day rows" pattern.

---

## F. MIGRATION SURFACE — tables needing ALTER (for the migration-before-merge plan)

Facts on what currently lacks the target's columns (Alex runs the migrations):

1. **`trip_itinerary`** (`schema.prisma:641-667`) — to carry the capture surface:
   - ADD a **recurrence/class** column (`once` | `daily`) — **MISSING** (A).
   - ADD a **daily time-of-day window** as `@db.Time(6)` to match `minuteOfDayFromTime` (`dayOrder.ts:30`) — current `homeTime/destTime` are `VarChar(10)` (A, B). (Either new columns or a type change — both are migrations.)
   - ADD a **COA-account** column if the itinerary row (not just `budget_line_items`) must hold it — **MISSING** (D).
   - ADD a **Vendor** field distinct from the item name (Activity), since `vendor` is the single name field — **MISSING** (A).
   - Optionally ADD structured **`nights`/`price_per_night`** if amortization display must be data-driven rather than parsed from `notes` (E).
2. **`budget_line_items`** (`:1022-1043`) — ADD `entity_id` if expenses must book to a Travel entity (none today, D).
3. **`trips`** (`:515-559`) — ADD `entity_id` if a trip must bind to a Travel entity (none today, D).
4. **`entities`** — likely a **data** change (a per-user `entity_type='travel'` row), not a schema change; `entity_type` is a free `VarChar(20)` (`:68`) so no enum migration is needed. **NOT VERIFIED** that any travel entity exists.
5. **`calendar_events`** — **no ALTER strictly required**: multi-day is already supported via `end_date` and `is_recurring`/`recurrence_rule` columns exist but are **unused** for trips (writers set `is_recurring=false`, `vendor-commit` INSERT). Re-using them for recurring travel blocks is a write-path change, not a migration.

---

## G. ALEX-RUN QUERIES (auditor cannot reach the DB)

```sql
-- 1. Does a 'travel' entity already exist for the user? (D — entity wiring)
SELECT id, entity_type, name FROM entities WHERE "userId" = '<USER_ID>' ORDER BY entity_type;

-- 2. What format are existing itinerary time strings? (A/B — @db.Time gotcha)
SELECT id, day, "homeTime", "destTime", "vendorOptionType", vendor
FROM trip_itinerary WHERE "tripId" = '<TRIP_ID>' ORDER BY day LIMIT 50;

-- 3. How many per-day amortized lodging rows exist today (the divergence in C/E)?
SELECT "vendorOptionId", "vendorOptionType", count(*) AS per_day_rows, sum(cost) AS summed_cost
FROM trip_itinerary
WHERE "tripId" = '<TRIP_ID>' AND "vendorOptionType" = 'lodging'
GROUP BY "vendorOptionId", "vendorOptionType";

-- 4. Confirm one budget row per lodging commit vs N itinerary rows (no fabricated expense)
SELECT "coaCode", description, amount, source FROM budget_line_items
WHERE "tripId" = '<TRIP_ID>' AND source = 'trip' ORDER BY "coaCode";
```

---

## H. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Follow the scene pattern for DAILY, the calendar-block pattern for ONCE** (C). A DAILY travel item = one row + a `@db.Time` window, emitted by the loader on each in-window day (no per-day rows); a ONCE item = one dated row. This matches the target and avoids fabricated per-day expense rows — but note it **reverses** today's lodging behavior (`vendor-commit/route.ts:252-271` stores N amortized rows), so that write path would change.
2. **Add `kind:'travel'` to the timeline union + comparator** (`useDayFeed.ts:108-110`, `dayOrder.ts:50`) and a 4th cross-entity fetch in `useDayFeed` (mirroring `loadBlocks`, `:175-200`). The cross-entity law is already satisfied by the no-entity-filter reads (B).
3. **Use `@db.Time(6)` for any new travel time-of-day column** so `minuteOfDayFromTime` (`dayOrder.ts:30`) consumes it unchanged; `VarChar(10)` strings won't match its `T(HH):(MM)` regex (A/B).
4. **Decide where COA lives** (D): a `trip_itinerary` COA column + a real account-selector (none exists in trips) vs. keeping server-derived `budget_line_items.coaCode`. The target's "COA account" capture field implies user selection, which is **MISSING** today.
5. **Travel entity** (D/F): adding `entity_id` to `trips`/`budget_line_items` and a per-user `entity_type='travel'` entity is the prerequisite for "Travel entity on Hub" and cross-entity timeline loading by entity; none of it exists yet.
6. **Structured nights/price-per-night** (E): if the timeline/expense UI must show honest amortization, capture `nights`/`price_per_night` as columns rather than parsing the `AddToTripButton` `notes` string.

---

*End of audit. No application code was modified; only this report was created.*
