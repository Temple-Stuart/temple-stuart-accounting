# Per-day hotel cost display — amortize daily rate across span (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / MISSING / RISK.

**Headline:** the per-day calendar **footer** (`CalendarGrid.tsx:816` week/day, `:838` month)
sums **`e.budgetAmount` in full for every day the event is a member of**. Since PR-Hotel-Span-Fill
made a hotel a member of **all** its spanned days (`:405-412`), its full stay amount is now added
on **every** day → the "-$2,009 recurring on Jul 2/3/4" symptom. The honest fix is a **display-only**
per-day amortization in those two reduces, dividing by the **night count = `endDate − startDate`
date-diff (NOT days, NOT +1)** — the SAME `dayDiff` Span-Fill already computes (`:407`). The catch
the divisor warning is about: Span-Fill's membership is **nights + 1 days** (it includes the
**check-out day**), so to make the footer reconcile to the real total the check-out day must bear
**$0**. The trip **ledger** total is a separate reduce (`TripBudgetActual.tsx:266`) over
`budget_line_items` — it already sums the whole stay **once** and must NOT be touched.

---

## 1. The per-day FOOTER total — the sum root

Two footer reduces, both summing **full `budgetAmount` per member event**:

- **Week/Day footer** (`CalendarGrid.tsx:811-824`):
  ```
  const dayEvents = getEventsForDate(day);                                  // :815
  const total = dayEvents.reduce((s, e) => s + (e.budgetAmount || 0), 0);   // :816
  ```
- **Month cell** (`:834-838`):
  ```
  const dayEvents = getEventsForDate(date);                                 // :837
  const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budgetAmount || 0), 0);  // :838
  ```

`getEventsForDate` returns the **membership** list: `eventsByDateKey[key]` filtered by the
category toggle (`:418-421`). So every event that is a *member* of a day contributes its **entire**
`budgetAmount` to that day's footer. — EXISTS (full-amount-per-member-day), `:816, :838`.

## 2. Why the full amount now repeats across the span

`eventsByDateKey` builds membership. For a hotel (all-day: `startTime`/`durationMinutes` null;
`endDate !== startDate`) PR-Hotel-Span-Fill pushes a membership row on **every** day from start
through end **inclusive** (`:396-412`):
```
const startD = parseDate(startKey);
const endD = parseDate(e.endDate);
const dayDiff = Math.round((endD.getTime() - startD.getTime()) / 86_400_000);   // :407
for (let off = 1; off <= dayDiff; off++) { … pushOn(dateToKey(d), e); }          // :408-412
```
Plus the start-day push at `:379`. So a Jul 1 → Jul 31 stay is a member of **31 days**
(`dayDiff = 30`, start + 30). Each of those 31 days then adds the hotel's **full** `budgetAmount`
in the footer reduce (§1) → the full stay total shown 31 times. — EXISTS (the bug), `:405-412` +
`:816/:838`.

## 3. AMORTIZATION INPUTS — total, and the honest night count

- **Total:** `event.budgetAmount` — the whole-stay amount, already on the GridEvent
  (`CalendarGrid.tsx:35`; mapped from `calendar_events.budget_amount` at `HubCalendar.tsx:198`).
  EXISTS.
- **Night count — DERIVED, not stored.** The GridEvent carries **no `nights` field** — only
  `startDate` + `endDate` (`:18-19`); `HubCalendar.tsx:183-184` maps them straight from
  `calendar_events.start_date/end_date`. So nights must be derived from the date span. — MISSING
  (stored), derivable.
- **The honest divisor = the date-diff in days, NO +1:**
  ```
  nights = round((endDate − startDate) / 86_400_000)
  ```
  This is **exactly `dayDiff`** already computed at `:407`. For Jul 1 → Jul 31 it is **30
  nights** (correct), NOT 31 days. `budgetAmount / dayDiff` = **$2,010 / 30 = $67/night** — the
  desired figure. — the divisor, `:407`. (RISK if anyone uses `dayDiff + 1` or a `gridDays`-style
  inclusive count → that yields **days**, the off-by-one the prior hotel audit flagged.)
- **The reconciliation catch (RISK):** membership spans **`dayDiff + 1` days** (nights **+ the
  check-out day**, `:408-412` includes offset `dayDiff` = the end day). If `$67/night` is shown on
  **all** `dayDiff + 1` member days, the footer sums to `67 × 31 = $2,077 ≠ $2,010`. To reconcile,
  the **check-out day (offset == dayDiff) must contribute $0** — you don't pay for the night you
  check out. So: amortized rate on the **`nights`** days `[startDate, endDate)`, **$0** on
  `endDate`. (The bar still *spans* the check-out day visually — only its footer cost is zero.) —
  RISK, `:407-412`.

## 4. TRIP LEDGER total — separate, sums once, DO NOT TOUCH

The trip ledger total is a **different** reduce, in a **different** component, over a **different**
source:
```
const total = items.reduce((s, it) => s + Number(it.amount || 0), 0);   // TripBudgetActual.tsx:266
```
`items` = `/api/trips/[id]/budget` → `budget_line_items` **1:1** (`budget/route.ts:25-27`), one
hotel row with the full stay amount, counted **once**. It has no membership/span concept and never
sees `eventsByDateKey`. — EXISTS (correct, single count). **The fix is confined to the two
CalendarGrid footer reduces (§1); the ledger is untouched.** — confirmed separate.

## 5. SCOPE — lodging-only, or all spanned all-day costs?

