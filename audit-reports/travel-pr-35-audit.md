# TRAVEL — PR-35 Audit: manual-price + date/time commit for Google places (one-time vs recurring)

**Branch:** `claude/travel-pr-35-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Goal:** Google place results are **unpriced** (Google returns a place, not a
cost). Committing one to Committed Budget needs a **manual cost** + **start/end
dates** + **start/end times** + a **one-time vs recurring** choice (the PR-28f
membership model). Map the commit flow, budget model, schema (dates/times),
Routines/recurrence, and the form UI. Cite file+line.

---

## 1. Current Google-place commit — the gap

The detail page renders **`<AddToTripButton>` unconditionally**
(`…/discover/[category]/[rank]/page.tsx:447-457`), outside the
`source==='liteapi'` block, with:
```tsx
amount={stayTotal}        // rec.price — NULL for a Google place
checkinDate={checkin}     // rec.checkinDate — NULL (only LiteAPI threads dates, PR-33)
checkoutDate={checkout}   // rec.checkoutDate — NULL
```
For a Google place, `rec.price` is null (Google returns no cost) and
`rec.checkinDate/checkoutDate` are undefined (the PR-33 mapper threads those only
for LiteAPI hotels). So inside `AddToTripButton`:
- `datesMissing = !checkinDate || !checkoutDate` is **true** → the button is
  **disabled** with `title="Re-scan this hotel to refresh its stay dates"`
  (`AddToTripButton.tsx:110,117-118`) — a nonsensical message for a restaurant/gym.
- Even if forced, `handleAdd` throws `'Missing stay dates…'` (`:43-45`) before any
  POST.

**Verdict: Google places cannot be committed today.** The button is permanently
disabled for them, and there is **no manual-cost / date / time input anywhere** —
the only Google affordance is the "Google Maps ↗" external link
(`page.tsx:431-439`) plus the "discovery-only" note (`:460-464`). **The gap:** no
manual-entry commit path for unpriced places.

## 2. The hotel/flight commit template + a synthetic 'place' branch

`vendor-commit/route.ts` already has **two synthetic paths** (no DB option row
required, built from the payload):
- **flight** (`:110-111`): `details = { title: notes, amount: requestAmount }`.
- **synthetic lodging** (PR-32, `:95,:110-118`): `isSyntheticLodging =
  optionType==='lodging' && synthetic===true` → same payload-built details, skips
  `setOptionStatus`.

**Proposal — a synthetic `'activity'` commit (or a new `'place'` type)** for
Google places, mirroring the lodging synthetic path. The cleanest fit is
`optionType:'activity'` with `synthetic:true`, because:
- the route's COA logic already special-cases `activity` for **per-category COA
  codes** (`:124-134`, via `getCOACode(category)`) — exactly what each Google
  category needs (gyms/groceries/sports/etc.);
- `'activity'` is already a `validType` (`:101`).

**But** the current `activity` path requires a `trip_activity_expenses` row
(`getOptionDetails` → `:128-134` reads `actOpt.category`). So PR-35 must add a
**synthetic-activity branch**: when `synthetic===true` (+ a passed `category`),
build `details` from the payload (manual `amount`, `notes`) and take the COA from
the **passed category** instead of a DB lookup. **Proposed payload:**
```ts
{
  optionType: 'activity',
  synthetic: true,
  category: catKey,                 // 'gyms' | 'dinner' | … → per-category COA
  optionId: `place-${catKey}-${Date.now()}`,
  amount: <manual number>,          // user-entered cost (Google has none)
  startDate, endDate,               // entered window (no fallback — PR-33)
  startTime, endTime,               // entered times → homeTime/destTime
  notes: <place name>,
  location: destinationLabel,       // → Country column
  recurring: <bool>, cadence: <'monthly'|…>   // §5
}
```

## 3. Budget model — manual amount + per-category COA

`budget_line_items` (`prisma/schema.prisma:1022-1043`) holds exactly what a manual
entry needs: `coaCode`, `amount Decimal`, `description`, `year`, `month`,
`tripId`, `userId`, and **`source` already documents `'trip' | 'manual' |
'recurring'`** (`:1033`). So a committed gym place → a `budget_line_items` row with
the gym's COA + the user's entered amount.

**COA per category:** the route derives the COA via `getCOACode(category)`
(`route.ts:132`, from `src/lib/travelCategories.ts`). **⚠ DIVERGENCE FOUND —
needs fixing in PR-35:** `travelCategories.ts` (`getCOACode`'s table) is **missing
the PR-28f keys**. Comparison:

| catKey | `travelCOA.ts` (canonical, PR-28f) | `getCOACode` (travelCategories.ts) |
|---|---|---|
| brunch_coffee | P-9310 | 9310 ✓ |
| dinner | P-9320 | 9320 ✓ |
| nightlife | P-9430 | 9430 ✓ |
| festivals | P-9440 | 9440 ✓ |
| shopping | P-9800 | 9800 ✓ |
| **coworking** | P-9510 | **absent → 9950** |
| **gyms** | P-9520 | **absent → 9950** |
| **sports** | P-9530 | **absent → 9950** |
| **groceries** | P-9830 | **absent → 9950** |

So gyms/groceries/sports/coworking would be **mis-filed to 9950
(miscellaneous)** unless PR-35 adds them to `travelCategories.ts` (or reads the
COA from `TRAVEL_COA` directly). `coaCodeToLabel` (`travelCOA.ts`) DOES know
P-9520/P-9530/P-9830, so once the right code is written, Committed Budget labels
them correctly. **This COA-table sync is in-scope for PR-35** (0 schema — it's a
TS map).

## 4. Dates + times — schema HOLDS times (no migration needed)

- **Dates:** `trip_itinerary` has `homeDate`/`destDate DateTime` and
  `budget_line_items` derives year/month from `startDate`. ✓
- **Times: ALREADY SUPPORTED.** `trip_itinerary.homeTime` + `destTime` are
  `String? @db.VarChar(10)` (`schema.prisma` trip_itinerary block), and
  **vendor-commit already accepts `startTime`/`endTime` in the payload**
  (`route.ts:87`) and writes them: `homeTime: startTime || null, destTime:
  endTime || null` on every itinerary branch (`:183-184,:196-197,:213-214`). So a
  place commit can pass start/end times **with no schema change.** ✅
- **PR-33 date discipline applies:** the dates must be the **entered** window
  (manual, no fallback). The route faithfully spans whatever start/end it's given
  (`:203-221`); the form + `AddToTripButton`-style island must validate `end >=
  start` and refuse to commit on bad input (mirror PR-33's fail-loud assert).

**No migration needed for the base one-time path.** (A recurrence column choice
is §5 — only the recurring path may want a schema add.)

## 5. One-time vs recurring

**The platform's recurring-EXPENSE model is the `*_expenses` cadence tables**, NOT
the "Routines" feature. (`SectionE_Routines` /`operations_routines`/RRULEBuilder
is an **ops content/task** system — cadence-grouped daily/weekly tasks with
streaks — unrelated to budget.) The budget-recurring pattern is
`home_expenses`/`module_expenses` (`schema.prisma:1297-1340`):
`{ name, coa_code, amount, cadence String @default("monthly"), due_day,
start_date, end_date, is_active, status }` — **a single row with a cadence**, not
expanded into N monthly budget rows. `budget_line_items.source` also already
allows `'recurring'` (`:1033`).

**Proposed two paths:**
- **One-time** (single dinner, grocery run): a single `budget_line_items` row
  (`source:'trip'`) at the entered date/amount + the itinerary entry/entries +
  calendar event — exactly the existing vendor-commit flow, just with a
  manual amount and the per-category COA. **No new model.**
- **Recurring** (gym = $Y/month over a range — the PR-28f membership model): two
  sub-options for Alex —
  1. **Mirror the `*_expenses` cadence model** — write a single recurring row
     (cadence + start/end) so it shows as a recurring line (consistent with
     home/module expenses). Cleanest, but trips have **no `trip_recurring_expenses`
     table** today (only `trip_expenses` one-offs, `schema.prisma:598`) → **needs
     either a new table or reuse of `module_expenses` with `module:'trip'`**
     (schema/decision — flag for Alex).
  2. **Expand into monthly `budget_line_items`** across the range
     (`source:'recurring'`, one row per month) — no schema add, but multiplies
     rows and complicates uncommit. Less clean.

  **Recommend option 1 (cadence row)**, reusing `module_expenses`
  (`module:'trip'`, `coa_code`, `amount`, `cadence`, `start_date`/`end_date`) to
  avoid a migration — **confirm with Alex.** This is the membership model: one
  line, "$Y/month, Jul–Dec".

## 6. The manual-commit form UI

**Proposal — a `<PlaceCommitForm>` client island** (replacing the disabled
`AddToTripButton` for `source==='google'` on the detail page, and/or a modal
opened from the place card). Fields:
- **Amount** — number input (required, positive; Google has no price).
- **One-time / Recurring** toggle.
- **Start date / End date** — date inputs (required; `end >= start`).
- **Start time / End time** — time inputs (optional; → `homeTime`/`destTime`).
- **Cadence** (recurring only) — select (monthly/weekly/…), default monthly.
- Submit → POST the §2 synthetic-activity payload; on success "✓ Added to trip —
  view budget" (mirror `AddToTripButton`'s success state); fail-loud inline error
  on validation/commit failure.

**Where it lives:** the detail page is a server component, so the form is a client
island (like `AddToTripButton`/`ReserveHotelButton`), rendered in the action-row
when `source==='google'`. (The card-level quick-commit is a nice-to-have; the
detail page is the minimal surface.)

## 7. Auth + integrity

- **Auth/ownership:** the commit rides `vendor-commit`'s existing gate
  (`route.ts:80-85`): `getVerifiedEmail()`→401, user→404, `trips.findFirst({ id,
  userId })`→404. The synthetic branch is evaluated **after** the gate. The detail
  page is itself auth+ownership gated. ✅
- **Validation (form + server):**
  - **Amount** — positive number, required (reject ≤0 / NaN). Google has no price,
    so this is the sole cost source — must be validated, never defaulted to 0.
  - **Dates** — `end >= start`, required, **NO fallback** (PR-33 lesson): missing/
    bad dates → disable + fail-loud, never trip.startDate.
  - **Times** — optional; if present, well-formed HH:MM.
  - Server should re-validate amount/dates (don't trust the client).

## 8. Scope + schema/migration flag

**Files (likely):**
- **New** `PlaceCommitForm.tsx` client island (detail page action-row for
  `source==='google'`). ~120 lines.
- **`page.tsx`** — render `<PlaceCommitForm>` for Google (replace the
  disabled-`AddToTripButton` case).
- **`vendor-commit/route.ts`** — add a **synthetic-activity branch** (manual
  amount + per-category COA from the passed `category`, no `trip_activity_expenses`
  row); optionally a `recurring`/`cadence` write.
- **`src/lib/travelCategories.ts`** — add the missing PR-28f COA codes
  (coworking/gyms/sports/groceries) so `getCOACode` files them correctly (the
  §3 divergence). **0 schema — a TS map edit.**

**Schema / migration:**
- **One-time + times path: NO migration** (trip_itinerary already has
  homeTime/destTime; budget_line_items holds manual amount + COA).
- **Recurring path: a decision** — reuse `module_expenses` (`module:'trip'`, no
  migration) vs a new `trip_recurring_expenses` table (migration, Alex runs it).
  **Flag for Alex.**
- **0 deps.**

## What needs Alex sign-off
1. **Recurring storage** — reuse `module_expenses` (`module:'trip'`, no migration,
   recommended) vs a new `trip_recurring_expenses` table (migration) vs expanding
   into monthly `budget_line_items` rows.
2. **Synthetic type** — reuse `optionType:'activity'` + `synthetic:true` +
   `category` (recommended, gets per-category COA for free) vs a new `'place'`
   type.
3. **COA source of truth** — fix the `travelCategories.ts` divergence by adding
   the PR-28f keys, **or** switch `getCOACode`/the route to read COA straight from
   `TRAVEL_COA` (canonical). Confirm which.
4. **Form placement** — detail-page island only (minimal) vs also a card-level
   quick-commit modal.
5. **Times required or optional** — confirm start/end times are optional (a
   grocery run may have no time) vs required for recurring memberships.

---

**READ-ONLY audit. No implementation performed.**
