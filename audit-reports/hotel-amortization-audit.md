# Hotel render model + cost amortization across nights (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline (two answers, both reassuring on cost):**
1. **Render model = ALL-DAY** (null `start_time`/`duration_minutes`, spans via stored
   `end_date`) — and that is the **right** model for a hotel (occupancy, not a point event).
2. **Cost is stored ONCE as the whole-stay total — it is NOT amortized and NOT double-counted.**
   The "nights-vs-days divisor" bug the prompt suspects **already existed and was already FIXED**
   (PR-21/PR-33): search nights = `checkout − checkin` (no +1), and the commit writes the
   whole-stay total to one budget row. The remaining issues are **not** cost double-counts but:
   (a) a **render gap** — a multi-day hotel only gets calendar membership on its **check-in +
   check-out days**, so the middle nights are blank (no continuous span); and (b) a **latent
   under-count RISK** in the row-based lodging fallback (`total_price || price_per_night`).

---

## 1. HOTEL COMMIT — where a saved hotel is written

`POST /api/trips/[id]/vendor-commit` (`vendor-commit/route.ts`), `optionType='lodging'`. Two
sub-paths: **synthetic** (detail-page "Add to trip", no DB option row, `synthetic:true`,
`:133`) and **row-based** (planner vendor option). Both land in the same date-range branch.

- **Dates written = check-in → check-out** (the stay window, not the trip span):
  `trip_itinerary`: `homeDate: start` / `destDate: end` where `start = new Date(startDate)`,
  `end = endDate ? new Date(endDate) : start` (`:266-267, 329, 336`). `calendar_events`:
  `start_date = calStart` (`startDate`), `end_date = endDate ? new Date(endDate) : calStart`
  (`:371, 377-379`). — EXISTS (correct window).
- **All-day path CONFIRMED.** For non-flight, `calStartTime = null`, `calEndTime = null`
  (`:380-381`, gated `isFlight = optionType === 'flight'` `:376`), and `durationMinutes` is
  **flight-only** → null for lodging (`:98-100`). So the `calendar_events` row has
  `start_time = null, end_time = null, duration_minutes = null` → the renderer's **all-day**
  branch. — EXISTS.
- The `trip_itinerary` row DOES get a daily clock window (`block_start_time/block_end_time` =
  hotel-standard 15:00/11:00, `:320-325`) and `recurrence='daily'` (`:340`) — but those are
  ledger/future-render fields; the **calendar** row stays all-day (the times are NOT copied to
  `calendar_events.start_time`). — EXISTS (split: itinerary has a window, calendar is all-day).

## 2. AMOUNT WRITTEN — full stay, once

- **Synthetic hotel:** `details.amount = Number(requestAmount || 0)` (`:189`), and the client
  sends `amount = hotel.priceTotal ?? hotel.price` — the **whole-stay total, "not recomputed"**
  (`PublicHotelSearch.tsx:126, 150`). The "$57/night · 30 nights" string is **display-only**,
  built into `notes` (`PublicHotelSearch.tsx:135-139`), never used for budget math.
- **Row-based hotel:** `details.amount = Number(opt.total_price || opt.price_per_night || 0)`
  (`:31`).
- Written to exactly **one** `budget_line_items` row: `amount: details.amount` (`:253-262`), and
  **one** `trip_itinerary` row: `cost: Math.round(details.amount * 100) / 100` (`:337`), and
  **one** `calendar_events` row: `budget_amount: Math.round(result.details.amount)` (`:387`).
- The branch is explicit: *"ONE recurrence-template row, NOT N amortized per-day rows. cost is
  the FULL real amount (no division)… Per-night/per-day display math is the renderer's job…
  never stored."* (`:307-312`). — EXISTS (full amount, single row, no amortization).
