# AUDIT — Project Runway: Budget Consolidation, Time-Period Filtering, Account Balance Tab, Runway Tracker
**Date:** 2026-06-20  
**Branch:** claude/blissful-turing-nwn7pc  
**Auditor:** Claude Code Routine (automated, read-only)  
**Correlation ID:** 0a285929-1495-4283-8ff5-94a109b21ef9  
**Project ID:** 7d0e3963-de30-4909-9377-b5655e281a1d  
**Standard:** Project Runway Research Findings (June 20, 2026)

---

## 1 · WHAT EXISTS (file:line, correctness label)

### Runway Tab — Entry Point

| File | Line | Label | What it does |
|------|------|-------|--------------|
| `src/components/home/ModuleLauncher.tsx` | 80 | **CORRECT** | Tab labeled "Runway" with `key: 'calendar'` |
| `src/components/home/ModuleLauncher.tsx` | 107–108 | **CORRECT** | Descriptor: "Runway — how long your money buys you..." |
| `src/components/home/ModuleLauncher.tsx` | 442–455 | **PARTIAL** | Authed Calendar tab renders `HubCalendar` + `HubBudgetSection` + `BudgetComparison` — stacked, NOT consolidated |

### Existing Budget Components (G1 target)

| File | Line | Label | What it does |
|------|------|-------|--------------|
| `src/components/hub/HubBudgetSection.tsx` | 1–210 | **CORRECT (as-is)** | Month-scoped budget vs. actual table: Category \| COA \| Budget \| Actual \| Variance ($). 4-toggle (Personal/Business/Travel/Trading). Month dropdown + Year stepper. Reuses BudgetDrillDown. |
| `src/components/hub/BudgetComparison.tsx` | 1–271 | **CORRECT (as-is)** | Year-level 12-month grid comparing Homebase vs Business vs Travel planned budgets. Travel months toggle, summary row (Home Months Cost, Travel Months Cost, Travel Savings, Effective Total). NO actual column. |
| `src/components/hub/BudgetDrillDown.tsx` | — | **CORRECT** | Self-fetches `/api/hub/drill-down` for transactions behind a COA × month. Reusable. |

### Budget API Routes

| File | Line | Label | What it does |
|------|------|-------|--------------|
| `src/app/api/hub/year-calendar/route.ts` | 1–203 | **CORRECT** | Returns personal homebase budget + actuals (12 months). Two sources: routines bridge (HB-5 precedence) + legacy `budgets` table. Actuals from `ledger_entries` GROUP BY month. Auth-gated. User-scoped. |
| `src/app/api/hub/business-budget/route.ts` | 1–188 | **CORRECT** | Returns business budget + actuals (12 months). Source: `budget_line_items` (source='business') + routines bridge. Actuals from `ledger_entries`. Auth-gated. User-scoped. |
| `src/app/api/hub/nomad-budget/route.ts` | — | **CORRECT** | Travel budget (source='trip'). Same shape. Auth-gated. |
| `src/app/api/budgets/route.ts` | 1–89 | **PARTIAL** | Legacy budgets CRUD (year + monthly columns). No actuals. Returns `{ budgets }` array — different shape from hub routes. |

### Account Balance Data (G4 prerequisite)

| File | Line | Label | What it does |
|------|------|-------|--------------|
| `src/app/api/accounts/route.ts` | 1–48 | **PARTIAL** | Returns Plaid-linked accounts with `currentBalance` and `entityType`. Auth-gated. User-scoped. **No last-sync timestamp exposed in the response.** `currentBalance` is `Float?` — falls back to 0 silently. |
| `prisma/schema.prisma` | 41–47 | **PARTIAL** | `accounts.currentBalance Float?`, `accounts.entityType String?` — both nullable; personal/business discrimination possible via `entityType` but not enforced (null entityType is unclassified). |

### Income Data (G5 prerequisite)

| File | Line | Label | What it does |
|------|------|-------|--------------|
| `src/app/api/income/route.ts` | 1–60+ | **PARTIAL** | Returns income by COA code. Uses `chart_of_accounts` WHERE `module = 'income'`, then joins `transactions` table. **Different accounting path from expense actuals** (which use `ledger_entries`). Auth-gated. |

### Missing Components (G4, G5)

- **Account balance tab:** Does not exist.  
- **Runway tracker (burn rate + depletion date + burn-down chart):** Does not exist.

### What's Reusable

