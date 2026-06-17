# Month-View Phantom + Amount Sign/Color Convention Audit (READ-ONLY)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels: EXISTS /
EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headlines:**
- **Phantom** = a SEPARATE path from PR-3: `eventsByDateKey` indexes multi-day events on the
  **stored `end_date`** (`CalendarGrid.tsx:298-303`), feeding month cells via `getEventsForDate`
  (`:309-311`). PR-3 only fixed `getBlocksForDay` (day/week timed blocks). `durationMinutes`
  **is** available here (PR-3 plumbed it) → a duration-aware fix is possible.
- **Green "+$500"** = the month cell applies a **trade profit/loss** convention to a trip
  expense: `hasTradeData` (`:707`) is a **misnomer** — it's just `showBudgetTotals && events
  && total≠0`, true for Hub trip days → `isWin` (`:708`, `total>0`) → green `+$500`
  (`:739-741`) + green cell (`:713-715`).
- **Sign is NOT stored** — `budget_line_items.amount` / `calendar_events.budget_amount` are
  **unsigned positives**. Direction (expense vs income) is **derivable via COA**
  (`coaCode → chart_of_accounts.account_type/balance_type`) but that join is never done. So
  the color fix is **SMALL** (no migration), not a signed-ledger REAL-BUILD.

---

## PART A — Month-view phantom

### 1. How month view decides an event's day(s)
The month grid maps `calendarDays` (`CalendarGrid.tsx:700`) and calls
`getEventsForDate(date)` (`:703`), which reads `eventsByDateKey[key]` (`:309-311`).
**`eventsByDateKey`** (`:291-307`) indexes each event on its `startDate` key (`:293-296`)
**AND** — quoting `:297-303`:
```js
// For multi-day events, also index on endDate
if (e.endDate && e.endDate !== e.startDate) {
  const ed = parseDate(e.endDate);
  const ekey = dateToKey(ed);
  if (!map[ekey]) map[ekey] = [];
  if (!map[ekey].some(x => x.id === e.id)) map[ekey].push(e);
}
```
So it iterates **start + the stored `end_date`** (not a derived/duration-aware end). The
LAX→DPS flight (`start_date 2026-07-01`, `end_date 2026-07-02`) is pushed into **both** the
Jul 1 and Jul 2 buckets. — **RISK (the phantom), `CalendarGrid.tsx:297-303`.**

### 2. Separate path from getBlocksForDay? — YES
- Month cells: `getEventsForDate` → `eventsByDateKey` (`:291-311, 703`). — the phantom path.
- Day/week timed blocks: `getBlocksForDay` (`:145+`), which PR-3 made duration-aware
  (`:170-187` use derived end, skip days the duration doesn't reach). — fixed, but **does not
  touch month**.
These are **two different code paths**; PR-3 fixed only the second. The exact phantom line is
**`CalendarGrid.tsx:298-303`** (index-on-stored-endDate). — EXISTS (bug).

### 3. Is `duration_minutes` available in the month path?
**YES.** PR-3 plumbed it: `CalendarEvent.durationMinutes` (`CalendarGrid.tsx:23`) +
HubCalendar map (`HubCalendar.tsx:174`). The `events` array `eventsByDateKey` iterates is
`GridEvent[]`, so `e.durationMinutes` is in scope at `:292`. — REUSABLE (a month fix can use
it; not used there today). — EXISTS-BUT-UNUSED (in this path).

---

## PART B — Amount sign + color

### 4. Where the month "+$500" (green) is built
`CalendarGrid.tsx:738-742`:
```js
{hasTradeData && (
  <div className={`... ${isWin ? 'text-brand-green' : isLoss ? 'text-brand-red' : 'text-text-secondary'}`}>
    {dayTotal > 0 ? '+' : ''}{formatCurrency(dayTotal)}
  </div>
)}
```
- The **"+"** comes from `dayTotal > 0 ? '+' : ''` (`:740`).
- The **green** from `isWin ? 'text-brand-green'` (`:739`), where
  `isWin = hasTradeData && dayTotal > 0` (`:708`) and
  `hasTradeData = showBudgetTotals && dayEvents.length > 0 && dayTotal !== 0` (`:707`).
- The **green CELL** (border/glow) from `:713-715`
  (`border-emerald-400/50 bg-emerald-50/60` + green boxShadow).
- `formatCurrency` (`:113`) = `Intl.NumberFormat(... currency:'USD', minimumFractionDigits:0)`
  → unsigned `"$500"`.
**Finding:** the name `hasTradeData` is a **misnomer** — the condition contains nothing
trade-specific; on the Hub calendar `showBudgetTotals={true}`, so any positive trip-expense
day total is treated as a **profit/"win" → green +**. — RISK (`:707-708, 713-715, 739-740`).

### 5. Where the LEDGER amount ($499.81) is formatted — DIVERGENT
`TripBudgetActual.tsx`: `usd(n)` (`:56-57`) = `` `$${n.toLocaleString('en-US',
{minimumFractionDigits:2, maximumFractionDigits:2})}` `` → `"$499.81"`, **no sign**. The
amount cell is `text-right font-bold text-brand-purple` (`:330`) and the total is
`text-brand-purple` (`:280`) — **always purple, unsigned**.
**Comparison:** month vs ledger are **DIVERGENT** — different formatter (`formatCurrency`
unsigned-int vs `usd` 2-dp), different color (green/red-by-sign vs always-purple), different
sign ("+" vs none). — RISK (no shared convention).

### 6. Does the data carry a type/sign (expense vs income)?
- `budget_line_items` (`schema:1036-1062`): `amount Decimal` (`:1044`, **positive**),
  `coaCode VarChar` (`:1041`), `source` (`:1047`). **No debit/credit/sign/type column.**
- `calendar_events`: `budget_amount Int` (**positive**), `coa_code`, `category` ('trip'). No
  sign.
- **Direction IS derivable** — `chart_of_accounts.account_type` (`schema:115`) +
  `balance_type Char(1)` (`:116`, D/C) classify the COA as expense/income; a trip line's
  `coaCode` (the 9xxx travel accounts) are expense accounts. But **neither the calendar nor
  the ledger joins `coaCode → chart_of_accounts`** to read it.
**Finding:** everything is stored as an **unsigned positive**; expense-vs-income is **derivable
via the COA join (not stored as a sign), and never performed today**. — RISK / data-model
finding. **A migration is NOT required** to color trip lines red (they're all expenses, or
derive via COA). (`schema:1041-1047, 115-116`)

### 7. Existing color convention elsewhere
**Trading already has the convention (signed P&L):** `TradeLabPanel.tsx`:
- `Number(card.link.actual_pl) >= 0 ? 'text-brand-green' : 'text-brand-red'` (`:422, :581`)
- `max_profit` → `text-brand-green` (`:430`); `max_loss` → `text-brand-red` (`:432, :554`)
This is **green = profit/≥0, red = loss/<0**, driven by a genuinely **signed** number
(`actual_pl` can be negative). — EXISTS (the reference convention), but **inline, not shared**.
The CalendarGrid `isWin/isLoss` (`:707-742`) is the *same* convention **misapplied** to
unsigned trip amounts.
**Shared money formatter:** **MISSING** — `grep src/lib` for formatCurrency/formatUsd/
formatMoney/formatAmount returned nothing. Each site rolls its own: `usd`
(`TripBudgetActual.tsx:56`), `formatCurrency` (`CalendarGrid.tsx:113`), `fmtDollar`
(`TradeLabPanel.tsx`). — MISSING (no single source).

---

## (a) PHANTOM — answer
- **Exact line using stored end_date:** `CalendarGrid.tsx:298-303` (`eventsByDateKey` indexes
  the second day off `e.endDate`).
- **`duration_minutes` available there:** YES (`CalendarEvent.durationMinutes`, `:23`; in
  scope at `:292`).
- **What a duration-aware month fix requires (SMALL):** in `eventsByDateKey`, for a trip
  flight with `durationMinutes`, index the **derived** day span (`startDate` →
  `startDate + ceil((startMin + durationMinutes)/1440) − 1` days) instead of the stored
  `end_date`. At month/day granularity this is simpler than PR-3 (no per-minute geometry —
  just which day-keys to push into). For the live row, derived end = Jul 1 (00:00+1145min =
  19:05 same day) → index **Jul 1 only**. Non-trip / null-duration events keep current
  start..end indexing. — SMALL-FIX.

## (b) SIGN SOURCE OF TRUTH — answer
- **Derivable from stored data TODAY?** Direction yes (via `coaCode → chart_of_accounts.
  account_type/balance_type`, `schema:115-116`), but it is **not stored as a sign** and **not
  read** anywhere in calendar/ledger. Trips are uniformly expense accounts, so "trip line =
  expense (money out)" is a safe, no-join classification.
- **Migration needed?** **NO.** Coloring trip amounts red/negative is a **SMALL display fix**
  (treat `source==='trip'`/trip COA as expense, or do the COA join). A full **signed**
  general-ledger model (store negatives) would be a migration but is **not required** here.
  Trading's green/red is already correct (it has a real signed `actual_pl`).

## (c) CONVENTION MAP — every money-with-color/sign site
| Site | Cite | Today |
|---|---|---|
| Month cell amount + cell glow | `CalendarGrid.tsx:707-719, 738-742` | green/red by `dayTotal>0` (misapplied to expenses) + "+" |
| Day/week block amount | `CalendarGrid.tsx:634, 651` | `formatCurrency`, plain (no color/sign) |
| Day/week day-total footer | `CalendarGrid.tsx:686` | `formatCurrency`, `text-text-secondary` |
| Ledger amount + total | `TripBudgetActual.tsx:280, 330` (`usd` `:56`) | always `text-brand-purple`, unsigned |
| Trading P&L / max P/L | `TradeLabPanel.tsx:422, 430, 432, 581` | green/red by signed `actual_pl` (correct) |

**For ONE convention (expense=red/negative, profit=green, loss=red):** create a shared util —
**MISSING today** — e.g. `src/lib/money.ts` exporting `formatMoney(value, { signed })` +
`moneyColorClass(value | { amount, direction })` returning `text-brand-green`/`text-brand-red`/
neutral per the rule. Route **month** (`CalendarGrid:739-740`), **ledger**
(`TripBudgetActual:330, 280`), **day-block** (`CalendarGrid:651, 686`), and **trading**
(`TradeLabPanel:422,581`) through it. The per-domain sign rule: trades pass a real signed
P&L; trips pass `amount` flagged as an expense (→ negative/red). `brand-green`/`brand-red`
tokens already exist (used by Trading). — the build is a shared formatter + wiring, **no
schema**.

---

## Recommended atomic PR sequence

1. **PR-Month-Phantom-Fix** — **SMALL-FIX.** In `eventsByDateKey` (`CalendarGrid.tsx:297-303`),
   for trip flights with `durationMinutes`, index the **derived** day span instead of stored
   `end_date`, so the flight lands only on the day(s) the duration covers (Jul 1 only). Mirrors
   PR-3's derived-end at day granularity. No migration. Fixes (a).
2. **PR-Money-Convention** — **SMALL/MED (no migration).** Add `src/lib/money.ts` (shared
   formatter + color rule). Fix the month cell so trip **expenses** read red/negative (not the
   `isWin` green): stop treating a positive trip total as a profit — drive sign from the
   expense classification (`source==='trip'` or COA), keep trade green/red as-is (already
   signed). Route month + ledger + day-block through the shared util. Fixes (b)/(c).
   - **Honesty:** this is **not** a REAL-BUILD — the data sign is derivable (trips are
     expenses) and Trading already carries a signed P&L. Only escalates to REAL-BUILD if you
     later want a fully signed debit/credit ledger stored on `budget_line_items`
     (migration) — explicitly out of scope for the color fix.

*Do not implement — audit only.*
