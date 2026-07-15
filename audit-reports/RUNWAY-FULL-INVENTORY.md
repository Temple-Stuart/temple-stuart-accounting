# RUNWAY-FULL-INVENTORY — everything the real Runway tab renders, where every number comes from

**Date:** 2026-07-15 · **Branch:** `claude/runway-full-inventory` · **READ-ONLY — no code changed, no design.**
Mirror of the BOOKS/TAX/PROJECTS-CONTENT inventories: the map for the Runway deck. Runway is the
THESIS TAB — the audit's job is the CROSS-MODULE LINKAGE, traced concretely below.

**Entry** (`ModuleLauncher.tsx`): tab key `calendar`, label **"Runway"** (`:118`), the tab the page
opens on (`activeModule` default `'calendar'`, `:195`). Blurb: *"Runway — how long your money buys
you. Your planned and actual spend, mapped to the day, so your runway is never a guess."* (`:146`).
**Authed** (`:590-604`): `<HubCalendar/>` (self-fetching) above
`<RunwayDataProvider><RunwayBudgetPanel/></RunwayDataProvider>`. **Logged-out** (`:605-622`): the
prior audit's "honest empty grid — shows chrome, not value" is confirmed —
`<HubCalendar demoEvents={[]}/>` (the truthy-empty-array guard → zero fetches,
`HubCalendar.tsx:173,:180`) + `<RunwayBudgetPanel preview={true}/>` (the REAL empty shells: cash
"No bank linked", windows "—"/insufficient_history, trading "not tracked" — zero authed fetches,
`RunwayBudgetPanel.tsx:150-175,:190,:201`).

## THE REAL CAUSAL ORDER (= the slide order)

1. **The calendar** — the day/week/month grid of everything scheduled, four legend layers
   (`HubCalendar.tsx:73-88`): **Trip ✈️ cyan · Projects 🎯 indigo · Routines 🔁 teal · Trade 📈
   amber** (Trade is configured but fed by nothing — §NOT-LIVE).