The membership predicate that triggers the span (`!startAt && endDate && endDate !== startDate`,
`:396`) captures **any** multi-day all-day event with an `endDate` — hotels **and** a multi-day
all-day **activity** (e.g. a date-range Google-place activity, which `vendor-commit` writes with an
`endDate` and null calendar times). Both currently over-show their full cost per day. But the
**divisor semantics differ by type**:

- **Lodging:** `endDate` = **check-out** → nights = `endDate − startDate`, the check-out day bears
  **$0** (§3). True nightly rate = `total / nights`.
- **Multi-day activity (inclusive range):** `endDate` = the **last active day** → the cost should
  spread over **all `dayDiff + 1`** member days (each day is "used"), divisor = `dayDiff + 1`, and
  the last day bears a full share, NOT $0.

So a single rule ("divide by `dayDiff`, zero the end day") is **correct for lodging but wrong for an
inclusive-range activity** (it would under-divide and zero the last active day). — RISK.

**Identification problem (MISSING):** the GridEvent has **no clean lodging flag**. The map carries
`source` (`'trip'` for both hotels and trip activities), `icon` (`'🏨'` for lodging,
`vendor-commit.ts:365-368`), and a `title` suffixed `"(lodging)"` (`vendor-commit.ts:369`) — but
**no `category`/`optionType`/`item_type`** (`HubCalendar.tsx:180-199`). So scoping to lodging-only
at the footer would rely on `icon === '🏨'` or a title-substring (both **fragile** — RISK), or
require plumbing a small `kind`/`category` field onto the GridEvent. — MISSING (a robust type key).

---

## Explicit answers

**(a) Footer sum root.** `getEventsForDate(day)` returns the membership list, and the footer does
`dayEvents.reduce((s,e)=>s + (e.budgetAmount||0), 0)` (`CalendarGrid.tsx:816` week/day, `:838`
month). After Span-Fill a hotel is a member of every spanned day (`:405-412`), so its **full**
`budgetAmount` is added on each — the recurring full total.

**(b) Honest night-count source + divisor.** **Derived, not stored** — no `nights` on the GridEvent
(only `startDate`/`endDate`, `:18-19`). The honest divisor is the **date-diff in days, no +1**:
`nights = round((endDate − startDate)/86_400_000)` = the existing `dayDiff` (`:407`). Jul 1 → Jul 31
= **30 nights** (not 31 days). `budgetAmount / nights = $67`. The `+1`/inclusive-day count gives
**days** and is the off-by-one to avoid.

**(c) Amortization formula + landing.** In the two footer reduces only:
```
perDay(e, day) =
  isSpannedAllDay(e)                       // !startTime && endDate && endDate !== startDate
    ? (day < endDate ? budgetAmount / nights : 0)   // nights = dayDiff; check-out day → 0
    : (budgetAmount || 0)                            // single-day / timed: unchanged
const total = dayEvents.reduce((s, e) => s + perDay(e, day), 0);
```
Lands **only** in `CalendarGrid.tsx:816` and `:838`. The trip ledger reduce
(`TripBudgetActual.tsx:266`) is **not** touched — storage and the whole-stay total stay exactly as
audited. Footer then sums `67 × 30 = $2,010` across the stay (once), showing **$67/night** on each
of the 30 nights and **$0** on the check-out day.

**(d) Scope.** The trigger predicate is **all** multi-day all-day costed events, but the **divisor
differs**: lodging excludes the check-out day (`total/nights`), an inclusive-range activity does not
(`total/(dayDiff+1)`, last day full). **Recommend scoping the check-out-exclusion to LODGING** and
treating other multi-day all-day costs with the even **`total/(dayDiff+1)`** spread (sums to total,
no end-day special-case) — OR, simplest of all, apply the even `total/(membership-day-count)` spread
to **everything** (always reconciles to total, type-agnostic) and accept that a hotel's shown rate is
then `total/31 ≈ $65` rather than the exact `$67/night`. Picking the **exact $67/night** requires
identifying lodging (icon/title today — fragile; a plumbed `category` is the clean fix). **Flag for
decision: exact nightly rate (lodging-scoped, needs a type key) vs. even membership-day spread
(uniform, slightly below the true nightly rate).**

**(e) Recommended fix — SMALL.** One helper in `CalendarGrid` (e.g. `perDayBudget(e, dayKey)`)
consumed by both footer reduces (`:816`, `:838`). Inputs already present on the GridEvent
(`budgetAmount`, `startDate`, `endDate`, `startTime`). No schema, no migration, no ledger change,
no render-model change (the all-day span stays). **MED only if** the team wants the exact
lodging-scoped `$67/night` — that adds a small plumb of `category`/`item_type` onto the GridEvent
(`HubCalendar.tsx:180-199` + the `CalendarEvent` type `:13-44`) to distinguish lodging (check-out
excluded) from inclusive-range activities. The amortization math itself is SMALL.

### Citation index
- Footer reduces: `CalendarGrid.tsx:811-824` (`:815-816`), `:834-838` (`:837-838`).
- Membership / span (divisor source): `CalendarGrid.tsx:379, 396-412` (`dayDiff :407`).
- `getEventsForDate` (membership): `CalendarGrid.tsx:418-421`.
- GridEvent fields (no nights, no category; has icon): `CalendarGrid.tsx:13-44`;
  `HubCalendar.tsx:180-199` (`startDate/endDate :183-184`, `budgetAmount :198`, `icon :182`).
- Ledger total (separate, untouched): `TripBudgetActual.tsx:266`; `budget/route.ts:25-27`.
- Lodging icon/title (only type signal): `vendor-commit/route.ts:365-369`.

*Do not implement — audit only.*
