# Audit: Wire HubBudgetSection to RunwayDataProvider
**Date:** 2026-06-20  
**Branch:** `claude/modest-volta-rj98sb`  
**Correlation:** `19a48b08-5d98-4cc7-9734-1327f77b3ed6`  
**Risk tier:** write-with-log — data-fetching layer only, zero rendering changes

---

## Files read (file:line citations)

| File | Lines inspected | Purpose |
|------|----------------|---------|
| `src/components/hub/HubBudgetSection.tsx` | 1–210 | Target component — full read |
| `src/components/hub/BudgetComparison.tsx` | 1–271 | Sibling consumer — full read |
| `src/components/home/ModuleLauncher.tsx` | 1–528+ | Provider mount point — full read |

---

## Root cause confirmed

**Root Cause A (Diagnosis §5 FM2 + FM3):** `HubBudgetSection` owns independent `year` and `toggle` state and self-fetches `active.route?year=${year}` inside a `useEffect` (`HubBudgetSection.tsx:53,66–79`). `BudgetComparison` owns independent `selectedYear` state and self-fetches the same three routes (`BudgetComparison.tsx:55–101`). Year state changes in either component are invisible to the other, producing desync. Both components hitting the same three routes constitutes the "3× duplicate fetches" (PI1.3 completeness violation).

---

## Structural observations

- `HubBudgetSection.tsx:22` — imports `{ useEffect, useState }`. After refactor only `useState` remains.
- `HubBudgetSection.tsx:34` — `ToggleKey` defined locally. Moves to provider; imported back here.
- `HubBudgetSection.tsx:28–32` — `BudgetResponse` interface defined locally. Moves to provider; imported back here.
- `HubBudgetSection.tsx:50–79` — state that moves to provider: `year` (line 53), `toggle` (line 52), `data` (line 55), `loading` (line 56). The `useEffect` fetch block (lines 66–79) is removed entirely.
- `HubBudgetSection.tsx:54,58–60` — state that stays LOCAL: `monthIdx` (line 54), `drillDown` (lines 58–60).
- `HubBudgetSection.tsx:82–99` — row derivation (`allRows`, `rows`, totals): **zero changes** — still reads `data.coaNames`, `data.budgetData`, `data.actualData`. The local `data` binding is set to the provider slice for the active toggle.
- `HubBudgetSection.tsx:121–123` — year stepper buttons call `setYear(y => y - 1/+1)`. After refactor these write to provider context, satisfying the correctness test (BudgetComparison re-renders to the same year in the next task).
- `ModuleLauncher.tsx:448–452` — `<HubBudgetSection />` and `<BudgetComparison />` are sibling children of the same `<div className="max-w-7xl mx-auto">`. The `RunwayDataProvider` wraps both.

---

## No security / auth / migration / schema gate

- No API route changes.
- No DB writes.
- No auth flow changes.
- No Prisma schema changes.
- Provider only orchestrates existing authenticated `fetch()` calls that were already happening in HubBudgetSection — no new routes, no new cost, no new surface area.

---

## Implementation plan

1. **NEW** `src/components/hub/RunwayDataProvider.tsx`  
   - Exports `BudgetResponse` interface, `ToggleKey` type  
   - Pre-fetches `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` in parallel on year change  
   - Context holds: `year`, `setYear`, `toggle`, `setToggle`, `data: Record<'personal'|'business'|'travel', BudgetResponse>`, `loading`  
   - Logs fetch errors (write-with-log requirement)  

2. **EDIT** `src/components/hub/HubBudgetSection.tsx`  
   - Remove `useEffect` import; remove `BudgetResponse`, `ToggleKey` local definitions  
   - Import `useRunwayData`, `BudgetResponse`, `ToggleKey` from `./RunwayDataProvider`  
   - Remove state: `year`, `toggle`, `data`, `loading` — read from `useRunwayData()`  
   - Add: `const data = toggle !== 'trading' ? routeMap[toggle] : EMPTY_BUDGET;`  
   - Keep: `monthIdx`, `drillDown` state; all rendering code unchanged  

3. **EDIT** `src/components/home/ModuleLauncher.tsx`  
   - Import `RunwayDataProvider`  
   - Wrap `<HubBudgetSection />` + `<BudgetComparison />` in `<RunwayDataProvider>`

---

## Correctness checklist (pre-merge)

- [ ] Rendered table pixel-identical (zero rendering code touched)
- [ ] Network panel: 0 fetch calls initiated by HubBudgetSection
- [ ] Year stepper in HubBudgetSection updates provider `year` → BudgetComparison re-renders (verify in next task)
- [ ] Toggle switches are instant (data pre-fetched for all 3 routes)
- [ ] Trading tab still shows "route pending" message (no regression)
- [ ] Drill-down still opens BudgetDrillDown on actual cell click