- `HubBudgetSection.tsx` — the budget panel with the right style, Variance math, and drill-down. Reuse as the base for the consolidated panel.
- `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` — already return 12-month budget + actuals per COA. Reuse without modification for G1 and G3 (with new SQL granularity for day/week).
- `BudgetDrillDown.tsx` — reusable drill-down component.
- `/api/accounts/route.ts` — returns balance data needed for G4 (needs sync-timestamp addition).
- `src/lib/money.ts` — `formatMoney`, `moneyColorClass` — reuse for variance display.

---

## 2 · ASSERTION TEST

### G1 — Budget vs. Actual Output (HubBudgetSection)

| Assertion | Status | File:Line | Detail |
|-----------|--------|-----------|--------|
| **Existence** — Budget figures are real | CORRECT | `year-calendar/route.ts:80–146` | Sourced from routines + `budgets` table |
| **Existence** — Actual figures are real | CORRECT | `year-calendar/route.ts:154–187` | Sourced from `ledger_entries` debits |
| **Completeness** — All COAs returned | CORRECT | `year-calendar/route.ts:82–89` | All active personal expense COAs (non-7xxx) |
| **Accuracy** — Variance math | PARTIAL | `HubBudgetSection.tsx:85` | `variance = actual - budget` ✓. **MISSING: variance %** = `(actual - budget) / budget × 100`. Research standard (G1) requires both $ and %. Only $ is shown. |
| **Cutoff** — Right month | PARTIAL | `year-calendar/route.ts:154–171` | `EXTRACT(MONTH FROM je.date)` is UTC-based. No timezone offset applied. Transactions near midnight UTC on month boundaries can land in the wrong month. |
| **Classification** — Right COA | CORRECT | `year-calendar/route.ts:46` | Personal = homebase codes (non-7xxx). Business separated. |
| **Valuation** — Cents → dollars | CORRECT | `year-calendar/route.ts:180` | `Math.round(Number(row.debits) / 100 * 100) / 100` — cents converted |
| **Rights** — User-scoped | CORRECT | `year-calendar/route.ts:18–24` | `userId: user.id` throughout |

### G1 — BudgetComparison: No Actual Column

| Assertion | Status | Detail |
|-----------|--------|--------|
| **Completeness** — Actuals shown | **FAIL** | `BudgetComparison.tsx:118–271` shows only planned budget figures. Actuals are fetched (`actualData`, line 68–94) but **never rendered** in the comparison table. The table shows Homebase/Business/Travel rows with budget-only amounts. Variance is also absent. |

### G3 — Period Granularity

| Assertion | Status | File:Line | Detail |
|-----------|--------|-----------|--------|
| **Existence** — Day filter | **FAIL** | Not present anywhere | Backend SQL uses `EXTRACT(MONTH ...)`. No day-level aggregation. |
| **Existence** — Week filter | **FAIL** | Not present anywhere | No week-level SQL or client filter. |
| **Existence** — Month filter | CORRECT | `HubBudgetSection.tsx:112–117` | Month dropdown + year stepper — works. |
| **Existence** — Year filter | PARTIAL | Both components | `BudgetComparison` has year stepper. `HubBudgetSection` also. But neither shows a yearly total in a filterable "Year" view — they show a monthly slice, not an annual aggregation. |
| **Accuracy** — No double-count across periods | UNVERIFIED | — | Day/week don't exist to test. |

### G4 — Account Balance

| Assertion | Status | File:Line | Detail |
|-----------|--------|-----------|--------|
| **Existence** — Personal balance displayed | **FAIL** | No component exists | Not rendered on Runway tab. |
| **Existence** — Business balance displayed | **FAIL** | No component exists | Not rendered on Runway tab. |
| **Completeness** — Last-sync timestamp | **FAIL** | `accounts/route.ts:28–43` | Response includes `balance` but not `updatedAt` or sync timestamp. Research Risk 7: stale balance with no staleness indicator. |
| **Classification** — Personal vs business not commingled | **UNVERIFIABLE** | `schema.prisma:47` | `entityType String?` on `accounts` — null means unclassified. No enforcement that every account has a type. If null accounts are summed, commingling occurs silently. |
| **Rights** — User-scoped | CORRECT | `accounts/route.ts:21–23` | `plaid_items.findMany({ where: { userId: user.id } })` |

### G5 — Runway Tracker

