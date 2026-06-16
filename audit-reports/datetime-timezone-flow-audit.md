# Datetime / Timezone Data Flow Audit (READ-ONLY)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. tz library check:
**`package.json` has NO tz library** (no luxon / date-fns-tz / dayjs / moment) — only native
`Date` + `Intl` (`package.json`, grep returned nothing). Label legend: EXISTS /
EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

---

## Step-by-step chain

### 1. DUFFEL PARSE — `src/lib/duffel.ts`
- **durationMinutes** — EXISTS at `duffel.ts:307`: `durationMinutes: hours * 60 + mins`,
  where `hours`/`mins` come from `slice.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)`
  (`:288-290`). It's surfaced on `offer.outbound.durationMinutes`
  (`FlightPickerView.tsx:30` — `durationMinutes?: number`).
- **departing_at / arriving_at FORMAT** — `localTime: firstSeg?.departing_at?.substring(11, 16)`
  (`:297`) and `date: firstSeg?.departing_at?.substring(0, 10)` (`:298`); same for arrival
  (`:303-304`). The code reads **only chars 0-10 (date) and 11-16 (time)** — so **any zone
  offset/`Z` after char 16 is stripped regardless of what Duffel sends**. The raw
  `departing_at` literal format is **NOT VERIFIED** (no example string in the code/types);
  but the extraction guarantees the captured values are **naive `YYYY-MM-DD` + `HH:MM` with
  no zone**. — RISK (zone discarded at the source).
- Airport `time_zone` — MISSING (only `iata_code` + `name` captured, `:295-296, 301-302`).

### 2. CLIENT PAYLOAD — `src/components/trips/PublicFlightSearch.tsx` (home/public search)
- Fields built: `departTime = offer.outbound?.departure?.localTime` (`:160`),
  `arriveTime = offer.outbound?.arrival?.localTime` (`:161`),
  `arriveDate = offer.outbound?.arrival?.date` (`:162`),
  `durationMinutes = offer.outbound?.durationMinutes ?? undefined` (`:165`).
- Payload (`:172-181`): `startDate: leg.departureDate`, `endDate`, `startTime: departTime`,
  `endTime: arriveTime`, `arriveDate`, **`durationMinutes`** (`:180`). — EXISTS.
- **Client-side Date reformatting before send:** NONE on the offer's times — they're passed
  as raw strings. The only `new Date()` is `defaultDate` (`:34-36`):
  `new Date().toISOString().slice(0, 10)` — used to **seed** a leg's default `departureDate`
  (`:46, 98`), **UTC-based** (RISK: a late-night LAX user's "today" seeds tomorrow's UTC
  date). Not applied to a committed real offer's date.

### 2b. SECOND/THIRD COMMIT PATHS (critical — not all send duration)
- **`src/components/trips/FlightPicker.tsx`** (the in-trip picker, `budgets/trips/[id]`):
  commits to vendor-commit (`:250`) with `optionType:'flight'` and
  `startTime/endTime/arriveDate` (`:246-248, 254-262`) — **but the body has NO
  `durationMinutes`** (`:253-263`). — RISK.
- **`src/components/trips/TripPlannerAI.tsx`**: commits flights via vendor-commit
  (`:577-612`) with `startTime/endTime` but **no `durationMinutes`** in the body
  (grep over `:577-620`). — RISK.
- Only **PublicFlightSearch** sends `durationMinutes`. (See answer (a).)

### 3. VENDOR-COMMIT ROUTE — `src/app/api/trips/[id]/vendor-commit/route.ts`
- Destructure (`:89-93`): `startDate, endDate, startTime, endTime, arriveDate, …,
  durationMinutes: durationMinutesInput`.
- **Duration gate** (`:94-95`): `const durationMinutes = optionType === 'flight' &&
  Number.isFinite(durationMinutesInput) ? Math.round(durationMinutesInput) : null;` —
  flights only; **null when not finite** (undefined/null/NaN). — EXISTS (the gate).
- **Date derivation** — `const start = new Date(startDate)` (`:231`),
  `const flightArriveDate = arriveDate ? new Date(arriveDate) : end` (`:268`). `startDate`
  is a `"YYYY-MM-DD"` string, so **`new Date("2026-07-01")` = UTC midnight
  (`2026-07-01T00:00:00.000Z`)**. — RISK (the day-anchor is UTC).
- **trip_itinerary flight write** (`:271-276`): `homeDate: start`, `homeTime: startTime || null`
  (raw `"HH:MM"`), `destDate: flightArriveDate`, `destTime: endTime || null`,
  `duration_minutes: durationMinutes`.
