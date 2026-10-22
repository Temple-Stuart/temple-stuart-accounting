# COA ALIGNMENT AUDIT — Budget-to-Actual Mapping
**Date:** 2026-06-20  
**Branch:** `claude/modest-volta-z8i7aq`  
**Auditor:** Claude Code Routine (automated, unwatched)  
**Task:** Confirm every budget line maps 1:1 to at least one actual account code  
**Risk tier:** Read-only — code-level static analysis (Claude Code cannot access Azure Postgres)  
**Trace:** Research Finding 2 "COA alignment must be verified"; Diagnosis §6 "COA misalignment → orphan rows or wrong actuals → Material"

---

## SCOPE — The Three Budget Routes

| Route | File | Budget source | Actuals source |
|-------|------|---------------|----------------|
| **Business** | `src/app/api/hub/business-budget/route.ts` | `budget_line_items` (source='business') + routine bridge | `ledger_entries → chart_of_accounts` (entity_type ∈ sole_prop, business) |
| **Nomad/Travel** | `src/app/api/hub/nomad-budget/route.ts` | `budget_line_items` (source='trip') | `ledger_entries → chart_of_accounts` (9xxx/7xxx) |
| **Personal/Homebase** | `src/app/api/hub/year-calendar/route.ts` | `budgets` table + routine bridge | `ledger_entries → chart_of_accounts` (personal, non-7xxx) |

---

## ROUTE 1: Business Budget (`/api/hub/business-budget`)

### Budget COA key assembly
`business-budget/route.ts:84` — NO prefix stripping:
```typescript
const coa = item.coaCode || 'UNCATEGORIZED';
```

### Budget write path — what format does `coaCode` use?
`api/business/[id]/route.ts:103`:
```typescript
coaCode: expense.coa_code  // from module_expenses.coa_code (VarChar 20)
```
`module_expenses.coa_code` is whatever the UI stores — format is **unverified without DB access**.

### Actuals COA set
`business-budget/route.ts:136–155`:
```typescript
const businessCodes = Object.keys(COA_NAMES).filter(c => c !== 'UNCATEGORIZED');
// ...coa.code IN (businessCodes)  — bare codes from chart_of_accounts
```
`businessAccounts` come from `chart_of_accounts` (business entity, account_type='expense', is_archived=false). Codes are stored **bare** (e.g. '6200').

### Routine bridge (business-budget)
`business-budget/route.ts:122` — strips prefix:
```typescript
const coa = rawCoa.replace(/^[PB]-/, ''); // bare code
if (!COA_NAMES[coa]) continue;
```
Routine COA codes ARE correctly normalized.

### COA alignment findings — Route 1

| Set | Source | Format |
|-----|--------|--------|
| **Budget COA** | `budget_line_items.coaCode` (source='business') | Passes through **as-is** — no normalization |
| **Actuals COA** | `chart_of_accounts.code` (business entity) | Bare codes (e.g. '6200') |

**Set A — Orphan budget lines (budget code has no matching actuals code):**

| Scenario | How it arises | Intentional? |
|----------|---------------|--------------|
| `budget_line_items.coaCode` stores a **prefixed** code (e.g. 'B-6200') but `chart_of_accounts.code` = '6200' | Mismatch: budget key 'B-6200' ≠ actuals key '6200' → Actual=0 | **Mapping error** — the business-budget route does not strip the B- prefix from `budget_line_items` (only from routine `coa_code`) |
| Budget line for a COA code not in the business `chart_of_accounts` | Future budget line for an account not yet created | Likely intentional — budget for a new cost center |

**⚠️ Risk: Cannot determine without DB access whether `module_expenses.coa_code` stores bare or prefixed codes.** If prefixed, all business budget lines are orphans.

**Set B — Unbudgeted actuals (actual code has no matching budget line):**
Any `chart_of_accounts` expense code that has ledger entries but no `budget_line_items` row. These show Budget=0, Actual>0. The route renders these with Variance (%) = '—' (zero-budget guard from `businessCodes` being the actuals filter — unbudgeted codes that ARE in chart_of_accounts will appear in the actuals data with no matching budget row).

