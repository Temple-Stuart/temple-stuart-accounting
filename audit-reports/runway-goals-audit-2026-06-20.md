# AUDIT — Project Runway (Goals Audit)
**Date:** 2026-06-20  
**Branch:** claude/blissful-turing-qngvnx  
**Correlation ID:** a9ca8170-e3c3-419f-afd8-0ede68c5bcf2  
**Project ID:** 7d0e3963-de30-4909-9377-b5655e281a1d  
**Auditor:** Claude Code Routine (automated, read-only)

---

## 1 · WHAT EXISTS

### Runway Tab — Current Structure
The "Runway" tab (key `'calendar'`) is defined at `src/components/home/ModuleLauncher.tsx:80` and renders three components stacked vertically (lines 442–455):

1. **`HubCalendar`** — calendar grid (`ModuleLauncher.tsx:445`)
2. **`HubBudgetSection`** — budget table (`ModuleLauncher.tsx:448`) **[CORRECT, PARTIAL]**
3. **`BudgetComparison`** — annual travel/personal comparison (`ModuleLauncher.tsx:452`) **[CORRECT, SEPARATE — not yet consolidated]**

Auth gate: `authed === true` guards the entire block (`ModuleLauncher.tsx:442`). Logged-out users see only the demo calendar.

---

### Component Map

| File | Purpose | Goal | Label |
|------|---------|------|-------|
| `src/components/home/ModuleLauncher.tsx:80,442–455` | Runway tab shell, mounts HubBudgetSection + BudgetComparison | 1,2 | CORRECT |
| `src/components/hub/HubBudgetSection.tsx` | Month-scoped budget table (Personal/Business/Travel/Trading toggle, Month+Year selector) | 1,2,3 | PARTIAL |
| `src/components/hub/BudgetComparison.tsx` | Annual Home/Travel/Business comparison (wall-street style) | 1,2 | CORRECT — but SEPARATE, not consolidated |
| `src/components/hub/BudgetDrillDown.tsx` | Drill-down for actual amounts per COA×month | reuse | CORRECT, REUSABLE |
| `src/app/api/hub/year-calendar/route.ts` | Personal budget + actuals (routines precedence + legacy `budgets` table; actuals from ledger) | 1,3 | CORRECT |
| `src/app/api/hub/business-budget/route.ts` | Business budget + actuals (from `budget_line_items` source=business + routines bridge; actuals from ledger) | 1,3 | CORRECT |
| `src/app/api/hub/nomad-budget/route.ts` | Travel budget + actuals (from `budget_line_items` source=trip; actuals from ledger by travel COA codes) | 1,3 | CORRECT |
| `src/app/api/accounts/route.ts` | Per-account balance + entityType via Plaid items | 4 | CORRECT — exists but NOT mounted on Runway tab |
| `src/app/api/metrics/route.ts` | Total balance (all accounts), monthly expense data, YTD | 5 | PARTIAL — building blocks present, runway formula absent |
| `prisma/schema.prisma:31–60` | `accounts` model — `currentBalance Float?`, `entityType String?`, `updatedAt DateTime` | 4 | PARTIAL — entityType nullable |
| `prisma/schema.prisma:485–509` | `budgets` model — 12 monthly columns (`jan`–`dec`) | 3 | BROKEN for goal (month-only granularity by design) |
| `prisma/schema.prisma:1050–1075` | `budget_line_items` model — `year Int`, `month Int`, no day/week | 3 | BROKEN for goal (month-only granularity) |

### What Is Reusable
- **`/api/accounts` route** — returns `currentBalance`, `entityType` per account; reusable as-is for Goal 4
- **`/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget`** — shared data for both HubBudgetSection and BudgetComparison; currently fetched twice (one per component)
- **`BudgetDrillDown`** — self-fetching drill-down; fully reusable in any consolidated panel
- **`ledger_entries` + `journal_entries`** — `je.date` is day-level precision; actuals by day or week ARE computable from this data for Goals 3 and 5
- **`/api/metrics` route** — `currentMonth`, `priorMonth`, `balance` available; partially useful for burn-rate seed logic but has the commingling flaw (see §3)

---

## 2 · ASSERTION TEST

### Goal 1 — Consolidation

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — a single unified budget panel exists | **FAIL** | HubBudgetSection and BudgetComparison are two separate components with separate state; `ModuleLauncher.tsx:448,452` stacks them without integration |
| Completeness — no duplicate data fetch | **FAIL** | Both components independently fetch `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` (`HubBudgetSection.tsx:70`, `BudgetComparison.tsx:65,75,87`) |
| Accuracy — shared year state | **FAIL** | `HubBudgetSection.tsx:53` `year` state and `BudgetComparison.tsx:46` `selectedYear` state are independent; can show different years simultaneously with no warning |