- **calendar_events write** (`:345-359`): `calStart = new Date(startDate)` (`:345`, UTC
  midnight), `calEnd = isFlight ? new Date(arriveDate) : …` (`:351-353`),
  `calStartTime = isFlight ? (startTime || null) : null` (`:354`, raw `"HH:MM"`),
  `calEndTime` (`:355`), INSERT columns incl. `start_time …::time, end_time …::time, …,
  duration_minutes` with `${calStartTime}::time` and `${durationMinutes}` (`:358-359`).
- **Timezone preserved?** NO — times are raw naive `"HH:MM"`; dates are UTC-midnight
  `Date`s. No offset/zone is stored. — RISK.

### 4. DB SCHEMA — `prisma/schema.prisma`
- **trip_itinerary**: `homeDate DateTime` (`:650` — **no `@db.Date`** → full timestamp),
  `homeTime String? @db.VarChar(10)` (`:651`), `destDate DateTime` (`:652`),
  `destTime String? @db.VarChar(10)` (`:653`), `block_start_time DateTime? @db.Time(6)`
  (`:671`), **`duration_minutes Int?`** (`:679`).
- **calendar_events**: `start_date DateTime @db.Date` (`:1336`), `end_date DateTime? @db.Date`
  (`:1337`), `start_time DateTime? @db.Time(6)` (`:1338`), `end_time DateTime? @db.Time(6)`,
  **`duration_minutes Int?`** (`:1355`).
- **Prisma `@db.Time` serialization** → the ledger reads `homeTime`/`destTime` (plain
  `VarChar` strings, NOT `@db.Time`), so the `.slice(11,16)` issue applies only to
  `calendar_events.start_time` (`@db.Time`), handled by **`toClock`** in HubCalendar
  (`HubCalendar.tsx:48-53`, `timePart = v.includes('T') ? v.split('T')[1] : v` then
  `match(/^(\d{2}):(\d{2})/)`). — REUSABLE (toClock normalizes `@db.Time` ISO to `HH:MM`).

### 5. LEDGER DISPLAY — `src/components/trips/TripBudgetActual.tsx`
- **`fmtDate`** (`:60-65`): `const d = new Date(s); … d.toLocaleDateString('en-US', { month:
  'short', day: 'numeric', year: 'numeric' })`. `s` = `startDate` (the itinerary `homeDate`,
  a full ISO `"2026-07-01T00:00:00.000Z"`). **`new Date(ISO).toLocaleDateString()` localizes
  UTC-midnight → in a negative-offset (Americas) browser it renders the PREVIOUS day.** —
  **RISK / PRIME DAY-DRIFT SUSPECT (−1 day, west of UTC).**
- **`fmtTime`** (`:68`): `return s && s.trim() ? s : DASH` — raw `VarChar` string `"00:00"`,
  **no `Date`** → no drift. — OK.

### 6. INLINE EDIT (enter edit mode) — `src/components/trips/TripBudgetActual.tsx`
- **`toDateInput`** (`:83-86`): `const d = new Date(s); … d.toISOString().slice(0, 10)`.
  `new Date("2026-07-01T00:00:00.000Z").toISOString().slice(0,10)` = **`"2026-07-01"` (UTC,
  no drift)**. So the edit `<input type=date>` is seeded with the **true stored date**.
- **`toTimeInput`** (`:90-91`): `s && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : ''` — raw,
  no `Date` → no drift.
- `inputVal` chosen at `:116`; bound `defaultValue={inputVal}` (`:152`). — OK on its own, BUT
  **inconsistent with display**: `fmtDate` shows `Jun 30` while `toDateInput` shows
  `2026-07-01` → the cell value "jumps" forward when you click to edit. — RISK (display↔edit
  mismatch).

### 7. PATCH SAVE ROUTE — `src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts`
- **`parseDayUtc`** (`:35-40`): `new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1,
  Number(m[3])))` — the `"YYYY-MM-DD"` input is anchored at **UTC midnight**; written to
  `data.homeDate` / `data.destDate` (`:117-118, 141, 146`). — UTC-consistent, **no drift on
  save**.
- **`parseLedgerTime`** (`:46-61`): validates `HH:MM`, stores `v.slice(0, 5)` as the
  `homeTime`/`destTime` string and `parseTimeOrNull(v).value` as the `@db.Time` block
  (`:127-128, 133-134`) — raw time, **no drift**.
- So the **save layer is UTC-anchored and round-trips the same date the edit input showed.**

