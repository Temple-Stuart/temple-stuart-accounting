# Existing hub Budget Comparison + drill-in to committed expenses (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline:** the hub already has a **full budget stack** — a month-grid "Budget Comparison", three
per-COA "Budget vs Actual" tables (Homebase/Travel/Business), **and a working drill-in**
(`BudgetDrillDown` + `/api/hub/drill-down`). The new under-calendar section is **NOT greenfield**:
it reuses the three budget routes, the actuals-by-COA pattern, and the drill component. Two real
gaps: (1) the **drill-in today targets ACTUALS** (ledger), not the budget figure — a budget drill
needs the same pattern pointed at **`budget_line_items`**; (2) **Personal/Homebase planned comes
from the flat `budgets` table** (no line items behind it → nothing to drill), while **Travel +
Business planned already come from `budget_line_items`** (committed expenses, drillable today). The
"Routine-mapped planned" the user wants **does not exist** — `operations_routines` has **no
cost/COA field** and nothing writes `budget_line_items` with `source='recurring'`.

---

## 1. THE BUDGET COMPARISON (month-grid)

`src/app/hub/page.tsx` — "Budget Comparison · FY {year} · Homebase + Business + Travel"
(`:522-523`), a Category × Jan–Dec grid (`:517-665`). Rows are **hardcoded to three sources**, not
entity-iterated:
- **Homebase** row (`:603-613`): `Object.values(homebaseBudget.budgetData).reduce(...)` per month.
- **Business** row (`:618-621`): `businessBudget.budgetData`.
- **Travel** row (`:626-629`): `nomadBudget.budgetData`.

Those three states are filled by three fetches (`:305, :321, :337`):
- `homebaseBudget` ← **`/api/hub/year-calendar?year=`** (`:305-318`).
- `nomadBudget` (Travel) ← **`/api/hub/nomad-budget?year=`** (`:321-334`).
- `businessBudget` ← **`/api/hub/business-budget?year=`** (`:337-350`).

Each returns `{ budgetData: Record<coa, Record<month, $>>, actualData, coaNames, budgetGrandTotal,
actualGrandTotal }`. **"Homebase" is NOT a dynamic entity row — it is hardcoded** to the
`homebaseBudget` state (the `personal` entity), same for Business/Travel. — EXISTS,
`hub/page.tsx:517-665, 305-350`.

## 2. THE "BUDGET vs ACTUAL" PER-COA TABLES (BUD/ACT rows)

Three tables, each per-COA with a BUD row + an ACT row, monthly:
- **Homebase Operating Expenses · Budget vs Actual** (`:667-741`) — rows from
  `homebaseBudget.coaNames` (`:687`); `BUD` from `homebaseBudget.budgetData` (`:700`-area), `ACT`
  from `homebaseBudget.actualData` (`:689, :709`).
- **Travel Operating Expenses** (`:743-~810`) — `nomadBudget`.
- **Business** (`:843-886`) — `businessBudget`.

**BUD source** (differs by table — the key finding):
- Homebase BUD = **`budgets` table** — `prisma.budgets.findMany({ userId, year, accountCode IN
  ['P-6100',…] })` then the monthly columns `jan…dec` (`year-calendar/route.ts:69-91`).
- Travel BUD = **`budget_line_items`** where `source='trip'`, summed by coaCode×month
  (`nomad-budget/route.ts:89-117`).
- Business BUD = **`budget_line_items`** where `source='business'`, summed by coaCode×month
  (`business-budget/route.ts:68-88`).