### Goal 2 — Preserve Style

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — HubBudgetSection's style is defined and reusable | PASS | `HubBudgetSection.tsx:101–208`: `font-mono tabular-nums`, `text-xs`, `brand-purple` accents, `border-border` table, `bg-white px-4 py-4 lg:px-8` container |
| Accuracy — BudgetComparison uses a different style | NOTE | `BudgetComparison.tsx:119–269`: dense wall-street mono, `bg-brand-purple` header row, `bg-panel-highlight` travel columns — different from HubBudgetSection; consolidation requires reconciling these |

### Goal 3 — Day/Week/Month/Year filter

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — budget plan data at day granularity | **FAIL** | `prisma/schema.prisma:490–501`: `budgets` table has `jan`–`dec` columns only; no day field |
| Existence — budget plan data at week granularity | **FAIL** | `prisma/schema.prisma:1056–1058`: `budget_line_items` has `year Int`, `month Int`; no week or day column |
| Existence — actuals data at day granularity | PASS | Ledger: `year-calendar/route.ts:157` queries `EXTRACT(MONTH FROM je.date)`; date is available; day/week aggregation is a query change, not a schema change |
| Accuracy — day/week budget column reflects real plan | **FAIL** | Budget plan can only be amortized (monthly ÷ days-in-period), not a true daily plan; this is not labeled on-screen |
| Cutoff — current filter only supports month | **FAIL** | `HubBudgetSection.tsx:112–118`: only a `<select>` for month index (0–11); no Day/Week/Year option exists |

### Goal 4 — Account Balance Tab (Personal + Business)

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — tab above budget panel | **FAIL** | No account balance tab in Runway tab; not in `ModuleLauncher.tsx:442–455` |
| Existence — entityType on each account | PARTIAL | `prisma/schema.prisma:48`: `entityType String?` (nullable); `accounts/route.ts:38`: returns `entityType: account.entityType \|\| null` |
| Completeness — all accounts tagged by entity | UNVERIFIED | Cannot read Azure Postgres; entityType is nullable so untagged accounts are architecturally possible |
| Accuracy — balance scoped to entity | PARTIAL | `/api/accounts` returns per-account data with entityType; client-side grouping feasible but null entityType accounts break the split |
| Cutoff — last-sync timestamp surfaced | **FAIL** | `accounts.updatedAt` exists at `schema.prisma:40` but `accounts/route.ts:28–39` does NOT include it in the response |
| Rights — user-scoped | PASS | `accounts/route.ts:21`: `prisma.plaid_items.findMany({ where: { userId: user.id } })` |
| Classification — Personal vs Business segregated, never aggregated | **FAIL (risk)** | `/api/metrics/route.ts:21–27`: `SUM("currentBalance") FROM accounts WHERE "userId"` — aggregates ALL entity types into one number |

### Goal 5 — Runway Tracker

| Assertion | Status | Evidence |
|-----------|--------|---------|
| Existence — runway tracker component | **FAIL** | No component or route; no "runway" in any tsx/ts file (search confirmed) |
| Existence — liquid balance numerator | **FAIL** | `metrics/route.ts:21–27` sums ALL accounts; no `is_liquid` or `is_earmarked` flag in `schema.prisma:31–60` |
| Accuracy — 3-month trailing burn rate | **FAIL** | `metrics/route.ts:90–124` computes `currentMonth` and `priorMonth` expenses only; no 3-month window |
| Accuracy — net burn (income − expense) per month | PARTIAL | `revYtd` and `expYtd` exist in metrics response but are YTD totals, not per-month; monthly income is not computed |
| Accuracy — restricted funds excluded | **FAIL** | No restricted/earmarked flag on accounts in schema |
| Valuation — labeled as estimate on-screen | **FAIL** | Feature does not exist |
| Cutoff — burn rate window declared | **FAIL** | Feature does not exist |
| Classification — gross vs net burn labeled | **FAIL** | Feature does not exist |

---

## 3 · CONTROLS & EVIDENCE

| Control | Present | File:Line |
|---------|---------|-----------|
| Auth gate (`getVerifiedEmail()` → 401) | YES | `year-calendar/route.ts:14`, `business-budget/route.ts:14`, `nomad-budget/route.ts:39`, `accounts/route.ts:9`, `metrics/route.ts:6` |
| User-scoping on all queries | YES | All routes scope by `userId = user.id` |
| Runway tab authed-only gate | YES | `ModuleLauncher.tsx:442`: `authed === true` guards budget components |
| Audit log (read-only routes) | N/A | All routes are GET; no mutation audit required |
| No paid external API calls | YES | All routes are DB-only (Prisma) |

