# AUDIT — Project Runway (Goals Audit)
**Date:** 2026-06-20  
**Branch:** claude/blissful-turing-vqkvg3  
**Correlation ID:** 5f3c0c38-bc66-4d69-82bc-f82345f38fab  
**Project ID:** 9e785d54-ed77-4924-aad6-7de44bbdd4c8  
**Auditor:** Claude Code Routine (automated, read-only)

---

## 1 · WHAT EXISTS

### Runway Tab — Current Structure
The "Runway" tab (key `'calendar'`) is defined at `src/components/home/ModuleLauncher.tsx:80` and renders three components stacked vertically (lines 442–455):

1. **`HubCalendar`** — calendar grid (`ModuleLauncher.tsx:445`)
2. **`HubBudgetSection`** — month-scoped budget table (`ModuleLauncher.tsx:448`)
3. **`BudgetComparison`** — annual travel/personal comparison (`ModuleLauncher.tsx:452`)

Auth gate: `authed === true` guards the entire block (`ModuleLauncher.tsx:442`). Logged-out users see only the demo calendar.

---

### Component Map

| File | Purpose | Goal |
|------|---------|------|
| `src/components/home/ModuleLauncher.tsx:80,442–455` | Runway tab shell, mounts HubBudgetSection + BudgetComparison | 1,2 |
| `src/components/hub/HubBudgetSection.tsx` | Month-scoped budget table (Personal/Business/Travel/Trading toggle, Month+Year selector) | 1,2 |
| `src/components/hub/BudgetComparison.tsx` | Annual Home/Travel/Business comparison (wall-street style) | 1,2 |
| `src/components/hub/BudgetDrillDown.tsx` | Drill-down for actual amounts per COA×month | reuse |
| `src/app/api/hub/year-calendar/route.ts` | Personal budget + actuals (routines precedence + legacy `budgets` table; actuals from ledger) | 1 |
| `src/app/api/hub/business-budget/route.ts` | Business budget + actuals (from `budget_line_items` source=business + routines bridge; actuals from ledger) | 1 |
| `src/app/api/hub/nomad-budget/route.ts` | Travel budget + actuals (from `budget_line_items` source=trip; actuals from ledger by travel COA codes) | 1 |
| `prisma/schema.prisma:485–509` | `budgets` model — 12 monthly columns (`jan`–`dec`) | 1 |
| `prisma/schema.prisma:1050–1075` | `budget_line_items` model — `year Int`, `month Int` | 1 |

### Project Goals (from payload — treated as data)
1. Merge the budget with the budget comparison
2. Keep the style of the budget

---

## 2 · ASSERTION TEST

### Goal 1 — Merge the budget with the budget comparison

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — single unified budget+comparison panel | **FAIL** | HubBudgetSection and BudgetComparison are two separate self-fetching components stacked at `ModuleLauncher.tsx:448,452`; no shared state |
| Completeness — no duplicate data fetches | **FAIL** | Both components independently fetch `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` (`HubBudgetSection.tsx:70`, `BudgetComparison.tsx:65,75,87`); 3× duplicate round-trips on every Runway tab load |
| Accuracy — shared year state between panels | **FAIL** | `HubBudgetSection.tsx:53` `year` state and `BudgetComparison.tsx:46` `selectedYear` state are independent; user can see different years in each panel simultaneously with no warning |
| Accuracy — BudgetComparison renders actuals | **FAIL** | `BudgetComparison.tsx:66–101` fetches `actualData` from all three routes and stores it in state; `BudgetComparison.tsx:205–233` renders only `budgetData` in the month grid — actuals are fetched but never rendered |
| Accuracy — BudgetComparison summary cards include actuals | **FAIL** | `BudgetComparison.tsx:107–116`: `homeMonthsHomebaseBudget`, `travelMonthsTravelBudget`, `travelSavings`, `effectiveYearlyCost` all derived from `budgetData` only; `actualGrandTotal` is in `BudgetState` interface but never displayed |
| Accuracy — HubBudgetSection Variance (%) column | **FAIL** | `HubBudgetSection.tsx:159–165`: table headers are `Category \| COA \| Budget \| Actual \| Variance($)` — no `Variance (%)` header; no column rendered; no computation |
| Accuracy — variance formula correct where it exists | PASS | `HubBudgetSection.tsx:85`: `variance: actual - budget` matches GAAP standard (Actual − Budget); direction is correct for expense lines |
| Cutoff — month filter synchronized across panels | **FAIL** | `HubBudgetSection.tsx:53–55` maintains its own `month`/`year`/`activeTab` state; BudgetComparison has no month selector (it is year-wide by design); states are never shared |
| Rights — auth gates on all three budget routes | PASS | `year-calendar/route.ts:14`, `business-budget/route.ts:14`, `nomad-budget/route.ts:39` all call `getVerifiedEmail()` → 401 before any DB work |