### 8. CALENDAR RENDER — `src/components/shared/CalendarGrid.tsx`
- **Day-key match** (`:151-152`): `const evtStartKey = dateToKey(parseDate(event.startDate));
  const evtEndKey = event.endDate ? dateToKey(parseDate(event.endDate)) : evtStartKey;`.
  **`parseDate`** (`:104-107`): `dateStr.split('T')[0].split('-').map(Number); new Date(year,
  month-1, day)` — extracts the **date-portion string before localizing**, so it does NOT
  drift (key = `"2026-07-01"`). — REUSABLE (this is the correct date handling the ledger
  lacks).
- **Vertical span** (`:154-170`): `startMin = timeToMinutes(event.startTime)`,
  `endMin = timeToMinutes(event.endTime)`; multi-day → depart block `startMin → 24*60`
  (`:163`) + arrive block `0 → endMin` (`:169`). For `00:00 → (next day) 10:05` this is
  `1440 + 605` = **~34h05m**. **`duration_minutes` is NOT read here** (grep: not mapped to
  `GridEvent`, not referenced in `getBlocksForDay`). — RISK / CONFIRMED (PR-2 render not
  done).
- **tzMode**: declared `type TzMode` (`:127`) + `const [tzMode, setTzMode] = useState<TzMode>('local')`
  (`:228`); bound to the `<select value={tzMode} onChange={…}>` (`:405-406`). **Read nowhere
  that affects output** (grep returned only those 4 lines). — EXISTS-BUT-UNUSED (dead).

---

## (a) DURATION BLANK — trace + exact null line

| Step | What happens | Cite |
|---|---|---|
| 1 | `durationMinutes = hours*60 + mins` (e.g. 1145 for PT19H5M) | `duffel.ts:307` |
| 2 | `durationMinutes = offer.outbound?.durationMinutes ?? undefined` → payload `:180` | `PublicFlightSearch.tsx:165,180` |
| 3 | `optionType==='flight' && Number.isFinite(durationMinutesInput) ? Math.round() : null` | `vendor-commit/route.ts:94-95` |

- **Exact line it becomes null on commit:** `vendor-commit/route.ts:94` — the
  `Number.isFinite(durationMinutesInput)` gate yields `null` whenever the payload omits
  `durationMinutes` (sent as `undefined` → JSON drops the key → `undefined` server-side).
- **Is the re-commit path identical to what PR-Flight-Duration-1 patched? NO.** PR-1 patched
  **only `PublicFlightSearch.tsx`** (home/public search). The **in-trip `FlightPicker.tsx`
  commit body (`:253-263`) does NOT send `durationMinutes`**, and **`TripPlannerAI.tsx`
  (`:577-612`) does not either**. A flight re-committed through the in-trip picker or the AI
  planner stores `duration_minutes = null` → still renders the 34h span. — RISK.
- Edge: if Duffel returns no `slice.duration`, the regex fails to match → `hours=0, mins=0`
  → `durationMinutes = 0` (`duffel.ts:289-290, 307`). `0` is finite, so vendor-commit stores
  **`0`** (a zero-length block), not null. — RISK (degenerate 0 vs null).

## (b) DAY-SHIFT BOUNDARY — exact calls, by layer

| Layer | Call | Behavior | Drift |
|---|---|---|---|
| **Display** | `new Date(s).toLocaleDateString(...)` | localizes UTC-midnight ISO | **−1 day** (browsers west of UTC) — `TripBudgetActual.tsx:62,65` |
| **Edit (enter)** | `new Date(s).toISOString().slice(0,10)` | UTC date-portion | **0** — `TripBudgetActual.tsx:85-86` |
| **Save** | `new Date(Date.UTC(y,m-1,d))` | UTC midnight | **0** — `itinerary/[itineraryId]/route.ts:39` |
| **Calendar** | `parseDate` = `split('T')[0].split('-')` then local `Date` | date-portion string, no localize | **0** — `CalendarGrid.tsx:104-107,151-152` |

- **Only the DISPLAY layer shifts (−1, westward).** Edit, Save, and Calendar are all
  drift-free (UTC or string-split). The bug is the ledger's `fmtDate` localizing a UTC-midnight
  timestamp; the calendar already does the correct thing (`parseDate` splits the string).
- **Direction:** `−1` for viewers at a negative UTC offset (e.g. LAX UTC-7); `0` at UTC and
  positive offsets. Root: dates are stored UTC-midnight (`vendor-commit:231,345`;
  `parseDayUtc:39`) and `homeDate` is a `DateTime` timestamp (`schema:650`), so the localized
  render rolls back a day.

## (c) STORED vs DISPLAYED (template — fill with your psql output)

> Example assumes a stored flight depart date of **2026-07-01** (`new Date("2026-07-01")` =
> `2026-07-01T00:00:00.000Z`) viewed in a **UTC-7** browser.