- **Night COUNT** for the per-night label comes from the LiteAPI search window
  (`rec.nights`), NOT from the commit (the commit doesn't divide). — EXISTS.

## 3. NIGHTS vs DAYS — the exact subtractions

- **Search nights (the per-night divisor) — CORRECT (nights, no +1):**
  `liteapiClient.ts:328-332`:
  ```
  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.max(0, Math.round((Date.parse(params.checkout) - Date.parse(params.checkin)) / msPerDay)) || undefined;
  ```
  Jul 1 → Jul 2 = `round(1) = 1 night`. Jul 1 → Jul 31 = 30 nights. **No off-by-one.** Per-night
  = `priceTotal / nights` (`:508-513`). — EXISTS (correct).
- **Commit `totalDays` — inclusive DAYS (+1), but NOT a cost divisor:**
  `vendor-commit/route.ts:313`:
  ```
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000*60*60*24)) + 1);
  ```
  Jul 1 → Jul 2 = `1 + 1 = 2`. This is the **inclusive calendar-day count**, and it is used
  **only** for `const isRange = totalDays > 1` (`:314`) → picks `recurrence='daily'` vs `'once'`
  (`:340`). It **never divides or multiplies cost.** So the `+1` is correct for "is this a
  range?" and irrelevant to amortization. — EXISTS (not a cost bug).

## 4. AMORTIZATION DISPLAY — nothing divides the total

- **Stored:** the full total, once (§2). Nothing writes per-day rows.
- **Per-night label** ("$57/night"): `PublicHotelSearch.tsx:136` (`$${hotel.pricePerNight}/night`)
  + `HotelResultsView.tsx:220-237`, where `perNight = hotel.pricePerNight` (= `priceTotal /
  nights`, `liteapiClient.ts:508-513`). The label and total reconcile by construction
  (`discover/.../page.tsx:221-231`). — EXISTS (display-only division, never stored).
- **Calendar bar:** the all-day chip renders **`event.title` only** — no cost, no per-day
  division (`CalendarGrid.tsx:669-679`). — EXISTS (no amortized display).
- A **prior** amortization bug is documented as FIXED: *"`stayTotal` is the whole-stay total
  (rec.price) — it is NOT pricePerNight × nights (that was the double-count bug)"*
  (`discover/.../page.tsx:221-223`). — REUSABLE evidence.

## 5. ALL-DAY RENDER — span via membership, NOT a continuous bar

- **The all-day path:** `allDayEvents = gridDays.map(day => getEventsForDate(day).filter(e =>
  !e.startTime))` (`CalendarGrid.tsx:653-657`) — i.e. an event is "all-day" iff it has **no
  `startTime`** (the hotel case). It renders a **per-day chip** in each day cell
  (`:665-679`) — there is **no colspan / CSS-spanning bar**.
- **The timed path (contrast):** events WITH `startTime` go through `getBlocksForDay`
  (`:704-756`, positioned by minute) — flights only.
- **Multi-day membership — THE GAP:** `eventsByDateKey` pushes a hotel onto its **start day**
  (`:379`) and, in the all-day multi-day branch, its **end day** only:
  ```
  } else if (!e.startAt && e.endDate && e.endDate !== e.startDate) {
    // Legitimate multi-day ALL-DAY event (hotel/lodging, multi-day op) — … index the stored end day.
    pushOn(dateToKey(parseDate(e.endDate)), e);   // :396-399
  }
  ```
  It does **NOT** loop the middle days (only the flight `durationMinutes` branch fills
  in-between days, `:381-395`). So a Jul 1 → Jul 31 hotel is a member of **Jul 1 and Jul 31
  only** — a chip on check-in and check-out, **blank nights between**. The screenshot's "single
  bar spanning the stay" is **not** what this code produces for a long stay (it would for a
  1-night stay, where the two chips are adjacent). — RISK, `CalendarGrid.tsx:396-399` +
  `:665-679`.

## 6. TRIP TOTAL ROLL-UP — summed ONCE, no double-count

- **Ledger total** = a client reduce over `/api/trips/[id]/budget` rows:
  `TripBudgetActual.tsx:266` `const total = items.reduce((s,it)=>s+Number(it.amount||0),0)`.
- That endpoint returns `budget_line_items` **1:1** (`budget/route.ts:25-27, 53-68`), enriched
  with itinerary fields — **one** hotel row → its full `amount` counted **once**. The
  `recurrence='daily'` flag on the linked `trip_itinerary` is surfaced as a label
  (`cadence`, `:65`) and is **never expanded into N rows**. — EXISTS (single count).
- **Calendar per-source total** (`/api/calendar` `calcTotal('trip')`,
  `calendar/route.ts:64-93`) likewise sums the **one** `calendar_events` hotel row once; the
  render-time membership expansion (§5) is client-only and does not touch the API total. —
  EXISTS (single count).
- → The −$2,537 ledger figure is a **correct single sum** of the trip's line items (hotel
  counted once), not a per-night double-count. — EXISTS.

---

## Explicit answers