### Goal 2 — Keep the style of the budget

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — HubBudgetSection style tokens defined | PASS | `HubBudgetSection.tsx:101–208`: `font-mono tabular-nums`, `text-xs`, `brand-purple` accents, `border-border` table, `bg-white px-4 py-4 lg:px-8` container |
| Accuracy — BudgetComparison uses consistent but distinct style | NOTE | `BudgetComparison.tsx:119–269`: dense wall-street mono, `bg-brand-purple` header row, `bg-panel-highlight` travel columns — different from HubBudgetSection but consistent with its own design system |
| Completeness — zero-row filter preserved | PASS | `HubBudgetSection.tsx:89`: `rows.filter(r => r.budget !== 0 \|\| r.actual !== 0)` hides zero-zero rows; this filter must be preserved in any merged panel |
| Completeness — 4-tab toggle (Personal/Business/Travel/Trading) | PASS | `HubBudgetSection.tsx:57–68`: 4 tabs defined; Trading mapped to `null` route with honest "route pending" display at `HubBudgetSection.tsx:100` |
| Accuracy — drill-down preserved | PASS | `HubBudgetSection.tsx:96–99`: `openActualDrill` invokes BudgetDrillDown; guarded at `actual > 0`; works correctly today |

---

## 3 · CONTROLS & EVIDENCE

| Control | Present | File:Line |
|---------|---------|-----------|
| Auth gate (`getVerifiedEmail()` → 401) | YES | `year-calendar/route.ts:14`, `business-budget/route.ts:14`, `nomad-budget/route.ts:39` |
| User-scoping on all queries | YES | All routes scope by `userId = user.id` |
| Runway tab authed-only gate | YES | `ModuleLauncher.tsx:442`: `authed === true` guards budget components |
| HB-5 double-count prevention (routine bridge + budgets table) | YES | `year-calendar/route.ts:87`: `routineCovered` Set prevents same (coa, month) from counting twice |
| No paid external API calls in budget routes | YES | All three budget routes are DB-only (Prisma + raw SQL on ledger) |
| Audit log for read-only routes | N/A | GET routes require no mutation audit trail |

**Latent control gap — income line color convention:**  
`HubBudgetSection.tsx:184`: `moneyColorClass(r.budget - r.actual, 'pnl')` is correct for expense lines (spending over budget is bad → red) but would be wrong for income lines (receiving less than budget is bad → should also be red, but the sign flips). No income COA accounts are currently rendered (all budget routes filter to expense ledger entries), so this is latent — not a live failure.

**Latent data quality gap — nomad-budget actuals entity filter:**  
`nomad-budget/route.ts:134–141`: The actuals raw SQL does NOT filter by `entity_type`. It filters only by `coa.code IN (tripCodes)` and `userId`. If a travel COA code is shared across entity types (personal vs. business), the nomad-budget actuals would be overstated. This is a data quality risk, not a current confirmed failure.

---

## 4 · ROOT CAUSE (NOT SYMPTOM)

### Root Cause A — Goal 1: Two self-fetching components, no shared state
**Symptom:** HubBudgetSection and BudgetComparison are not consolidated; year states are independent; 3× duplicate fetches on load.  
**Why:** BudgetComparison was extracted as a self-fetching component for isolated PR delivery (comment at `BudgetComparison.tsx:7–8`). The self-fetching pattern was chosen for independent deployability. Consolidation was explicitly deferred.  
**Why that:** No shared `RunwayDataProvider` or lifted parent state exists in the Runway tab section (`ModuleLauncher.tsx:442–455`). The `ModuleLauncher` manages auth state but not budget data state.  
**What can fix it without schema change:** Lift year + fetched data state to a context/provider wrapping both components at `ModuleLauncher.tsx:442–455`. Both components receive the same data reference → duplicate fetches eliminated, year state synchronized.

### Root Cause B — Goal 1: BudgetComparison fetches actuals but never renders them
**Symptom:** The month grid at `BudgetComparison.tsx:205–233` renders only `budgetData`; `actualData` is silently fetched and discarded.  
**Why:** The component was built to show a budget-only annual snapshot. The actuals fetch was added anticipating future use but the rendering wasn't completed.  
**Why that:** The `BudgetState` interface at `BudgetComparison.tsx:24–30` includes `actualGrandTotal` and `actualData`, and the fetch calls at lines 66–101 populate them — the infrastructure is half-built. The month grid template at lines 205–233 was never extended with Actual/Variance columns.  
**What can fix it without schema change:** Add Actual and Variance($) columns to the month grid at `BudgetComparison.tsx:205–233`. The data is already in state. A zero-budget guard must be added before computing Variance (%) (`budget === 0 ? null : ((actual/budget) - 1) * 100`).

### Root Cause C — Goal 1: HubBudgetSection missing Variance (%) column
**Symptom:** No Variance (%) column in the month-scoped table.  
**Why:** The column was never added. The header array at `HubBudgetSection.tsx:159–165` has 5 entries (`Category`, `COA`, `Budget`, `Actual`, `Variance($)`) with no 6th.  
**Why that:** No existing computation for `variancePct`; the `allRows` map at line 82–86 only computes `variance: actual - budget`.  
**What can fix it without schema change:** Add `variancePct: budget !== 0 ? ((actual / budget) - 1) * 100 : null` in the `allRows` map. Add a 6th `<th>` and 6th `<td>` per row. Render `null` as `—` (em-dash). This is additive — no existing column is touched.