| Assertion | Status | Detail |
|-----------|--------|--------|
| **Existence** — Burn rate computed | **FAIL** | No calculation exists anywhere |
| **Existence** — Runway (months) displayed | **FAIL** | No component exists |
| **Existence** — Burn-down chart | **FAIL** | No chart component exists |
| **Accuracy** — Net burn (not gross burn) | **UNVERIFIABLE** | No burn formula exists to test |
| **Accuracy** — Accounting basis consistency | **FAIL** | Income API (`/api/income`) uses `transactions` table; expense actuals use `ledger_entries`. These are different accounting paths — the math cannot be trusted to use the same basis. |

---

## 3 · CONTROLS & EVIDENCE

| Control | Status | File:Line |
|---------|--------|-----------|
| Auth gate — year-calendar | CORRECT | `year-calendar/route.ts:13–15` |
| Auth gate — business-budget | CORRECT | `business-budget/route.ts:11–14` |
| Auth gate — accounts | CORRECT | `accounts/route.ts:6–19` |
| Auth gate — income | CORRECT | `income/route.ts:6–14` |
| User-scoping — all budget routes | CORRECT | `userId: user.id` in every Prisma call |
| User-scoping — accounts route | CORRECT | `plaid_items WHERE userId = user.id` |
| Audit log — budget reads | N/A | Read-only; no mutation to log |
| Paid-API call exposed unauthenticated | NONE FOUND | All routes checked pass auth first |
| Personal/business segregation enforced | **MISSING** | `accounts.entityType` is nullable — no DB constraint forces classification. No validation in route. |

---

## 4 · ROOT CAUSE ANALYSIS

### G1: Two separate panels instead of one consolidated panel
**Why?** `BudgetComparison.tsx` was extracted verbatim from `/hub/page.tsx` and mounted below `HubBudgetSection`. Neither was built to merge. They self-fetch the same three routes independently (duplicate network calls). No one redesigned them as a single panel.  
**Why?** The PRs that built each component were scoped to "surface existing data" not "consolidate." The design goal (unified panel) was deferred.  
**Design flaw:** Two components, two state machines, two sets of API calls — all returning the same underlying data. `BudgetComparison.tsx:68–94` fetches `actualData` but never renders it, wasting a DB round-trip.

### G3: No Day or Week granularity
**Why?** The backend SQL uses `GROUP BY EXTRACT(MONTH FROM je.date)` — month-level aggregation only.  
**Why?** No one has built a day-level or week-level budget query. The budget model itself (the `budgets` table) only has monthly columns (jan–dec): `schema.prisma:490–501`. There is no day- or week-level budget data structure.  
**Design flaw:** Budget is planned at monthly granularity; a day/week filter on actuals would compare day/week actuals against... nothing (no day/week planned amounts exist). A "filter" for day/week can show actuals sliced to that period but cannot show a planned vs. actual variance unless planned data is also at that granularity.

### G4: No account balance tab
**Why?** The Runway tab was built around budget vs. actual (spending). Account balances (Plaid-synced) live in `/api/accounts` and are used in other views (net-worth page) but were never surfaced in the Runway tab.  
**Why?** The tab descriptor promises "how long your money buys you" but the actual balance — the numerator of the runway formula — is absent.  
**Design flaw:** `accounts.entityType` is `String?` (nullable, `schema.prisma:47`). No DB constraint or API validation enforces that accounts are classified as personal or business. A query grouping by `entityType` will silently bucket null-typed accounts as neither — or worse, if a summation includes them, commingling occurs.

### G5: No runway tracker
**Why?** No component, no route, no formula. The feature is aspirational — named in the tab descriptor ("how long your money buys you") but not built.  
**Why?** The runway formula requires three inputs: (1) current cash balance, (2) monthly income, (3) monthly expenses. These live in three different places — `accounts.currentBalance` (Plaid), `income/route.ts` (transactions table), `year-calendar + business-budget` (ledger_entries). They have never been joined.  
**Deeper flaw:** The income API (`/api/income/route.ts:33–34`) queries `chart_of_accounts WHERE module = 'income'` then joins `transactions` (the older Plaid-transaction table), while expense actuals use `ledger_entries` (the double-entry accounting table). These are on different accounting bases. Burn rate computed from these would systematically under- or over-state depending on whether transactions have been reconciled to journal entries.

---

## 5 · FAILURE MODES & BLAST RADIUS

