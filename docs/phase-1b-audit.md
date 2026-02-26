# Phase 1B Audit — Broken Frontend References

Generated: 2026-02-26

## Dead Table References

### journal_transactions / journal_entry_lines
No references found in src/. Clean.

### bank_reconciliation (excluding 501 stubs)
- `src/app/api/bank-reconciliations/route.ts:3` — TODO comment only (501 stub)
- `src/app/dashboard/page.tsx` — imports/uses BankReconciliation component, fetches from dead endpoint

### period_close / closing_period (excluding 501 stubs)
- `src/app/dashboard/page.tsx:80` — `periodCloses` state variable
- `src/app/dashboard/page.tsx:637` — renders `<PeriodClose>` component with dead data
- `src/components/dashboard/PeriodClose.tsx:30,40,87,92,246,249` — full component referencing dropped tables

### category_defaults
No references found. Clean.

## Old Entity Type Checks

- `src/app/chart-of-accounts/page.tsx:32` — `entityType === 'business'` (should be `'sole_prop'`)

## Old Prefix Patterns (P-/B-/T-) — Actionable Bugs

### Active bugs (must fix)
- `src/app/api/business/route.ts:23` — `code: { startsWith: 'B-' }` — Prisma query using dead prefix
- `src/app/api/hub/business-budget/route.ts:30` — `code: { startsWith: 'B-' }` — same bug
- `src/app/api/hub/business-budget/route.ts:71,111` — fallback COA codes `'B-6900'`
- `src/components/dashboard/SpendingDashboard.tsx:48-50` — filters by P-/B-/T- prefix

### Non-actionable (display text, module pages, or DO NOT TOUCH)
- `src/app/agenda/new/page.tsx` — hardcoded COA codes in display suggestions
- `src/app/auto/page.tsx` — hardcoded COA codes for expense categories
- `src/app/budgets/trips/[id]/page.tsx` — trip COA mapping display
- `src/app/growth/page.tsx` — expense category defaults
- `src/app/health/page.tsx` — expense category defaults
- `src/app/home/page.tsx` — expense category defaults
- `src/app/personal/page.tsx` — expense category defaults
- `src/app/shopping/page.tsx` — shopping category defaults
- `src/app/api/ai/cart-plan/route.ts` — AI route (DO NOT TOUCH)
- `src/app/api/ai/meal-planner/route.ts` — AI route (DO NOT TOUCH)
- `src/app/api/hub/nomad-budget/route.ts` — trip budget COA mapping
- `src/app/api/trips/[id]/commit/route.ts` — trip commit COA mapping
- `src/lib/robinhood-parser.ts` — trading (DO NOT TOUCH)
- `src/components/dashboard/TradeCommitWorkflow.tsx` — trading (DO NOT TOUCH)
- `src/components/dashboard/TradeCommitQueue.tsx` — trading (DO NOT TOUCH)
- `src/components/dashboard/OpensCommitPanel.tsx` — trading (DO NOT TOUCH)

## Data Structure Mismatches

### journal-entries/page.tsx
- Interface expects flat: `debitAccount`, `creditAccount`, `amount`, `posted`
- API returns nested `ledger_entries[]` with `entry_type` ('D'/'C'), `amount` (BigInt string), `account` object

### ledger/page.tsx
- Page reads `data.entries` (line 26-27) — flat list
- API returns `{ ledgers: [...] }` — grouped by account, each with nested `entries[]`

### statements/page.tsx
- API returns amounts in dollars (divides by 100 server-side)
- Page `formatMoney` divides by 100 again — double division bug

## 501 Stub Routes (dead, should delete later)
- src/app/api/bank-reconciliations/route.ts
- src/app/api/closing-periods/route.ts
- src/app/api/closing-periods/close/route.ts
- src/app/api/closing-periods/reopen/route.ts
- src/app/api/period-closes/route.ts

## Transactions Page — Verified Working (FIX 8)
- `src/app/transactions/page.tsx` — Fetches `/api/transactions` + `/api/transactions/manual`, displays correctly
- `src/app/api/transactions/route.ts` — Queries `transactions` table (alive), returns correct shape
- `src/app/api/transactions/manual/route.ts` — Creates/reads manual transactions in `transactions` table
- `src/app/api/transactions/commit-to-ledger/route.ts` — Uses `commitPlaidTransaction` with new schema (journal_entries + ledger_entries)
- No dead schema references in any of these files
- Note: page doesn't display COA accountCode or committed-to-ledger status as columns (design gap, not a bug)

## Pages inventory (35 total)
See find output. Bookkeeping-critical pages:
- src/app/chart-of-accounts/page.tsx
- src/app/dashboard/page.tsx
- src/app/journal-entries/page.tsx
- src/app/ledger/page.tsx
- src/app/statements/page.tsx
- src/app/transactions/page.tsx