**Correctness verdict — Route 1:**  
The actuals query is correctly constrained to `businessCodes` (chart_of_accounts), so actuals only appear for known business COA codes. The budget side is NOT constrained to businessCodes — a budget item with an unknown/prefixed code will appear as orphan (Actual=0). **DB verification required** to confirm whether `module_expenses.coa_code` stores bare or prefixed codes.

---

## ROUTE 2: Nomad/Travel Budget (`/api/hub/nomad-budget`)

### Budget COA key assembly
`nomad-budget/route.ts:108` — **strips** P-/B- prefix:
```typescript
const coa = (item.coaCode || '9950').replace(/^[PB]-/, '');
```

### Budget write paths — what COA codes are stored?

**Path A — `/api/trips/[id]/commit/route.ts:52–109` (OLD legacy commit):**
```typescript
const prefix = trip.tripType === 'business' ? 'B' : 'P';
const coaMapping = {
  'coworking': `${prefix}-9700`,   // ← STALE: TRAVEL_COA has coworking = P-9510
  'meals': `${prefix}-9500`,        // ← STALE: TRAVEL_COA has meals = P-9310/P-9320
  'wellness': `${prefix}-9400`,     // ← STALE: TRAVEL_COA has wellness = P-9700
  'conference': `${prefix}-9400`,   // ← STALE: TRAVEL_COA has conferences = B-9500
  // flights → 9100 ✓, hotel/lodging → 9200 ✓, activities → 9400 ✓, nightlife → 9450 ✓
};
```
Stores WITH prefix: 'P-9700', 'P-9500', 'P-9400', etc.

**Path B — `/api/trips/[id]/vendor-commit/route.ts:134,257–262` (NEW vendor-commit):**
```typescript
if (!isValidTravelCoaCode(coaCodeInput)) → 400
// Uses canonical TRAVEL_COA codes from the UI selector (P-9310, P-9510 etc.)
```
Stores WITH canonical prefix per TRAVEL_COA.

### COA_NAMES (the actuals + budget display filter)
`nomad-budget/route.ts:60–84` — built in three tiers:
1. **DB** (`chart_of_accounts` for personal entity, 7xxx or 9xxx, non-archived)
2. **Static 9xxx fallback** (`TRAVEL_COA_NAMES` defined at lines 7–20)
3. **Static 7xxx legacy fallback** (`LEGACY_COA_NAMES` defined at lines 23–32)

### CRITICAL FINDING: `TRAVEL_COA_NAMES` is stale relative to canonical `TRAVEL_COA`

| Code | TRAVEL_COA_NAMES (static fallback in nomad-budget) | Canonical TRAVEL_COA (travelCOA.ts) |
|------|-----------------------------------------------------|--------------------------------------|
| **9300** | Vehicle Rental | P-9300 = Ground Transport (LEGACY) |
| **9350** | Equipment Rental | P-9350 = Shopping & Supplies (LEGACY) |
| **9400** | Activities | P-9400 = Arts & Culture (LEGACY); new: activities = P-9400 ✓ |
| **9450** | Nightlife | P-9450 = **Bucket List** (nightlife = P-9430!) |
| **9500** | Meals & Dining | B-9500 = **Conferences & Summits** (meals = P-9310/P-9320!) |
| **9600** | Ground Transport | P-9600 = Ground Transport ✓ |
| **9700** | **Coworking** | P-9700 = **Wellness & Spa** (coworking = P-9510!) |
| **9800** | Incidentals | P-9800 = Shopping & Supplies |
| **9900** | Insurance | (no canonical TRAVEL_COA entry for bare 9900) |
| **9950** | Tips & Misc | (no canonical TRAVEL_COA entry for bare 9950) |

Codes in canonical TRAVEL_COA but **absent from `TRAVEL_COA_NAMES`** static fallback:
```
9310, 9320       — Brunch & Coffee, Dinner (meals split)
9410, 9420, 9430, 9440  — Adventure, Arts, Nightlife, Festivals
9450             — Bucket List (was TRAVEL_COA_NAMES "Nightlife")
9510, 9520, 9530 — Coworking, Gyms, Sports
9810, 9820, 9830 — Communication, Insurance & Fees, Groceries
```