**ACT source — ALL THREE = the double-entry bookkeeping ledger:**
```
SELECT coa.code, EXTRACT(MONTH FROM je.date), SUM(CASE WHEN le.entry_type='D' THEN le.amount END)
FROM ledger_entries le
JOIN journal_entries je ON le.journal_entry_id = je.id
JOIN chart_of_accounts coa ON le.account_id = coa.id
JOIN entities e ON coa.entity_id = e.id
WHERE je.userId=… AND je.is_reversal=false AND reversed_by_entry_id IS NULL
  AND EXTRACT(YEAR FROM je.date)=year AND e.entity_type='personal' AND coa.account_type='expense'
GROUP BY coa.code, EXTRACT(MONTH FROM je.date)
```
(`year-calendar/route.ts:98-115`; identical shape in `nomad-budget:126-139`,
`business-budget:98-114`). **ACT = `ledger_entries` (the posted double-entry ledger), NOT raw Plaid
`transactions`** — though the drill joins `transactions` for the merchant label (§e). — EXISTS,
confirmed bookkeeping-sourced.

## 3. THE PLANNED/BUDGET SOURCE TODAY (what to replace)

- **Homebase/Personal planned = `budgets`** (`prisma/schema.prisma:485-509`): `userId +
  accountCode ('P-6100') + year`, with **flat monthly Decimal columns `jan…dec`**. No line items,
  no COA join — just twelve numbers per account-code per year. This is the table the user wants to
  replace with Routine-mapped data. **Written by ~10 feature routes** (home/auto/shopping/health/
  personal/growth/agenda `[id]` routes, `trips/commit`) — it holds **real user-entered budget
  data**. — EXISTS / RISK (data-bearing, many writers).
- **Travel + Business planned = `budget_line_items`** (already committed-expense-backed) — kept.

## 4. "COMMITTED EXPENSE" in the schema

**`budget_line_items`** (`prisma/schema.prisma:1050-1075`) is the committed/planned-expense record:
`coaCode`, `year`, `month`, `amount`, `description`, `source` (`'trip'|'manual'|'recurring'`,
`:1061`), `tripId`, `itineraryId`, `entity_id` (nullable, **unused** — `:1065-1067`). A Travel/
Business budget figure **IS** the sum of these by coaCode×month (§2). So **drilling a Travel/
Business budget figure → its `budget_line_items` is a direct reverse of the existing roll-up.** —
EXISTS / REUSABLE.

Parallel committed representations (same money, different surface): `calendar_events.budget_amount`
(the calendar row, written alongside `budget_line_items` by `vendor-commit`) and
`hub_scheduled_items.budget_usd` (the unwired canonical store, `schema.prisma:2993`). —
EXISTS-BUT-UNUSED (hub_scheduled_items).

**Homebase has NO committed-expense rows** — its budget is the flat `budgets` table → **nothing to
drill into** (the core gap for the new drill-in). — RISK.

## 5. ROLL-UP pattern

The reverse of the drill: budget figures are built by aggregating `budget_line_items` by coaCode×
month — `for (item of items) budgetData[coa][month] += amount` (`nomad-budget/route.ts:106-117`;
`business-budget:81-88`). The actuals roll-up is the SQL `GROUP BY coa.code, EXTRACT(MONTH…)`
(§2). A **budget drill-in query** is the inverse: `SELECT * FROM budget_line_items WHERE userId AND
year AND month AND coaCode IN (…) AND source=…` (+ join `trips` for the name, as
`nomad-budget:95-99` already does). — REUSABLE.

## 6. ACTUALS-TO-BUDGET LINKAGE

**There is NO `budget_line_id` on transactions/ledger_entries.** Budget and actual are matched by
**`coa.code` + `entity_type` + period (`year`,`month`)** — the budget is keyed `(accountCode/
coaCode, year, month)` and the actuals `GROUP BY coa.code, month` under the same `entity_type` and
`year` filter (§2). Budget-vs-actual works purely by this **COA × entity × period** join, in code,
not by FK. — EXISTS (the linkage), `year-calendar/route.ts:69-115`.

## 7. ENTITY MAPPING

- **Personal/Homebase** → `entities.entity_type = 'personal'` (`year-calendar:29, :111`;
  `nomad-budget:57`).
- **Business** → `entity_type IN ('sole_prop','business')` (`business-budget:29, :111`;
  `drill-down:37-39`).
