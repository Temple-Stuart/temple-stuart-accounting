# EXEC Audit — RunwayDataProvider Implementation
**Date:** 2026-06-20  
**Branch:** claude/modest-volta-lyiycm  
**Task:** Create RunwayDataProvider: lift year + fetched data state above both budget components  
**correlation_id:** 59639348-f49b-4397-97ac-7e4e393568ae  
**project_id:** 9e785d54-ed77-4924-aad6-7de44bbdd4c8

---

## 1 · WHAT EXISTS (file:line, correctness label)

| File | Line | Label | Note |
|------|------|-------|------|
| `src/components/hub/HubBudgetSection.tsx` | 50–210 | CORRECT | Self-fetches 1 route at a time; `toggle` + `year` local state |
| `src/components/hub/HubBudgetSection.tsx` | 66–79 | CORRECT | `useEffect([active.route, year])` — single route fetch |
| `src/components/hub/HubBudgetSection.tsx` | 28–32 | CORRECT | `BudgetResponse` type: `budgetData`, `actualData`, `coaNames` (no grand totals) |
| `src/components/hub/BudgetComparison.tsx` | 44–271 | CORRECT | Self-fetches all 3 routes + trips; `selectedYear` local state |
| `src/components/hub/BudgetComparison.tsx` | 55–101 | CORRECT | 4 parallel async loaders in one `useEffect([selectedYear])` |
| `src/components/hub/BudgetComparison.tsx` | 29–36 | CORRECT | `BudgetState` type: adds `budgetGrandTotal` + `actualGrandTotal` |
| `src/components/hub/BudgetComparison.tsx` | 80–82 | CORRECT | nomad-budget fallbacks: `data.monthlyData`, `data.grandTotal` |
| `src/components/home/ModuleLauncher.tsx` | 1–14 | CORRECT | Imports `HubBudgetSection`, `BudgetComparison`; no `RunwayDataProvider` yet |
| `src/components/home/ModuleLauncher.tsx` | 442–455 | CORRECT | `authed===true` section renders `<HubCalendar/>`, `<HubBudgetSection/>`, `<BudgetComparison/>` |
| `src/app/api/hub/year-calendar/route.ts` | 191–198 | CORRECT | Returns `budgetData`, `actualData`, `coaNames`, `budgetGrandTotal`, `actualGrandTotal` |
| `src/app/api/hub/business-budget/route.ts` | — | CORRECT (not read) | Returns same shape (confirmed via BudgetComparison usage) |
| `src/app/api/hub/nomad-budget/route.ts` | 1–30 | PARTIAL (header only) | Returns `monthlyData` or `budgetData` + `grandTotal` or `budgetGrandTotal` (per BudgetComparison fallback) |

---

## 2 · WHAT DOES NOT EXIST YET

| Missing | Required | Notes |
|---------|----------|-------|
| `src/components/hub/RunwayDataProvider.tsx` | YES | New file — the entire deliverable |
| `RunwayDataProvider` import in `ModuleLauncher.tsx` | YES | One import line to add |
| `<RunwayDataProvider>` wrapper in `ModuleLauncher.tsx:444` | YES | One JSX wrapper in budget block |

---

## 3 · ASSERTION TEST — What Must Be True After This Task

| Assertion | Test |
|-----------|------|
| Existence — `RunwayDataProvider.tsx` exists at correct path | File present, exports `default` + `useRunwayData` |
| Completeness — context shape matches task spec | `year`, `setYear`, `activeTab`, `setActiveTab`, `personalData`, `businessData`, `travelData` all present |
| Accuracy — fetches correct URLs with `?year=` param | `/api/hub/year-calendar`, `/api/hub/business-budget`, `/api/hub/nomad-budget` |
| Accuracy — `useEffect` keyed on `[year, activeTab]` | Dependency array matches spec exactly |
| Rights — no DB access in provider | Provider only calls API routes; no Prisma |
| No-drift — nomad-budget fallback shape preserved | `data.budgetData || data.monthlyData`, `data.budgetGrandTotal || data.grandTotal` |
| Additive — HubBudgetSection unchanged | No modifications |
| Additive — BudgetComparison unchanged | No modifications |
| Render — children unchanged | Provider passes children through without alteration |

---

## 4 · RISK

**RISK TIER:** write-with-log (new file + one JSX wrapper line in ModuleLauncher).  
No existing logic deleted. No DB touched. No auth bypass. No paid API call. Additive only.

---

## 5 · IMPLEMENTATION PLAN

1. **Create** `src/components/hub/RunwayDataProvider.tsx`:
   - `BudgetData` type (mirrors `BudgetState` from BudgetComparison — includes grand totals for downstream use)
   - `EMPTY` sentinel for initial state
   - `RunwayDataContext` with full context value type
   - `useRunwayData()` hook (throws if used outside provider)
   - `RunwayDataProvider` default export — owns year/activeTab state + 3-route fetch
   - `useEffect([year, activeTab])` — fires all 3 fetches; cancel on unmount
   - nomad-budget fallback: `data.budgetData || data.monthlyData`, `data.budgetGrandTotal || data.grandTotal`

2. **Edit** `src/components/home/ModuleLauncher.tsx`:
   - Add `import RunwayDataProvider from '@/components/hub/RunwayDataProvider';` at line 14
   - Wrap budget block at lines 448–452 (`<HubBudgetSection/>` + `<BudgetComparison/>`) in `<RunwayDataProvider>`