2. **The runway readout** (`RunwayBudgetPanel.tsx:251-281`): the **Cash card** ("Plaid balance ·
   operating (excl. trading) · as of {date}") + two trailing-window cards (**3mo / 6mo**), each
   showing Net burn / Runway / Zero date + the per-entity Personal/Business split, with the formula
   printed on-screen: *"Net burn = expenses − income over the trailing full calendar months
   (trailing ledger actuals); runway = cash ÷ net burn/mo."* (`:276-280`).
3. **The trading strip** (`:283-325`) — *"separate from operating runway"*: Realized P&L (the one
   truthfully-derivable figure) + Capital and Max drawdown both declared **"not tracked yet"** with
   reasons. A 403 renders the honest cross-sell: *"Trade module locked — subscribe on the Trade tab
   to see realized P&L here."* (`:291-294`).
4. **The Budget panel** with a **Month / Year toggle** (`:219-248,:327`):
   - **Month** → `HubBudgetSection` — Category | COA | Budget | Actual | Variance | Variance % with
     a **Personal / Business / Travel / Trading** toggle (`HubBudgetSection.tsx:47-52`), month+year
     selectors, totals footer; variance % = ((actual/budget)−1)×100 with a zero-denominator guard
     (`:98`); over-budget red / under green (`:197-206`).
   - **Year** → `BudgetComparison` — the travel-vs-home what-if: a 12-month **travel-months
     toggle** ("Travel months (homebase costs excluded)"), summary tiles Home Months Cost / Travel
     Months Cost / **Travel Savings** (green/red) / **Effective Total** ("{year} projected"), the
     Homebase/Business/Travel × 12-month grid, and the committed-trips footer row
     (`BudgetComparison.tsx:108-270`).
5. **The drill-down** — click any ACTUAL cell → `BudgetDrillDown` opens the ledger transactions
   behind that COA × month, merchant names included (`HubBudgetSection.tsx:110-113,:233-236`;
   `drill-down/route.ts:50-76` joins `transactions` via `je.source_id` for `merchantName`). The
   BUDGET cell is inert (HB-3 pending — §NOT-LIVE).

## 1. THE RUNWAY NUMBER — formula + every input traced (`/api/runway`, verified line-by-line)

Compute-on-read over **trailing FULL calendar months** — never YTD, by design (route header
`:8-11`). Two windows (3mo, 6mo), current partial month excluded (`:84-92`).

| Input | Formula leg | Source traced | Cite |
|---|---|---|---|
| **cash** | `SUM(accounts.currentBalance)`, user-scoped, `entityType IS DISTINCT FROM 'trading'` | **Plaid-synced stored balances** (the `accounts` table the Books cockpit/link flow populates). Combined across operating accounts — "entity-scoping cash is a follow-up" (`:18-19`); NOTE: no netting by account type, so a credit-card `currentBalance` adds positively | `runway/route.ts:94-109` |
| **expenses** | ledger debits on `account_type='expense'` COAs in-window | **The Books ledger** — committed, non-reversed journal entries (`is_reversal=false`, `reversed_by_entry_id IS NULL`), excl. Trading entity | `:123-144` |
| **income** | ledger credits on `account_type='revenue'` COAs in-window | same ledger basis | `:123-144` |
| **net burn/mo** | `(expenses − income) ÷ N` | — | `:176-177` |
| **runway** | `cash ÷ net burn/mo` (round 0.1) | — | `:209-210` |
| **zero date** | `today + runway × 30.436875 days` | — | `:44,:211` |

**OPERATING scope**: Personal + Business only; the **Trading entity is EXCLUDED** from cash and
burn by immutable `entity_id` (`:51-65` — "trading P&L is not operating burn", decision
`audits/RUNWAY-ENTITY-MODEL.md`). **Four truthful states, no fallback** (`:31-36,:197-212`):
`no_cash` ("No bank linked") · `insufficient_history` ("Need N full months") ·
`cashflow_positive` ("Cash-flow positive" / "no burn") · `ok` (the only state where
runway_months/zero_date exist). **Entity dimension**: an additive per-entity breakdown
(Personal + Business + `unattributed` === combined, `:146-194`) renders under each window card
(`RunwayBudgetPanel.tsx:128-145`); a stray entity surfaces amber as "Unattributed" — never
silently dropped. Per-entity runway/zero-date deliberately absent ("cash is not entity-split this
PR", `:101-103`).

## 2. TRADING STRIP (`/api/trading/realized-pnl`, verified)

Realized P&L = **4100 credits (gains) − 5100 debits (losses)** on the Trading entity's ledger —
exactly the codes the Trade module's commit-to-ledger posts on trade close (WIN→CR 4100, LOSS→DR
5100; route header `:12-16`). Period = all-time. Gated **tab:trade** (`requireTabAccess`, `:55-56`)
— the paywall, not a cost control; 403 → the panel's honest "locked" state. Capital and drawdown:
`tracked: false` with printed reasons ("no contributions/withdrawals posted to the trading
ledger" / "no peak/trough data tracked") — declared, never fabricated (`:17-27`).

## 3. BUDGETS — planned vs actual, sources traced (the free-tier feature)

All three budget routes return the same shape (budgetData/actualData keyed coa → month; coaNames).
**Actuals are ALWAYS the Books ledger** (committed, non-reversed debits by COA × month — e.g.
`year-calendar/route.ts:122-139`). **Planned differs per toggle — and this is cross-module**:

| Toggle | Route | PLANNED source | ACTUAL source |
|---|---|---|---|
| Personal | `/api/hub/year-calendar` | **Budgeted ROUTINES ONLY** — `operations_routines` rows with `budget_amount`+`coa_code`, RRULE-expanded to occurrences-per-month × amount (`routinesMonthlyByCoa`; "the legacy flat `budgets` table is no longer read here", `:66-115`). Personal-entity expense COAs, travel 7xxx excluded (`:45-46`) | ledger debits, personal entity (`:122-139`) |
| Business | `/api/hub/business-budget` | **Budgeted ROUTINES** (same bridge; "the legacy `budget_line_items` table is no longer [read]", `:67,:77,:100-105`) | ledger debits, sole_prop entity |
| Travel | `/api/hub/nomad-budget` | **`budget_line_items` with `source: 'trip'`** — the Travel module's committed trip budgets (`:87-115`); travel COAs 9xxx + legacy 7xxx (`:6-32`) | ledger debits on travel COAs |
| Trading | — | **NO ROUTE** — the honest pending state: *"Trading budget — route pending (HB-2). No data to show yet."* (`HubBudgetSection.tsx:45,:51,:159-163`) | — |

Empty state: *"No budget or actual activity for {Month} {Year}."* (`:166-169`).

## 4. PROJECTIONS / SCENARIOS — ruling

**A runway "if I cut X, runway extends to Y" mechanic is NOT BUILT** — nothing anywhere recomputes
runway under hypotheticals. The ONE live what-if is `BudgetComparison`'s **travel-months toggle**:
mark months as travel → homebase costs struck out for those months → Travel Savings and the
Effective Total recompute live (`BudgetComparison.tsx:108-119` — math copied byte-for-byte from
/hub). It is a BUDGET scenario (projected yearly cost), not a runway scenario. A deck may show the
travel-months what-if; it may NOT advertise runway scenario modeling.

## 5. THE CALENDAR — event layers traced (the day-level linkage)

`HubCalendar` (shared `CalendarGrid`, day-view default, phone day-only; `:243-256`) merges three
live layers (`gridEvents :179-217`):

| Layer | Fetch | Tables | Owner module |
|---|---|---|---|
| **Trip ✈️** | `/api/calendar` filtered to `source==='trip'` (`:128,:132`) | `calendar_events` (itinerary/booking rows; lodging amortization COA 9200) | Travel |
| **Projects 🎯** | `/api/operations/daily-plan/items` (`:141`) | `operations_daily_plan_items` → `operations_calendar_blocks` → `operations_project_tasks` (title/cost/COA) | Operations — the SAME daily-plan seam Projects' "↗ schedule" and Content's "+ add to day" write |
| **Routines 🔁** | `/api/hub/operations-routines` (`:153`) | `operations_routines`, RRULE expanded on-the-fly (window ≤92d, ≤500 occurrences → truncated flag) | Operations/Routines |
| **Trade 📈** | **none** | — | NOT WIRED (§NOT-LIVE) |

Click → live project blocks open **HubEventCard** (reschedule / reconcile actuals — writes back to
`operations_calendar_blocks` + task `actual_cost_usd`/`actual_minutes`; "Open in Projects →");
everything else opens the read-only **EventDetailPanel** (a self-declared scaffold — "The blank
fields fill in once this is wired to your account."). `UnscheduledTaskTable` and `TripExpensesCard`
are **/hub-page only** — NOT on this tab.

## THE CROSS-MODULE LINKAGE MAP (the deck's story)

```
                        ┌────────────────────────────────────────────────┐
  Plaid link (Books) ─► accounts.currentBalance ──► RUNWAY cash          │
  Books commits ──────► ledger_entries ┬──────────► RUNWAY burn/income   │  runway =
   (journal_entries,                   ├──────────► BUDGET actuals       │  cash ÷ burn
    committed, non-reversed)           └──────────► DRILL-DOWN rows ◄─── Plaid transactions
                                                    (merchant names via je.source_id)
  Routines (budget_amount × RRULE) ───────────────► BUDGET planned (Personal + Business)
  Travel trips (budget_line_items source='trip') ─► BUDGET planned (Travel) + trips footer row
  Trade commit-to-ledger (WIN CR 4100 / LOSS DR 5100, Trading entity) ─► TRADING strip
    (and the SAME Trading entity is EXCLUDED from runway cash + burn — by entity_id)
  Projects "↗ schedule" / Content "+ add to day" ─► daily-plan items + calendar blocks ─► CALENDAR 🎯
  Routines RRULE ─────────────────────────────────► CALENDAR 🔁    Travel itinerary ─► CALENDAR ✈️
```

Every number on the tab traces to another module's data: **the tab only works because the platform
links every system into one** — the thesis, literal.

## PHASE 2 — mountability (three-tier)

| Piece | Verdict | Basis |
|---|---|---|
| `HubCalendar` | **SEED-GUARDED MOUNTABLE** — the one self-fetcher with a built-in safe seam: any truthy `demoEvents` → zero fetches + renders the seed (`:173,:180`); production-proven at `ModuleLauncher.tsx:611` (`demoEvents={[]}`). A DECLARED example-events array can drive a living demo calendar with zero fetches | self-fetch + guest seam |
| `EventDetailPanel` | **DIRECT REUSE** — pure props, zero fetch (`:16-18,:27-30`) | |
| `HubEventCard` | props-in / **mutate-out** — zero read-fetches but reschedule/reconcile PATCH live routes; demo path never opens it (`HubCalendar.tsx:225` `!isDemo`) | mirror or keep unreachable |
| `RunwayBudgetPanel` | self-fetching (`:192,:203`) with the **preview guard** — but preview yields ONLY the empty shells (`previewRunway()` `:156-169`). A POPULATED runway readout has NO data seam → **STATIC MIRROR** for populated cards |
| `HubBudgetSection` / `BudgetComparison` | self-fetching (`:81`; `:55-104`) with preview-empty guards → populated tables = **STATIC MIRROR** |
| `BudgetDrillDown` | self-fetches `/api/hub/drill-down` on open → **STATIC MIRROR** |
| `RunwayDataProvider` | self-fetching, **context unconsumed** (§NOT-LIVE) — never mount |

## THE EXAMPLE-SCENARIO MATH — the Books set through the real formula

The cross-deck story ("the books you saw feed the runway you see") WORKS on the established set,
with one declared extension. Running `runway/route.ts:94-233` by hand on the Books deck's data
(as-of mid-July 2026 → windowEnd 2026-07-01; 3mo = Apr–Jun; 6mo = Jan–Jun):

- **cash** = SUM(currentBalance) over the 3 linked feeds = 9,400 + 2,500 + 3,100 = **$15,000**
  (`accountsLinked 3`) — exactly the Books deck's feed total. Honesty note the deck must carry: the
  formula sums stored balances without netting account types (the 3,100 is the card), and cash is
  combined operating (the route's own follow-up note `:18-19`).
- **6mo window (Jan–Jun)** = the Books H1 totals verbatim: expenses 5,100 − income 8,400 =
  **netBurnTotal −3,300 → −$550/mo → state `cashflow_positive`** — renders "Cash-flow positive" /
  "no burn" / "$550/mo in". The Books set is profitable; the engine says so honestly.
- **3mo window (Apr–Jun)** — declare the seasonal split (an EXTENSION consistent with the H1
  totals and the Books deck's June journal: Jun revenue $412; Apr 400 + May 388 + Jun 412 = 1,200):
  expenses 3,000 − income 1,200 = **netBurnTotal 1,800 → $600/mo → state `ok` →
  runway = 15,000 ÷ 600 = 25.0 months → zero date ≈ 2028-08-14** (25 × 30.436875 = 760.9 days).
- **The two windows DISAGREEING is the demo's teeth**: the half-year says cash-flow positive; the
  recent quarter says 25.0 months — precisely why the product shows both windows. Entity split:
  the Books set is all Business → Business carries the burn ($600/mo out), Personal renders $0
  (the renderer shows "$0/mo in" for a zero entity — engine-true).
- Budgets on the set: no budgeted routines are declared in the demo world yet → Personal/Business
  planned = $0 with ledger actuals only, OR the deck declares budgeted routines (e.g. the Content
  deck's Morning/Truck routines given budget_amount + COA) — deck's choice; both engine-true.
  Trading strip: zero-state (+$0 · 0 trades) or the real locked cross-sell string — deck's choice.

**Verdict: derive from the Books set** — no bigger scenario needed; the numbers are meaningful and
the reconciliation with the Books deck is exact (the $15,000, the 5,100/8,400 H1, the $412 June).

## NOT-LIVE / BANNED-FROM-DECK LIST

1. **Runway scenario modeling** ("cut X → runway Y") — NOT BUILT. Only the travel-months budget
   what-if exists (§4).
2. **Trading budget** — "route pending (HB-2)" (`HubBudgetSection.tsx:159-163`); never show rows.
3. **Trading capital / max drawdown** — "not tracked yet", declared reasons; never show numbers.
4. **The Trade 📈 calendar layer** — configured, fed by nothing ("wired to your trading account"
   is future copy); a deck must not show trade events as live.
5. **The BUDGET cell drill** — inert ("HB-3 wires the budget → budget_line_items drill",
   `HubBudgetSection.tsx:14-16,:188`); only ACTUAL cells drill.
6. **`RunwayDataProvider`** — its context has ZERO consumers (grep; ModuleLauncher's own comment
   `:617-620`) yet the authed mount still fires its 3 budget fetches, duplicating the children's
   own self-fetches (6 requests for 3 routes). Dead-but-firing wiring — flag for cleanup; never
   part of a deck.
7. **EventDetailPanel's scaffold fields** — Entity/Task/Billable/Actual$ are permanent "not set
   yet"; the deck may show the panel only as what it is.
8. **Stale comment** — `ModuleLauncher.tsx:583-586` still describes a logged-out "LIVING DEMO fed
   a static fictional seed"; the actual guest code passes `demoEvents={[]}` (the honest empty
   grid, `:608-611`). The seed-fed living demo is a CAPABILITY (the seam exists) but is not what
   ships today.
9. `/api/income` — consumed only by the separate `/income` page, not this tab.
10. `/api/calendar`'s non-trip sources (home/auto/shopping/personal/health/growth) + its summary
    block — computed, never rendered here ("dead, unused", route `:30-34,:86-87`).

## DISCLAIMERS / COVERAGE DECLARATIONS the tab carries (decks inherit)

- The on-screen formula: "Net burn = expenses − income over the trailing full calendar months
  (trailing ledger actuals); runway = cash ÷ net burn/mo." (`RunwayBudgetPanel.tsx:276-280`).
- Source labels on the cards: "Plaid balance · operating (excl. trading)" · "trailing ledger
  actuals" · "trading ledger, realized (4100 gains − 5100 losses)".
- "separate from operating runway" on the Trading strip (`:289`).
- The truthful window states verbatim: "No bank linked" / "Need N full months" / "Cash-flow
  positive" / "insufficient history".
- "Runway unavailable — could not load cash + burn." (declared error, never zeros, `:255-256`).
- "Trade module locked — subscribe on the Trade tab to see realized P&L here." (`:291-294`).