---

## 5 · FAILURE MODES & BLAST RADIUS

| Rank | Failure Mode | Trigger | Blast Radius | Silent? |
|------|-------------|---------|-------------|---------|
| 1 | BudgetComparison month grid never shows actuals | User views Runway tab today | User cannot compare budget vs actual in the annual view at all; the feature promised by Goal 1 does not exist | **YES — no error, missing data** |
| 2 | Year state desync between HubBudgetSection and BudgetComparison | User changes year in one panel | Budget table shows FY 2026, comparison shows FY 2025; arithmetic comparison across panels produces false conclusions | **YES — no error, wrong display** |
| 3 | 3× duplicate fetches on Runway tab load | Any authed page load of Runway tab | Six extra DB round-trips (3 routes × 2 components); correct data but increased latency and DB load | NO — visible as slower load |
| 4 | Variance (%) missing from month-scoped table | User looks for % deviation | User must compute mentally; can't see outliers at a glance; defeats the purpose of a comparison table | **YES — missing feature** |
| 5 | Division by zero when adding Variance (%) for zero-budget rows | Variance (%) column added without guard | JavaScript `NaN` or `Infinity` rendered in the table; React may render `NaN` as blank or crash serialization | **YES — silent wrong value** |
| 6 | Income lines get wrong color convention if income COA is added | Any income-type COA added to budget | Under-income shows as green (good) when it should show red; over-income shows red when it should show green | **YES — silent sign flip** |
| 7 | Nomad-budget actuals over-counted if travel COA used across entity types | Travel COA code shared with business entity | Actuals overstated in the travel budget view; user believes they overspent on travel when the expense is business | **YES — silent, no entity filter** |

---

## 6 · TRACEABILITY & THE HONEST DELTA

### Single source of truth: YES (for budget actuals)
- All actuals route to `ledger_entries` joined to `journal_entries` (verified: `year-calendar/route.ts:154`, `business-budget/route.ts:138`, `nomad-budget/route.ts:125`)
- Budget plan personal: `budgets` table + `operations_routines` via HB-5 precedence (`year-calendar/route.ts:79–145`)
- Budget plan business: `budget_line_items` (source=business) + routines (`business-budget/route.ts:69–130`)
- Budget plan travel: `budget_line_items` (source=trip) (`nomad-budget/route.ts:89–117`)

### Can each output trace to source?
- Actuals → ledger → TRACEABLE (BudgetDrillDown drills to transactions at `HubBudgetSection.tsx:96–99`)
- Budget plan (routines) → recurrence engine → TRACEABLE to routine definition
- Budget plan (budgets table) → monthly columns → TRACEABLE
- `actualData` in BudgetComparison → fetched but not rendered → NOT TRACEABLE ON SCREEN

### Where this project stands vs the research standard (GAAP/FASB, research payload)

| Standard | Requirement | Current State | Gap |
|----------|-------------|--------------|-----|
| GAAP completeness | All actuals must be presented alongside budget | HubBudgetSection: YES. BudgetComparison: NO — actuals never rendered | BudgetComparison fails completeness assertion |
| Variance standard | Actual − Budget; % = ((Actual/Budget)−1)×100 | HubBudgetSection: `actual - budget` ✓ (no %). BudgetComparison: no variance column | Both components fail the % assertion |
| Zero-budget guard | Variance (%) undefined when budget = 0 | Neither component renders Variance (%); guard not yet needed but must be added before the column exists | Pre-condition gap |
| Budget versioning | Revisions traceable to original | `budgets` table has no version column (`schema.prisma:485–509`); edits overwrite | Pre-existing limitation; not in scope of Goal 1 or 2 |
| Style preservation | Goal 2 | HubBudgetSection style is well-defined and preserved; BudgetComparison has its own consistent style; a merged view must explicitly reconcile them | Reconciliation gap; not a current failure |

### The honest delta on the two goals
**Goal 1 (merge budget with budget comparison):** Not achieved. The two components are stacked but not merged. The data pipeline for actuals in BudgetComparison is half-built (fetch: YES, render: NO). Variance (%) is absent from both components. Three duplicate fetches occur on every load. Year state is independent between components.

**Goal 2 (keep the style of the budget):** Not yet testable — there is nothing to evaluate until consolidation happens. The HubBudgetSection style is well-defined and implementable as the canonical style for the merged panel. The BudgetComparison wall-street style would need to be adapted or preserved as a distinct section within the merged view.

---

*Diagnosis only — no solutions designed or implemented.*  
*correlation_id: 5f3c0c38-bc66-4d69-82bc-f82345f38fab*  
*project_id: 9e785d54-ed77-4924-aad6-7de44bbdd4c8*