| Rank | Failure Mode | Blast Radius |
|------|-------------|--------------|
| **1 — CRITICAL** | **G4: Null `entityType` causes commingling.** If any Plaid account has `entityType = null` (confirmed possible: schema nullable, no constraint), a balance tab that sums by entity type will either drop those accounts (understated balance) or aggregate them into the wrong category. IRS commingling risk per research. | IRS audit exposure, misclassified deductions, corporate veil risk. |
| **2 — HIGH** | **G5: Income/expense basis mismatch.** Net burn = income (transactions table, Plaid) minus expenses (ledger_entries, double-entry). A transaction may exist in `transactions` but not yet be posted to the ledger, or vice versa (reconciled vs. unreconciled). Runway figure would be wrong. | User makes spend/save decisions on wrong runway. False austerity or false confidence. |
| **3 — HIGH** | **G3: Day/week filter on actuals vs. missing planned data.** A day or week filter for actuals is buildable (ledger GROUP BY date), but there are NO day or week planned amounts in the data model (`budgets` is monthly, `budget_line_items` has `month INT` not `date`). A variance display at day/week granularity cannot show Planned — only Actual. This is not discoverable from the UI without explicit labeling. | User misreads "no budget for this day" as "under budget." |
| **4 — HIGH** | **G1: BudgetComparison fetches `actualData` but never renders it.** `BudgetComparison.tsx:68–94` fetches `actualData` from all three routes. `BudgetComparison.tsx:206–233` renders only `budgetData`. Actuals are silently discarded after download. Three extra DB queries per load, zero user value. | Performance cost (3 extra DB queries) + assertion: completeness FAIL (user cannot see actuals in the comparison view). |
| **5 — MEDIUM** | **G2: Style regression risk during consolidation.** `HubBudgetSection` uses `bg-brand-purple`, `font-mono`, `tabular-nums`, `border-border`, `moneyColorClass`. Any refactor that renames or replaces these tokens will silently break the design system tokens used in 220 other components. | Visual defect across the OS. |
| **6 — MEDIUM** | **UTC cutoff on month boundaries.** `EXTRACT(MONTH FROM je.date)` without timezone offset. For a user in UTC-5, a 7 PM transaction on Jan 31 posts at midnight UTC Feb 1 — lands in February, not January. Budget vs. actual variance is wrong for that transaction. | Off-by-one-month error on border transactions. Not legally material but erodes user trust. |
| **7 — MEDIUM** | **G4: No last-sync timestamp in `/api/accounts` response.** Balance data is point-in-time from last Plaid sync. If the last sync was 3 days ago, the balance tab shows a 3-day-stale figure with no indication. User makes runway decisions on stale data. | User spends based on stale balance. Not a regulatory issue, but undermines G5. |
| **8 — LOW** | **`BudgetComparison.tsx` and `HubBudgetSection.tsx` duplicate API calls.** Both components fetch `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` independently. Every Runway tab load = 6 requests to the same 3 routes. | Double DB load; response inconsistency if data changes between the two fetches (one component shows stale data relative to the other). |
| **9 — LOW** | **Trading toggle in HubBudgetSection shows "route pending."** `HubBudgetSection.tsx:146–149` explicitly labels Trading as pending with no data. Acceptable placeholder, but is a permanent "stub" unless a budget route for Trading is built. | Not a defect — honest pending state. Low priority. |

---

## 6 · TRACEABILITY & HONEST DELTA

### Single Source of Truth

| Output | Source | Single truth? |
|--------|--------|---------------|
| Budget (planned) | Personal: `budgets` table + routines bridge. Business: `budget_line_items` (source='business') + routines bridge. Travel: `budget_line_items` (source='trip'). | **Two models** (`budgets` vs `budget_line_items`) for planned data — no single table. |
| Actuals | `ledger_entries` (debits on posted journal entries, excluding reversals) | **SINGLE SOURCE** — consistent across all three hub budget routes. |
| Account balance | `accounts.currentBalance` (Plaid-synced Float) | Single source but staleness is opaque. |
| Income | `transactions` table (module='income' COA) | **Different table** from expense actuals (`ledger_entries`). No guarantee of same-basis. |

### Can each output trace to source?
- **Budget planned:** Yes — `budgets.userId_accountCode_year` (Prisma unique) + `budget_line_items.userId_year_month_coaCode`.
- **Actuals:** Yes — each `ledger_entry` has a `journal_entry_id` which has a `date`, `userId`, `entity_id`.
- **Account balance:** Partially — `currentBalance` is a Float scalar; no audit trail of when it was set.
- **Runway / burn rate:** NOT TRACEABLE — doesn't exist.

