# Accounting Basis Consistency Audit
**Date:** 2026-06-20  
**Branch:** claude/modest-volta-nbkoag  
**Auditor:** Claude Code Execute-Task Routine (automated)  
**Task:** Confirm budget and actuals are on the same accounting basis  
**Risk tier:** Read-only. No code changes.

---

## VERDICT

**Budget basis: CASH**  
**Actuals basis: CASH**  
**Match: YES**

No basis mismatch. The merged budget-vs-actuals variance view is safe to ship from an
accounting basis standpoint.

---

## 1 · ACTUALS BASIS (all three routes)

All three routes — `year-calendar`, `business-budget`, and `nomad-budget` — query actuals
identically:

```sql
SELECT
  coa.code,
  EXTRACT(MONTH FROM je.date)::int as month,
  SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)::text as debits
FROM ledger_entries le
JOIN journal_entries je ON le.journal_entry_id = je.id
...
WHERE je.is_reversal = false
  AND je.reversed_by_entry_id IS NULL
  AND EXTRACT(YEAR FROM je.date) = ${year}
```

**Source of `je.date`:** `commit-to-ledger/route.ts:115`

```typescript
date: new Date(plaidTxn.date),
```

`plaidTxn.date` is Plaid's `date` field — the settlement/posting date of the bank or
card transaction. No accruals, no deferrals, no accounts-payable timing adjustments.

**Actuals basis: CASH** (expense recognized on date of bank/card settlement).

---

## 2 · BUDGET BASIS

### Source 1 — `operations_routines` with `budget_amount` (year-calendar + business-budget)

`year-calendar/route.ts:89–118` and `business-budget/route.ts:102–130` both call
`routinesMonthlyByCoa(routineInputs, year, m)`.

From `src/lib/operations/routineBudget.ts:7`:

```
monthly = expandBetween(schedule_rrule, timezone, monthStart, monthEnd).length × budget_amount
```

Budget is recognized in **the calendar month when the routine is scheduled to fire** — the
date the spending event is planned to occur. There is no service-period spreading,
accrual, or lag. A routine for a weekly gym membership shows a budget figure in each month
based on how many times the rrule fires that month.

**Basis: CASH** (planned cash outflow in the month of the scheduled occurrence).

### Source 2 — `budgets` table (year-calendar, transitional source)

`year-calendar/route.ts:127–146`:

```typescript
const budgetRows = await prisma.budgets.findMany({
  where: { userId: user.id, year: year, accountCode: { in: ... } }
});
for (const row of budgetRows) {
  const val = Number(row[MONTH_COLS[m]] || 0); // jan, feb, ..., dec columns
  ...
}
```

Schema (`prisma/schema.prisma:485–509`): `jan` through `dec` columns, `Decimal(12, 2)`.
Static user-entered monthly planned-spend amounts. No concept of service period, liability
recognition, or accrual. A value in `mar` = planned cash out in March.

**Basis: CASH** (planned outflows allocated to calendar month of payment).

### Source 3 — `budget_line_items` (business-budget + nomad-budget)

`business-budget/route.ts:69–91`: queries `budget_line_items` where `source = 'business'`.
`nomad-budget/route.ts:89–117`: queries `budget_line_items` where `source = 'trip'`.

Schema (`prisma/schema.prisma:1050–1075`): `year`, `month`, `amount Decimal(12, 2)`.
Each row is a planned expenditure in a specific calendar month. No `effective_date`,
no `service_period_start/end`, no accrual fields.

For travel specifically, the `month` reflects when the trip occurs (the month travel costs
are paid), not when they were booked or when a future trip liability was recognized.

**Basis: CASH** (planned cash outflows by calendar month of occurrence).

---

## 3 · EVIDENCE MATRIX

| Dimension | Actuals | Budget — Routines | Budget — `budgets` | Budget — `budget_line_items` |
|---|---|---|---|---|
| Recognition event | Plaid settlement date (`je.date`) | Scheduled occurrence date (rrule expansion) | User-entered month column | `(year, month)` of planned spend |
| File:line | `year-calendar/route.ts:154–171` | `routineBudget.ts:7` | `year-calendar/route.ts:127–146` | `business-budget/route.ts:69–91` |
| Schema field | `journal_entries.date @db.Date` | `operations_routines.budget_amount + schedule_rrule` | `budgets.jan…dec Decimal` | `budget_line_items.month Int` |
| Accruals? | No | No | No | No |
| Deferrals? | No | No | No | No |
| AP/AR timing? | No | No | No | No |
| **Basis** | **CASH** | **CASH** | **CASH** | **CASH** |

---

## 4 · ONE NUANCE (non-blocking)

Within cash basis, a minor timing edge exists but does NOT constitute a basis mismatch:

**Routine budget vs. actuals month boundary:** A routine scheduled Jan 31 in a UTC+9
timezone expands to Jan 31 local = Jan 31 UTC+9 (Jan 30 23:00 UTC). The rrule expansion
is timezone-aware (`routineBudget.ts:53`). The actual transaction settles within days in
the same month. In practice the same month is hit by both sides for virtually all
real-world occurrences.

**Plaid `date` vs. `authorized_date`:** The `transactions` table (`schema.prisma:365`)
stores both `date` and `authorized_date`. The code uses `plaidTxn.date` (settlement date),
not `authorized_date`. Settlement typically lags authorization by 1–3 days. For a Dec 31
credit card charge, actuals may land Jan 1–3. This is standard cash-basis treatment
(settle date = event date) and is consistent across ALL actuals; it does not create a
differential vs. the budget side.

Neither edge creates a systematic bias between budget and actuals columns. Both are
within normal cash-basis variance.

---

## 5 · ASSERTION TEST (per task correctness spec)

> 'Budget basis: [cash/accrual]. Actuals basis: [cash/accrual]. Match: YES/NO.'

**Budget basis: CASH.**  
**Actuals basis: CASH.**  
**Match: YES.**

Research Finding 1 risk — "cash/accrual mismatch produces systematic, silent
misrepresentation" — **does not apply.** Both sides use the same basis. Variance rows
reflect real timing and spending differences, not accounting definition differences.

---

## 6 · FILES AUDITED

| File | Lines verified |
|---|---|
| `src/app/api/hub/year-calendar/route.ts` | 79–171 (budget sources 1+2, actuals query) |
| `src/app/api/hub/business-budget/route.ts` | 67–155 (budget sources 2+3, actuals query) |
| `src/app/api/hub/nomad-budget/route.ts` | 87–158 (budget source 3, actuals query) |
| `src/app/api/transactions/commit-to-ledger/route.ts` | 108–121 (date used for je.date) |
| `src/lib/journal-entry-service.ts` | 112–125 (journal entry creation, date field) |
| `src/lib/operations/routineBudget.ts` | 1–77 (routine budget expansion logic) |
| `prisma/schema.prisma` | 180–226 (journal_entries + ledger_entries) |
| `prisma/schema.prisma` | 360–395 (transactions, date vs authorized_date) |
| `prisma/schema.prisma` | 485–509 (budgets table) |
| `prisma/schema.prisma` | 1050–1075 (budget_line_items) |