**(a) Hotel render model TODAY:** **ALL-DAY** — `calendar_events.start_time/end_time/
duration_minutes` are all null for lodging (`vendor-commit:380-381, 98-100`), so it takes
CalendarGrid's all-day chip path (`CalendarGrid.tsx:656, 665-679`), "spanning" via stored
`end_date`. (Caveat: the span is **start-day + end-day chips**, middle days unfilled — §5.)

**(b) Cost — full once or amortized?** **Full stay total, stored ONCE** — `budget_line_items`,
`trip_itinerary.cost`, and `calendar_events.budget_amount` each get the whole amount, no
division (`vendor-commit:260, 337, 387, 307-312`). The **night-count is correct** (nights, not
days): `liteapiClient.ts:329-331` (`checkout − checkin`, no +1).

**(c) The nights-vs-days divisor bug — does it exist?** **Not in the cost path today — it was
already FIXED.** The historical bugs are documented at `discover/.../page.tsx:221-240`: the
old double-count (`pricePerNight × nights`) and the "185-night"/"184-night" span (using
`trip.daysTravel`/trip dates) were replaced by `rec.price` (whole-stay total) + `rec.nights` +
`rec.checkinDate/checkoutDate`. The only surviving `+1` is `vendor-commit:313` `totalDays`, an
**inclusive day count used solely for the `isRange` boolean** (`:314`), never to divide cost —
so it is **not** an amortization off-by-one. **Verdict: no live divisor bug; the suspected one
is already resolved.**

**(d) Does the trip total double-count?** **No — summed once.** Ledger reduce over 1:1
`budget_line_items` (`TripBudgetActual.tsx:266` + `budget/route.ts:25-27`); the `daily`
recurrence is a label, never expanded (§6).

**(e) DESIGN RECOMMENDATION — keep all-day-span.** A hotel is an **occupancy interval**, not a
point-in-time event: you "hold" the room every night, so an all-day band across check-in →
check-out is the honest model. A **timed block** is wrong here — a 30-night stay as a 30×24h
positioned block would be absurd and would collide with the timed-flight lane.
**Tradeoff (honest):** the all-day band loses the check-in 15:00 / check-out 11:00 precision
(which already lives on `trip_itinerary.block_start_time/end_time`, `vendor-commit:320-325`, and
in the ledger) — acceptable, since occupancy is the calendar's job and exact times live in the
ledger/detail. **The real defect to fix is the §5 membership gap**, so the band actually spans
every night instead of showing only two end chips.

**(f) Recommended fix sequence** (each independently shippable):
1. **PR-Hotel-Span-Fill (SMALL).** In `eventsByDateKey` (`CalendarGrid.tsx:396-399`), fill the
   **middle days** of an all-day multi-day event (loop check-in→check-out like the flight
   `durationMinutes` branch does at `:381-395`), so the hotel is a member of every night and the
   all-day row shows a continuous run of chips. Optional polish: a true spanning bar
   (start/middle/end rounding) — MED if pursued. No schema, no cost change.
2. **PR-Lodging-Total-Guard (SMALL).** Harden the row-based fallback
   `Number(opt.total_price || opt.price_per_night || 0)` (`vendor-commit:31`): when
   `total_price` is absent, compute `price_per_night × nights` rather than storing **one night**
   as the whole stay (a latent UNDER-count). Today `LodgingOptions` always sets `total_price`
   (`LodgingOptions.tsx:72, 80`), so this is defensive, not an active bug — RISK only.
3. **(No PR needed for amortization/divisor.)** Cost storage and the night-count are already
   correct (§§2–4, (b)–(d)); do **not** add per-night amortized rows (the audited design
   explicitly stores one honest total — `vendor-commit:307-312`).

### Citation index
- Commit (all-day + dates + amount + single row): `vendor-commit/route.ts:31, 98-100, 133, 189,
  253-262, 266-267, 307-340, 376-388`.
- Synthetic client payload (whole-stay total, label-only nights):
  `PublicHotelSearch.tsx:126, 135-139, 150`.
- Nights math (correct): `liteapiClient.ts:328-332, 508-513`.
- All-day render + multi-day membership gap: `CalendarGrid.tsx:656, 665-679, 379, 396-399`
  (contrast flight fill `:381-395`).
- Trip total single-count: `TripBudgetActual.tsx:266`; `budget/route.ts:25-27, 53-68`;
  `calendar/route.ts:64-93`.
- Fixed-bug provenance: `discover/[category]/[rank]/page.tsx:221-240`.

*Do not implement — audit only.*