### Where the project stands vs. the research standard — plainly

| Goal | Standard | Current State | Gap |
|------|----------|---------------|-----|
| G1: Single consolidated panel (Planned \| Actual \| Variance $ \| Variance %) | Research §G1: "Planned Amount \| Actual Amount \| Variance ($) \| Variance (%)" | Two separate panels. `BudgetComparison` shows NO actuals. `HubBudgetSection` shows Variance $ only, no %. | Variance % missing. Consolidation not done. |
| G2: Preserve style | Internal: pixel-level style match | Style is correct in existing `HubBudgetSection` — no style change yet needed (nothing is broken). Risk at build time only. | Not a current defect — future risk. |
| G3: Day/Week/Month/Year filter | Research §G3: four states, no double-counting | Month + Year only. Day and Week: backend SQL and data model do not support planned amounts at these granularities. | Day and Week not buildable without data model change for planned data (or labeling actuals-only views). |
| G4: Balance tab (personal + business, segregated) | Research §G4: "never aggregate or net them together" | Does not exist. `accounts.entityType` nullable — commingling risk at build time. | Entire feature missing. |
| G5: Runway tracker (net burn, depletion date, burn-down) | Cash ÷ Monthly Net Burn; labeled as estimate | Does not exist. Income and expense actuals on different accounting paths. | Entire feature missing. Accounting basis resolution needed first. |

### The Uncomfortable Truth

The Runway tab is named "Runway" and its descriptor promises "how long your money buys you" — but none of the Runway-specific functionality (account balances, burn rate, depletion estimate, burn-down chart) exists. The tab currently shows a budget table and a year-comparison grid, both of which are repurposed from the `/hub` cockpit. The name is aspirational, not descriptive. A user opening the Runway tab expecting to see their cash runway gets a budget vs. actual table and a 12-month homebase/travel grid.

`BudgetComparison.tsx` fetches three sources of actual data on every load and discards them without displaying them — wasted DB work with zero user value today.

The income data path (`/api/income` → `transactions` table) and the expense data path (`/api/hub/year-calendar` → `ledger_entries`) are on different accounting rails. Any burn rate computed from these two sources will be inconsistent. This must be resolved before G5 is buildable — the declaration of accounting basis (cash vs. accrual) and a single ledger path for both income and expense actuals is the prerequisite.

---

## RANKED DIAGNOSIS (severity, not proposed fix)

| Rank | Severity | Finding |
|------|----------|---------|
| 1 | **CRITICAL** | `accounts.entityType` is nullable — no constraint prevents commingling in a balance tab (G4). Building G4 without enforcing classification first = IRS commingling risk (Research Risk 1). |
| 2 | **HIGH** | Income actuals (`transactions`) and expense actuals (`ledger_entries`) are on different accounting paths — net burn will be systematically wrong (G5). Research Risk 2 (basis mismatch) and Risk 3 (gross vs. net burn). |
| 3 | **HIGH** | `BudgetComparison.tsx` fetches actuals from all three routes and never renders them — 3 extra DB queries per load, no user value, completeness assertion FAIL (G1). |
| 4 | **HIGH** | G5 (runway tracker) does not exist — the tab's core promise ("how long your money buys you") is unbuilt. |
| 5 | **HIGH** | G4 (account balance tab) does not exist — the numerator for the runway formula is not surfaced. |
| 6 | **MEDIUM** | G3: Day and Week filters are not buildable at budget-vs-actual level with the current data model. Planned data exists only at monthly granularity (`budgets` table: jan–dec columns; `budget_line_items`: `month INT`). |
| 7 | **MEDIUM** | G1: Variance % not displayed (`HubBudgetSection.tsx:184`). Research standard requires both $ and %. |
| 8 | **MEDIUM** | G1: Two separate panels (`HubBudgetSection` + `BudgetComparison`) not consolidated. Duplicate API calls, no single unified view. |
| 9 | **MEDIUM** | UTC month-boundary cutoff issue in `year-calendar/route.ts:162` — no timezone offset applied to `EXTRACT(MONTH FROM je.date)`. |
| 10 | **LOW** | No last-sync timestamp in `/api/accounts` response — balance staleness is opaque (G4, Research Risk 7). |
| 11 | **LOW** | G2: No current style defect. Risk emerges only at merge time — not a defect yet. |