| Field | Raw DB value (paste psql) | Ledger display (`fmtDate`/`fmtTime`) | Edit input (`toDateInput`/`toTimeInput`) | Calendar (`getBlocksForDay`) | TRUTH |
|---|---|---|---|---|---|
| `homeDate` | `2026-07-01` (00:00 UTC) | **Jun 30, 2026** (−1) | `2026-07-01` | `2026-07-01` key | **2026-07-01** (DB/edit/calendar) |
| `homeTime` | `00:00` (VarChar) | `00:00` | `00:00` | `startMin=0` | `00:00` |
| `destDate` | `2026-07-02` | **Jul 1, 2026** (−1) | `2026-07-02` | `2026-07-02` key | `2026-07-02` |
| `destTime` | `10:05` | `10:05` | `10:05` | `endMin=605` | `10:05` |
| `duration_minutes` | `1145` (or NULL/0) | not shown | not shown | **not read → 34h block** | `1145` |

The **DB value is TRUTH**; the **ledger display is the only liar** (−1 day). The calendar's
day placement is correct, but its **span ignores `duration_minutes`** → wrong height.

## (d) ZONE-TOGGLE MODEL

- **Declared / set / read:** `tzMode` — declared `CalendarGrid.tsx:127` + `:228`; set via the
  header `<select>` `:405-406`; **read nowhere** → EXISTS-BUT-UNUSED (dead control). No other
  component references it (grep). 
- **tz libraries:** MISSING — `package.json` has none (no luxon / date-fns-tz / dayjs /
  moment); only native `Date` + `Intl`.
- **What a "store in one home-base anchor zone + toggle to trip-local view" model needs:**
  1. **Storage-zone decision** — today dates are UTC-midnight `Date`s (`@db.Date`) and times
     are naive `@db.Time`/`VarChar` with **no zone column**. A real model needs either
     `timestamptz` columns or an explicit per-endpoint **IANA zone / offset** stored
     (depart-zone, arrive-zone) — a **migration**. The offset is already discarded at parse
     (`duffel.ts:297-304`) and the airport `time_zone` is not captured, so this also needs a
     **capture change** (keep the offset, or capture `origin/destination.time_zone`).
  2. **Conversion fn + home** — MISSING. A shared util (e.g. `src/lib/tz.ts`) using
     `Intl.DateTimeFormat(..., { timeZone })` (native, no dep) or a tz lib. Nothing like it
     exists today.
  3. **Every site that must route through it** — currently each does naive ops and would all
     need to call the converter: `fmtDate`/`fmtTime`/`toDateInput`/`toTimeInput`
     (`TripBudgetActual.tsx:60-91`), `parseDayUtc`/`parseLedgerTime`
     (`itinerary/[itineraryId]/route.ts:35-61`), `parseDate`/`timeToMinutes`/`getBlocksForDay`
     (`CalendarGrid.tsx:104-170`), `toClock` (`HubCalendar.tsx:48-53`), and the commit write
     (`vendor-commit/route.ts:231,345,354-359`). — REAL-BUILD.

---

## Recommended atomic PR sequence

1. **PR-Ledger-Date-Display-Fix** — **SMALL-FIX.** Make `fmtDate`/`toDateInput`
   (`TripBudgetActual.tsx:60-86`) parse the **date-portion** (mirror `CalendarGrid.parseDate`:
   `s.split('T')[0]`) instead of `new Date(ISO).toLocaleDateString()`. Removes the −1 ledger
   drift and the display↔edit mismatch. No migration. Answer (b)/(c).
2. **PR-Flight-Duration-Capture-AllPaths** — **SMALL-FIX.** Add `durationMinutes` to the
   **`FlightPicker.tsx`** (`:253-263`) and **`TripPlannerAI.tsx`** (`:577-612`) commit bodies
   so the in-trip + AI re-commit paths match PR-1; consider treating `0` as null at
   `vendor-commit:94`. No migration. Answer (a).
3. **PR-Flight-Duration-Render** — **SMALL/MEDIUM.** Map `calendar_events.duration_minutes`
   → `GridEvent` (`HubCalendar.tsx:163-180`, `/api/calendar` SELECT is `SELECT *` so the
   column is already returned) and, in `getBlocksForDay` (`CalendarGrid.tsx:154-170`), draw
   the block as `start → start + duration_minutes` (split across midnight by duration) when
   present, falling back to start→end. Fixes the 34h span. No migration.
4. **PR-Timezone-Model** — **REAL-BUILD.** Capture + store zone/offset (migration), add a
   conversion util, make `tzMode` real, and route all 6+ sites in (d) through it. Only needed
   for true per-zone wall-clock display; do **not** fold into the above.

**Do not implement — audit only.**