**Gap — `metrics/route.ts:21–27`:** The `balance` metric aggregates ALL accounts (`SUM("currentBalance") FROM accounts WHERE "userId"`) with no entity-type filter. Reusing this for the runway numerator or account balance total would commingle personal + business + trading into one number. This is the Rank 1 risk from the research standard.

---

## 4 · ROOT CAUSE (NOT SYMPTOM)

### Root Cause A — Goals 1 & 2: Duplicate components, duplicate fetches, desynchronized year state
**Symptom:** HubBudgetSection and BudgetComparison are not consolidated; year states are independent.  
**Why:** BudgetComparison was extracted verbatim from `/hub` as a self-fetching component (`BudgetComparison.tsx:7–8`): "extracted VERBATIM … so it can be surfaced on the homepage Runway tab." The self-fetching pattern was chosen for isolated PR delivery. Consolidation was deferred.  
**Why that:** No shared `RunwayDataProvider` or lifted parent state exists in the Runway tab section (`ModuleLauncher.tsx:442–455`). The `ModuleLauncher` manages auth state but not budget data state.  
**Fixable flaw:** Lifting year + fetched data state to a provider wrapping both components would eliminate duplicate fetches and synchronize the year selector. The natural lift point is `ModuleLauncher.tsx:442–455`.

### Root Cause B — Goal 3: Budget plan data model is month-only
**Symptom:** No Day or Week granularity.  
**Why:** `budgets` table (`schema.prisma:490–501`) has 12 monthly columns. `budget_line_items` (`schema.prisma:1056–1058`) has `year` + `month` integer columns. Neither has a day or week column.  
**Why that:** The budget entry workflow was designed for monthly planning (enter a figure per COA per month per year). Daily/weekly budget plans weren't in scope for the original build.  
**Fixable flaw:** Day/week ACTUALS are computable from `journal_entries.date` (day-level precision). The BUDGET plan for day/week must be amortized (monthly ÷ days-in-period). This is arithmetically valid but must be labeled as "monthly budget amortized, not a daily plan" — otherwise the budget column in the Day view is misleading. A label is the fix; a data model change is not required for this use case.

### Root Cause C — Goal 4: Account balance tab doesn't exist; entityType is nullable
**Symptom:** No account balance view; untagged accounts can't be segregated.  
**Why:** The tab was never built. `accounts.entityType String?` (`schema.prisma:48`) is nullable — Plaid-synced accounts that haven't been manually tagged have no entity classification.  
**Why that:** Entity tagging of accounts is a post-import manual step (or automated via Plaid subtype). Two parallel classification paths exist (`entityType String?` and `entity_id String?` FK to entities) with no enforcement that they agree. The `/api/accounts` route returns `entityType || null` without filtering or warning on null accounts.  
**Fixable flaw:** The tab can be built against `/api/accounts` but must explicitly render a "Unclassified" bucket for null-entityType accounts rather than silently omitting them. Silent omission would understate the balance total — a material error. The `updatedAt` field must also be added to the route response.

### Root Cause D — Goal 5: Runway tracker requires data that doesn't exist
**Symptom:** No runway tracker; no liquid balance filter; no 3-month trailing burn.  
**Why:** The feature was never built. The 3-month burn rate requires querying 3 calendar months of net expenses from the ledger (possible, but not implemented). The liquid balance numerator requires excluding non-liquid accounts; no `is_liquid` or `is_earmarked` flag exists in the `accounts` schema.  
**Why that:** The only proxy for excluding investment accounts is `entityType = 'trading'`, but investment accounts held under a personal entity (e.g., Roth IRA) would be misclassified as liquid. The data model has no mechanism to distinguish cash accounts from investment accounts at the field level.  
**Fixable flaw:** Burn rate query against the ledger is additive (no schema change required). Liquid balance requires either (a) adding an `is_liquid Boolean @default(true)` field to `accounts` or (b) using entityType-based exclusion as an approximation and labeling it as such. Option (b) is faster but imprecise.

---

## 5 · FAILURE MODES & BLAST RADIUS