- **Travel** → **NOT an entity** — a **COA-scoped view**: budget from `budget_line_items
  (source='trip')` and actuals from the travel COA codes (9100–9600, `nomad-budget`'s hardcoded
  `TRAVEL_COA_NAMES :7-22`), under the personal entity. — Travel is a **trip/COA-derived view**.
- **Trading** → the `entity_type='trading'` entity **EXISTS** (used in `batch-trade-processor.ts:403`
  etc.) but **there is NO trading budget route** under `/api/hub` (only year-calendar/nomad/
  business). The 4th toggle's planned/actual view is **MISSING** (a new route, no migration — the
  entity, its COA, and its ledger actuals already exist). — MISSING (route).

## 8. THE DRILL-IN (already exists) + WHAT TO DISCONNECT

**Drill-in EXISTS and works** — `BudgetDrillDown` (`hub/page.tsx:7`), `openDrill(coaCodes, month,
name, amount, entityType)` (`:355-357`), `drillDown` state (`:180`), route **`/api/hub/drill-down`**.
It currently fires on the **ACT cell only** (e.g. `:709` `onClick={() => openDrill([code], i, name,
act, 'personal')}`) and returns the **ledger transactions** behind the actual:
`ledger_entries ⨝ journal_entries ⨝ chart_of_accounts ⨝ entities LEFT JOIN transactions` filtered
by `coaCodes + month + year + entity_type + entry_type='D'` (`drill-down/route.ts:51-76`). — EXISTS
(actuals drill) / REUSABLE (the same shape, repointed at `budget_line_items`, gives the budget
drill).

**Disconnect map (what the new budget section would stop reading) — nothing safe to DROP:**
| Source | Role today | Replaceable? | Flag |
|---|---|---|---|
| `budgets` table | Homebase **planned** (`year-calendar:69`) | **Stop reading only after** a routine-mapped source exists | **RISK — data-bearing**, ~10 writers (home/auto/shopping/health/personal/growth/agenda/trips-commit). Migrate/keep, never drop. |
| `budget_line_items` | Travel+Business planned **and** the committed-expense drill target | **KEEP** | The drill-in source — do not disconnect. |
| `/api/hub/year-calendar` budget half | feeds Homebase BUD | repoint `budgetData` to routines | read-swap; its **actuals half (ledger) must stay**. |
| `nomad`/`business` budget routes | Travel/Business BUD+ACT | KEEP | already line-item-backed. |

**The Routine→planned bridge does NOT exist:** `operations_routines` has **no cost/budget/COA
column** (confirmed — grep empty), and **nothing writes `budget_line_items` with
`source='recurring'`** (grep empty) even though the enum value is declared (`:1061`). So
"Routine-mapped planned" is a **build + migration**, not a re-wire. — MISSING.

---

## Explicit answers

**(a) Existing budget components.** Month-grid "Budget Comparison" (`hub/page.tsx:517-665`) + three
per-COA "Budget vs Actual" tables (Homebase `:667-741`, Travel `:743-810`, Business `:843-886`) +
a FY summary block (`:488-515`). Fed by `/api/hub/year-calendar`, `/api/hub/nomad-budget`,
`/api/hub/business-budget` (`:305-350`). Rows hardcoded per source, not entity-iterated.

**(b) Planned source TODAY vs Routine-mapped.** TODAY: Homebase = **`budgets`** flat monthly table
(`year-calendar:69`); Travel/Business = **`budget_line_items`** (`nomad/business`). DESIRED:
planned from **Routines** — but `operations_routines` has **no cost/COA** and the
`source='recurring'` line-item path is **unwritten**. GAP = the entire routine→money mapping.

