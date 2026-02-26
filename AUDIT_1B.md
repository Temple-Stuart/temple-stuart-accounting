# Phase 1B Frontend Audit — Broken Pages & Queries

Generated: 2026-02-26

## BROKEN — Dead Table References (5 API Routes, already 501 stubs)

These routes return 501 "being rebuilt" — safe but non-functional:

| File | Dead Table | Status |
|------|-----------|--------|
| `src/app/api/bank-reconciliations/route.ts` | bank_reconciliations | 501 stub |
| `src/app/api/period-closes/route.ts` | period_closes | 501 stub |
| `src/app/api/closing-periods/route.ts` | closing_periods | 501 stub |
| `src/app/api/closing-periods/close/route.ts` | closing_periods | 501 stub |
| `src/app/api/closing-periods/reopen/route.ts` | closing_periods | 501 stub |

## BROKEN — Wrong Query Patterns (2 API Routes)

| File | Line | Issue |
|------|------|-------|
| `src/app/api/business/route.ts` | 23 | `code: { startsWith: 'B-' }` — B- prefixes stripped in Phase 0 |
| `src/app/api/hub/business-budget/route.ts` | 30 | `code: { startsWith: 'B-' }` — B- prefixes stripped in Phase 0 |

## BROKEN — Frontend Components (3 files using old prefixes or dead concepts)

| File | Line | Issue |
|------|------|-------|
| `src/components/dashboard/SpendingDashboard.tsx` | 48-50 | Filters by P-/B-/T- accountCode prefixes |
| `src/components/dashboard/PeriodClose.tsx` | all | Renders period close data from dead table (empty array) |
| `src/components/dashboard/ReconciliationTab.tsx` | all | References reconciliation items from dead structure |

## BROKEN — Dashboard Dead API Calls

| File | Line | Issue |
|------|------|-------|
| `src/app/dashboard/page.tsx` | 121 | Calls `/api/bank-reconciliations` (501 stub) |
| `src/app/dashboard/page.tsx` | 123 | Calls `/api/period-closes` (501 stub) |
| `src/app/dashboard/page.tsx` | 248 | `saveReconciliation()` POSTs to 501 stub |
| `src/app/dashboard/page.tsx` | 249-250 | `closePeriod/reopenPeriod` POST to 501 stub |

Note: All dead API calls are guarded by `.ok` checks — dashboard won't crash,
but users will see empty/non-functional reconciliation and period close tabs.

## CONFIRMED WORKING — Already Updated in Phase 0/1A

| File | Notes |
|------|-------|
| `src/app/api/journal-transactions/route.ts` | Queries journal_entries + ledger_entries correctly |
| `src/app/api/transactions/route.ts` | Working (updated in 1A with ensureBookkeeping) |
| `src/app/api/chart-of-accounts/route.ts` | Working (updated in 1A with ensureBookkeeping) |
| `src/app/api/statements/route.ts` | Working (updated in 1A with ensureBookkeeping) |
| `src/app/api/journal-entries/route.ts` | Working (updated in 1A with request_id) |
| `src/app/api/journal-entries/manual/route.ts` | Working (updated in 1A with request_id) |
| `src/app/api/transactions/commit-to-ledger/route.ts` | Working (updated in 1A) |
| `src/app/api/transactions/uncommit/route.ts` | Working (updated in 1A) |
| `src/lib/journal-entry-service.ts` | Working (updated in 1A) |
| `src/lib/position-tracker-service.ts` | Working (updated in 1A) |
| All scanner routes (`/api/tastytrade/*`) | Untouched, working |
| All AI routes (`/api/ai/*`) | Untouched, working |
| All trading routes (`/api/trading/*`) | Untouched, working |

## POSSIBLY BROKEN — Needs Manual Review (Low Priority)

| File | Notes |
|------|-------|
| `src/app/api/accounts/update-entity/route.ts` | Updates entityType on accounts (legacy concept) |
| `src/components/dashboard/BankReconciliation.tsx` | Receives empty data, shows empty state — functional but useless |

## entity_type References — NOT BROKEN

40+ references to entity_type throughout codebase. These reference the CURRENT
schema field on entities table. Not broken — working as designed.

## Fix Priority

1. Fix `/api/business/route.ts` and `/api/hub/business-budget/route.ts` B- prefix queries
2. Fix `SpendingDashboard.tsx` P-/B-/T- prefix filtering
3. Clean up dashboard dead API calls and mark disabled tabs
4. Run tsc verification