| Rank | Failure Mode | Trigger | Blast Radius | Silent? |
|------|-------------|---------|-------------|---------|
| 1 | Personal + Business + Trading balances aggregated without segregation | Runway Tracker or Account Balance tab reuses `/api/metrics` `balance` | IRS commingling signal; user makes decisions on blended number; corporate veil risk | **YES — no error, wrong number** |
| 2 | entityType = null accounts silently omitted from Personal/Business split | Account balance tab renders split on entityType | Balance total understated; user believes they have less money than they do | **YES — silent omission** |
| 3 | Trading/investment account balance included in runway numerator | Runway tracker uses all-account balance without liquid filter | Runway overstated; user believes they have more time than they do; spending decisions on false data | **YES — no error, wrong number** |
| 4 | Single-month burn rate in month with annual expense | Runway tracker uses `currentMonth` only | Annual insurance, tax payment, or subscription spikes: runway understated by 10–20× that month | **YES — no error, wildly wrong** |
| 5 | Day/week budget shown as amortized figure without disclaimer | Time-granularity filter built without label | User believes they set a $100/day budget when they set $3,000/month; variance columns uninterpretable | **YES — silent misrepresentation** |
| 6 | Year state desync between HubBudgetSection and BudgetComparison | User changes year in one panel | Comparison shows FY 2025 against budget table showing FY 2026; arithmetic comparison is impossible | **YES — no error, wrong display** |
| 7 | Stale Plaid balance without timestamp | Account balance tab built without `updatedAt` | User sees week-old balance and makes financial decision on it | **YES — SOC 2 PI Timely violation** |
| 8 | 3× duplicate fetches on Runway tab load | Any page load when authed | Three extra DB round-trips; functionally correct but wasteful; increases latency | NO — visible as slower load |

---

## 6 · TRACEABILITY & THE HONEST DELTA

### Single source of truth: YES (for budget actuals)
- All actuals route to `ledger_entries` joined to `journal_entries` (verified: `year-calendar/route.ts:154`, `business-budget/route.ts:138`, `nomad-budget/route.ts:125`)
- Budget plan personal: `budgets` table + `operations_routines` via HB-5 precedence (`year-calendar/route.ts:79–145`) — documented, not a silent merge
- Budget plan business: `budget_line_items` (source=business) + routines (`business-budget/route.ts:69–130`)
- Budget plan travel: `budget_line_items` (source=trip) (`nomad-budget/route.ts:89–117`)

### Competing copies: YES — acknowledged design debt
- `budgets` table (12 monthly columns) AND `operations_routines` (recurrence-computed) are both personal budget sources. HB-5 precedence resolves on read but is transitional.
- HubBudgetSection and BudgetComparison duplicate 3 fetch calls and maintain independent year state.

### Can each output trace to source
- Actuals → ledger → TRACEABLE (BudgetDrillDown drills to transactions)
- Budget plan (routines) → recurrence engine → TRACEABLE to routine definition
- Budget plan (budgets table) → monthly columns → TRACEABLE
- Account balance → Plaid API → NOT FULLY TRACEABLE (`updatedAt` not returned by `/api/accounts`)
- Runway number → NOT IMPLEMENTED

### Where this project stands vs the research standard

| Goal | Research Standard | Current State | Honest Gap |
|------|------------------|--------------|-----------|
| G1 — Consolidate | Single panel, zero duplicate fetches, shared state | Two separate components, 3× duplicate fetches, independent year state | Architecture gap; data is correct |
| G2 — Preserve style | Pixel-identical post-consolidation | HubBudgetSection style is well-defined; BudgetComparison uses different style | Restyle gap; no functional impact |
| G3 — Day/Week/Month/Year | 4 granularities, re-aggregated without reload; annual prepayments amortized | Month/Year only; Day/Week requires budget amortization; unlabeled = misleading | Data model constraint + labeling requirement |
| G4 — Account Balance Tab | Real-time or last-synced + visible timestamp; Personal/Business segregated; never aggregated | Feature does not exist; entityType nullable; updatedAt not surfaced | Net-new build; data quality unknown |
| G5 — Runway Tracker | Liquid Balance ÷ 3-month trailing net burn; labeled estimate; burn window disclosed; restricted funds excluded | Feature does not exist; no liquid flag; no trailing burn rate; no formula | Net-new build; schema gap |

### The uncomfortable truth
The budget data layer (actuals from ledger, plan from routines + budgets table, HB-5 precedence) is correctly engineered and trustworthy. The problems are: (1) UI architecture for consolidation, which is a known PR debt; (2) three goals (3, 4, 5) that are net-new features requiring careful handling of edge cases that have material financial consequences. Specifically:

- **Goal 3 without a disclaimer on day/week budget figures** produces misleading variance columns. The fix is one labeled line: "Budget shown as monthly estimate amortized by day."
- **Goal 4 without auditing entityType completeness first** will silently understate the user's balance if any accounts are untagged.
- **Goal 5 without a liquid-only filter** overstates the runway by including investment and trading account balances. Building this feature correctly requires either an `is_liquid` schema addition or an explicit approximation disclaimer.

---

*Diagnosis only — no solutions designed. Correlation: a9ca8170-e3c3-419f-afd8-0ede68c5bcf2*