**(c) "Committed expense".** A **`budget_line_items`** row (`schema:1050-1075`): `coaCode, year,
month, amount, source∈{trip,manual,recurring}, tripId, itineraryId`. Travel/Business budget figures
are sums of these; that is exactly what a budget drill expands to. (Homebase budget = `budgets`,
which has none — nothing to drill until it's line-item-backed.)

**(d) Actuals-to-bookkeeping linkage — wired.** YES. ACT = `ledger_entries ⨝ journal_entries ⨝
chart_of_accounts ⨝ entities`, `GROUP BY coa.code, month` (`year-calendar:98-115`). No FK — matched
by **COA code + entity_type + period**. Confirmed live in all three routes + the drill-down.

**(e) Drill-in feasibility.** **Budget drill is feasible NOW for Travel + Business** (their budget
IS `budget_line_items`): `SELECT * FROM budget_line_items WHERE userId AND year AND month AND coaCode
IN (…) AND source=… ` (join `trips` for the name). The existing `/api/hub/drill-down` is the
REUSABLE template (currently `ledger_entries`). **NOT feasible for Homebase** until its planned side
is line-item-backed (routine-mapped or `budget_line_items source='recurring'`) — the `budgets` flat
table has nothing behind a figure.

**(f) Disconnect map.** Stop-reading-only-after-replacement: **`budgets`** (Homebase planned —
RISK, data-bearing, ~10 writers; migrate, never drop). **Keep:** `budget_line_items` (drill target),
the ledger/actuals half of all three routes, the nomad/business budget routes. No table is safe to
drop; the only "disconnect" is repointing `year-calendar`'s `budgetData` read once a routine source
exists.

**(g) Recommended PR sequence (every migration flagged).**
1. **PR-HB-1 — under-calendar budget section shell + 4-toggle (SMALL-MED, no migration).** A new
   component below the calendar reading the **existing** `year-calendar`/`nomad`/`business`
   `budgetData`+`actualData` for Personal/Travel/Business; Trading tab shows "not yet" until PR-2.
   Pure reuse of the three routes.
2. **PR-HB-2 — Trading budget route (MED, no migration).** New `/api/hub/trading-budget` mirroring
   the others over `entity_type='trading'` (entity + COA + ledger actuals already exist; planned
   side may be empty until a trading planned source is defined).
3. **PR-HB-3 — budget drill-in (SMALL-MED, no migration).** New `/api/hub/budget-drill-down`
   targeting `budget_line_items` (mirror `drill-down/route.ts`), reuse the `BudgetDrillDown` panel,
   wire it to **BUDGET** cells. Works for Travel/Business immediately; Personal/Trading pending
   their line-item source.
4. **PR-HB-4 — Routine→planned mapping (LARGE, MIGRATION).** Add a **cost + COA** to routines
   (either columns on `operations_routines` or a `routine_budget` table) and a writer that emits
   `budget_line_items (source='recurring')` (or a routine-derived planned aggregation). This is the
   one true migration; it unblocks Personal drill-in **and** the `budgets`-table replacement.
   Consider routing through the already-built **`hub_scheduled_items.budget_usd`** (unwired
   canonical) instead of a new table.
5. **PR-HB-5 — disconnect `budgets` read (SMALL, gated on PR-4).** Repoint `year-calendar`'s
   `budgetData` to the routine-mapped source; **keep the `budgets` rows** (no drop — constitutional:
   never SQL-delete user financial data).

### Citation index
- Budget Comparison + per-COA tables + fetches: `hub/page.tsx:305-350, 488-515, 517-665, 667-741,
  743-810, 843-886`.
- Drill-in: `hub/page.tsx:7, 180, 355-357, 709, 733`; `api/hub/drill-down/route.ts:51-76`.
- BUD sources: `year-calendar/route.ts:69-91` (budgets), `nomad-budget/route.ts:89-117` +
  `business-budget/route.ts:68-88` (budget_line_items).
- ACT source (bookkeeping): `year-calendar/route.ts:98-115` (+ nomad/business mirrors).
- Schemas: `budgets :485-509`, `budget_line_items :1050-1075`, `operations_routines` (no cost),
  `hub_scheduled_items.budget_usd :2993`.
- Entities: `entity_type` personal/sole_prop/business/trading (`drill-down:37-39`;
  `batch-trade-processor.ts:403`).
- `budgets` writers (RISK): shopping/agenda/growth/auto/home/health/personal `[id]` routes +
  `trips/commit`.

*Do not implement — audit only.*