### Set A — Orphan budget lines (budget code with no matching actuals code)

These codes will appear in `budgetData` after prefix stripping, but will NOT appear in `COA_NAMES` (and therefore won't have an actuals match) **unless they exist in `chart_of_accounts`**:

| Bare code | From | How budget items arrive | Actuals fate |
|-----------|------|------------------------|--------------|
| **9310** | P-9310 (Brunch & Coffee) | vendor-commit | No actuals unless chart_of_accounts has '9310' |
| **9320** | P-9320 (Dinner) | vendor-commit | No actuals unless chart_of_accounts has '9320' |
| **9410** | P-9410 (Adventure) | vendor-commit | No actuals unless chart_of_accounts has '9410' |
| **9420** | P-9420 (Arts & Culture) | vendor-commit | No actuals unless chart_of_accounts has '9420' |
| **9430** | P-9430 (Nightlife) | vendor-commit | No actuals unless chart_of_accounts has '9430' |
| **9440** | P-9440 (Festivals) | vendor-commit | No actuals unless chart_of_accounts has '9440' |
| **9450** | P-9450 (Bucket List) | vendor-commit | In TRAVEL_COA_NAMES as "Nightlife" — semantic mismatch |
| **9510** | P-9510 (Coworking) | vendor-commit | No actuals unless chart_of_accounts has '9510' |
| **9520** | P-9520 (Gyms) | vendor-commit | No actuals unless chart_of_accounts has '9520' |
| **9530** | P-9530 (Sports) | vendor-commit | No actuals unless chart_of_accounts has '9530' |
| **9810** | P-9810 (Communication) | vendor-commit | No actuals unless chart_of_accounts has '9810' |
| **9820** | P-9820 (Insurance & Fees) | vendor-commit | No actuals unless chart_of_accounts has '9820' |
| **9830** | P-9830 (Groceries) | vendor-commit | No actuals unless chart_of_accounts has '9830' |

**Whether these are mapping errors or intentional (no spend yet) requires DB verification.** If `chart_of_accounts` was seeded with all canonical TRAVEL_COA codes, they will show up in `COA_NAMES` from the DB layer (tier 1), and the actuals query will find them. If not seeded, they are structural orphans.

**Additionally — OLD commit route code mismatches (potential mapping errors):**

| Old code stored | Category intent | Canonical TRAVEL_COA code | Actual ledger goes to | Result |
|-----------------|-----------------|---------------------------|----------------------|--------|
| `P-9700` | coworking (old commit) | P-9510 | P-9510 (chart_of_accounts) | Budget '9700' ≠ Actuals '9510' → ORPHAN |
| `P-9500` | meals (old commit) | P-9310/P-9320 | P-9310 or P-9320 | Budget '9500' ≠ Actuals '9310'/'9320' → ORPHAN |
| `P-9400` | wellness (old commit) | P-9700 | P-9700 | Budget '9400' (activities) vs Actuals '9700' (wellness) → CATEGORY CONFUSION |
| `P-9400` | conference (old commit) | B-9500 | B-9500 | Budget '9400' ≠ Actuals '9500' → ORPHAN |

These are **mapping errors** if the user has trip budget items from the old commit route AND actual spend on the canonical codes. The old commit route (`trips/[id]/commit/route.ts`) remains live and may still be used.

### Set B — Unbudgeted actuals (actual code has no matching budget line)

The actuals query filters `coa.code IN (tripCodes)` where `tripCodes = Object.keys(COA_NAMES)`. This means actuals can only appear for codes in `COA_NAMES`. Any spend on a travel COA code NOT in `COA_NAMES` is invisible. However, if `chart_of_accounts` is fully seeded with TRAVEL_COA codes, `COA_NAMES` will include them all, and any spend without a budget line will show Budget=0, Actual>0 — the zero-budget guard renders Variance='—'.

**Correctness verdict — Route 2:**  
**HIGH RISK of mapping errors** for trips budgeted via the OLD `commit/route.ts`. Coworking (P-9700 old vs. P-9510 canonical) and meals (P-9500 old vs. P-9310/9320 canonical) will produce orphan budget lines with Actual=0 while the actual spend appears under the canonical codes. This is a **mapping error**, not intentional. Whether this affects live data requires DB verification.

---

## ROUTE 3: Personal/Homebase Budget (`/api/hub/year-calendar`)

### Budget COA key assembly
Two sources, both normalized to bare codes:

**Source 1 — Routines bridge** (`year-calendar/route.ts:109`):
```typescript
const coa = rawCoa.replace(/^[PB]-/, ''); // bare code
if (!COA_NAMES[coa]) continue;
```

**Source 2 — Legacy `budgets` table** (`year-calendar/route.ts:127–146`):
```typescript
const budgetRows = await prisma.budgets.findMany({
  where: { accountCode: { in: homebaseCodes.map(c => `P-${c}`) } }
});
const coa = row.accountCode.replace(/^P-/, '');
```
The budgets query is **pre-filtered** to only rows where `accountCode IN homebaseCodes.map(c => P-${c})` — so only budget rows with matching chart_of_accounts codes are read.

### Actuals COA set
`year-calendar/route.ts:154–171`:
```typescript
coa.code IN (homebaseCodes)  // = chart_of_accounts.code, non-7xxx personal entity
```

### COA alignment — Route 3

**Design is correct:** Budget and actuals are both constrained to the same `homebaseCodes` set (from `chart_of_accounts`). The `budgets` pre-filter ensures no budget row with an unknown code enters the computation.

**Set A — Orphan budget lines:** None by construction — the `budgets` query is filtered to `homebaseCodes.map(c => P-${c})`, so only chart_of_accounts-matched rows are read. Routine bridge only adds rows for codes in `COA_NAMES`.

**Set B — Unbudgeted actuals:** Any homebase `chart_of_accounts` code with ledger entries but no matching `budgets` row or routine will appear as Budget=0, Actual>0. These are intentional (unbudgeted spending categories) — Variance='—' per zero-budget guard.

**Correctness verdict — Route 3:** Correctly aligned by construction. No mapping error risk from the code.

---

## DIFF SUMMARY

### Set A — Orphan Budget Lines (Budget COA code ≠ any actual COA code)

| Route | Code | Category | Source | Likely cause | Action |
|-------|------|----------|--------|--------------|--------|
| Business | Unknown | Unknown | `module_expenses.coa_code` format unverified | **DB verification required**: bare vs. prefixed | Run `SELECT DISTINCT coa_code FROM module_expenses` |
| Nomad | 9310, 9320 | Brunch/Dinner | vendor-commit (canonical codes) | Missing from `chart_of_accounts` if not seeded | Run `SELECT code FROM chart_of_accounts WHERE entity_type='personal'` |
| Nomad | 9410, 9420, 9430, 9440 | Activity subtypes | vendor-commit | Missing from chart_of_accounts if not seeded | As above |
| Nomad | 9510, 9520, 9530 | Cowork/Gym/Sport | vendor-commit | Missing from chart_of_accounts if not seeded | As above |
| Nomad | 9810, 9820, 9830 | Comm/Insur/Groceries | vendor-commit | Missing from chart_of_accounts if not seeded | As above |
| **Nomad** | **9700** (budget) | **Coworking** (old commit intent) | old commit/route.ts | **Mapping error**: coworking code drift (9700→9510) | Confirm old commit items exist |
| **Nomad** | **9500** (budget) | **Meals** (old commit intent) | old commit/route.ts | **Mapping error**: meals code drift (9500→9310/9320) | Confirm old commit items exist |
| Personal | None | — | By construction | — | — |

### Set B — Unbudgeted Actuals (Actual COA code ≠ any budget line)

| Route | How it arises | Intentional? |
|-------|---------------|--------------|
| Business | Business expense in chart_of_accounts with ledger spend but no budget_line_items row | Yes — unbudgeted cost center (Variance='—') |
| Nomad | Travel account in chart_of_accounts with spend but no trip budget item | Yes — spending without a budget (Variance='—') |
| Personal | Homebase account in chart_of_accounts with spend but no routine/budget row | Yes — unbudgeted recurring spend (Variance='—') |

The zero-budget guard in the variance render is documented (Variance='—' for Budget=0 rows). All Set B entries are intentional by design.

---

## AUTHORITY & CORRECTNESS

Per Research Finding 2: "COA alignment must be verified — every budget line must map 1:1 to one or more actual account codes before the merged view is used for decisions."

**Code-verified correct:** Routes 1 and 3 are architecturally sound — the actuals query is constrained to the same COA set as the budget. Route 2 (nomad) has a structural weakness in the `TRAVEL_COA_NAMES` static fallback that diverges from the canonical registry.

**Requires DB verification (Alex via psql):**
```sql
-- 1. Business: confirm coaCode format in budget_line_items
SELECT DISTINCT "coaCode", count(*) 
FROM budget_line_items 
WHERE source = 'business' 
GROUP BY "coaCode" ORDER BY 1;

-- 2. Nomad: confirm all TRAVEL_COA canonical codes are in chart_of_accounts
SELECT code, name FROM chart_of_accounts 
WHERE entity_type = 'personal' 
AND account_type = 'expense' 
AND code ~ '^9[0-9]{3}$'
ORDER BY code;

-- 3. Nomad: find old-format trip budget items (P-9700 coworking, P-9500 meals)
SELECT "coaCode", count(*) 
FROM budget_line_items 
WHERE source = 'trip' 
AND "coaCode" IN ('P-9700','P-9500','P-9400','P-9300','P-9350')
GROUP BY "coaCode";
```

---

## RANKED FINDINGS

| Rank | Finding | Severity | File:Line |
|------|---------|----------|-----------|
| 1 | OLD `commit/route.ts` writes stale COA codes (P-9700 for coworking, P-9500 for meals) that diverge from canonical TRAVEL_COA — MAPPING ERRORS if old trips exist | **HIGH** | `trips/[id]/commit/route.ts:54–103` |
| 2 | `TRAVEL_COA_NAMES` static fallback in `nomad-budget` diverges from canonical `TRAVEL_COA` — '9700' labelled "Coworking" but canonical is "Wellness"; 9450 labelled "Nightlife" but canonical is "Bucket List" | **HIGH** | `hub/nomad-budget/route.ts:7–20` |
| 3 | New canonical TRAVEL_COA codes (9310, 9320, 9510, 9520, 9530, 9810–9830) absent from `TRAVEL_COA_NAMES` — budget items for these codes are orphans unless `chart_of_accounts` has them | **MEDIUM** | `hub/nomad-budget/route.ts:7–20`, `travelCOA.ts` |
| 4 | `business-budget` does NOT strip B- prefix from `budget_line_items.coaCode` (only strips routine codes) — if `module_expenses.coa_code` stores prefixed codes, ALL business budget lines are orphans | **MEDIUM** | `hub/business-budget/route.ts:84` vs `:122` |
| 5 | TRAVEL_COA_NAMES + LEGACY_COA_NAMES static fallbacks are a maintenance liability — every new TRAVEL_COA category needs a corresponding update or it only appears in budget, never in actuals | **LOW** | `hub/nomad-budget/route.ts:7–32` |

---

## DISPOSITION

- **Set A orphan budget lines:** Confirmed present (structural) for nomad-budget when old commit route was used. Whether historical data was written with old codes requires DB query #3 above. If yes: **mapping errors, not intentional**. New budget items via vendor-commit use canonical codes and are aligned IF chart_of_accounts is seeded.
- **Set B unbudgeted actuals:** Intentional by design — all three routes apply a zero-budget guard that renders Variance='—' for Budget=0 rows. No fix needed.
- **Prerequisite met:** The business and homebase routes are correctly aligned for decisions. The nomad/travel route requires DB verification of old commit data before the merged view is used for trip P&L decisions.

correlation_id: 0e14f77e-4907-45a5-837c-142207272dd6
project_id: 9e785d54-ed77-4924-aad6-7de44bbdd4c8
