# RECONNAISSANCE AUDIT: Temple Stuart Codebase — Pre-Rebuild Survey

**Date:** 2026-02-25
**Auditor:** Claude (Code-Only — No DB Access from Sandbox)
**Branch:** `claude/audit-bookkeeping-system-0iSjS`
**Status:** READ ONLY — No code modifications

---

## IMPORTANT: DATABASE ACCESS LIMITATION

This sandbox environment has **zero outbound network access** (DNS resolution fails for all hosts including google.com). All database-dependent sections provide **corrected SQL queries** for manual execution. All code-based sections are fully verified from source.

---

## TABLE OF CONTENTS

1. [SCHEMA SUMMARY](#1-schema-summary)
2. [ROW COUNT MATRIX](#2-row-count-matrix-sql-queries-for-manual-execution)
3. [BOOKKEEPING PIPELINE MAP](#3-bookkeeping-pipeline-map)
4. [TRADING PIPELINE DEPENDENCIES](#4-trading-pipeline-dependencies)
5. [API ROUTE SECURITY MATRIX](#5-api-route-security-matrix)
6. [AUTH & SECURITY AUDIT](#6-auth--security-audit)
7. [EXISTING FEATURE INVENTORY](#7-existing-feature-inventory)
8. [TARGET ARCHITECTURE COMPARISON](#8-target-architecture-comparison)
9. [NUKE IMPACT ASSESSMENT](#9-nuke-impact-assessment)
10. [MIGRATION SURFACE](#10-migration-surface)
11. [RISKS AND UNKNOWNS](#11-risks-and-unknowns)

---

## 1. SCHEMA SUMMARY

### 1A. Complete Model Inventory (60 Models)

| # | Model | Table Name | Primary Key | Has userId | Domain |
|---|-------|-----------|-------------|------------|--------|
| 1 | `users` | users | id (TEXT) | IS users | Auth |
| 2 | `accounts` | accounts | id (TEXT) | YES | Banking |
| 3 | `plaid_items` | plaid_items | id (TEXT) | YES | Banking |
| 4 | `transactions` | transactions | id (TEXT) | NO (via accounts) | Banking |
| 5 | `investment_transactions` | investment_transactions | id (TEXT) | NO (via accounts) | Trading |
| 6 | `securities` | securities | id (TEXT) | NO (global) | Trading |
| 7 | `chart_of_accounts` | chart_of_accounts | id (UUID) | YES | Accounting |
| 8 | `journal_transactions` | journal_transactions | id (UUID) | NO | Accounting |
| 9 | `ledger_entries` | ledger_entries | id (UUID) | NO | Accounting |
| 10 | `journal_entries` | journal_entries | id (CUID) | YES | Accounting (Memo) |
| 11 | `journal_entry_lines` | journal_entry_lines | id (CUID) | NO | Accounting (Memo) |
| 12 | `merchant_coa_mappings` | merchant_coa_mappings | id (UUID) | YES | Categorization |
| 13 | `category_coa_defaults` | category_coa_defaults | id (UUID) | NO (global) | Categorization |
| 14 | `trading_positions` | trading_positions | id (UUID) | NO | Trading |
| 15 | `stock_lots` | stock_lots | id (UUID) | YES | Trading |
| 16 | `lot_dispositions` | lot_dispositions | id (UUID) | NO | Trading/Tax |
| 17 | `lot_adjustments` | lot_adjustments | id (TEXT) | NO | Trading |
| 18 | `corporate_actions` | corporate_actions | id (TEXT) | YES | Trading |
| 19 | `tax_scenarios` | tax_scenarios | id (UUID) | YES | Tax |
| 20 | `tax_overrides` | tax_overrides | id (UUID) | YES | Tax |
| 21 | `bank_reconciliations` | bank_reconciliations | id (CUID) | YES | Accounting |
| 22 | `reconciliation_items` | reconciliation_items | id (CUID) | NO | Accounting |
| 23 | `period_closes` | period_closes | id (CUID) | YES | Accounting |
| 24 | `closing_periods` | closing_periods | id (TEXT) | NO | Accounting |
| 25 | `budgets` | budgets | id (CUID) | YES | Budgeting |
| 26 | `budget_line_items` | budget_line_items | id (CUID) | YES | Budgeting |
| 27 | `trade_journal_entries` | trade_journal_entries | id (CUID) | YES | Trading |
| 28 | `trade_cards` | trade_cards | id (UUID) | YES | Trading |
| 29 | `trade_card_links` | trade_card_links | id (UUID) | NO | Trading |
| 30 | `tastytrade_connections` | tastytrade_connections | id (CUID) | YES | Trading |
| 31 | `calendar_events` | calendar_events | id (UUID) | YES | Lifestyle |
| 32 | `home_expenses` | home_expenses | id (UUID) | YES | Lifestyle |
| 33 | `module_expenses` | module_expenses | id (UUID) | YES | Lifestyle |
| 34 | `trips` | trips | id (CUID) | YES | Travel |
| 35 | `trip_participants` | trip_participants | id (CUID) | NO | Travel |
| 36 | `trip_expenses` | trip_expenses | id (CUID) | NO | Travel |
| 37 | `expense_splits` | expense_splits | id (CUID) | NO | Travel |
| 38 | `trip_itinerary` | trip_itinerary | id (CUID) | NO | Travel |
| 39 | `trip_destinations` | trip_destinations | id (CUID) | NO | Travel |
| 40 | `ikon_resorts` | ikon_resorts | id (CUID) | NO (global) | Travel |
| 41 | `surf_spots` | surf_spots | id (CUID) | NO (global) | Travel |
| 42 | `golf_courses` | golf_courses | id (CUID) | NO (global) | Travel |
| 43 | `cycling_destinations` | cycling_destinations | id (CUID) | NO (global) | Travel |
| 44 | `race_destinations` | race_destinations | id (CUID) | NO (global) | Travel |
| 45 | `triathlon_destinations` | triathlon_destinations | id (CUID) | NO (global) | Travel |
| 46 | `festival_destinations` | festival_destinations | id (CUID) | NO (global) | Travel |
| 47 | `skatepark_destinations` | skatepark_destinations | id (CUID) | NO (global) | Travel |
| 48 | `conference_destinations` | conference_destinations | id (CUID) | NO (global) | Travel |
| 49 | `nomad_cities` | nomad_cities | id (CUID) | NO (global) | Travel |
| 50 | `dining_destinations` | dining_destinations | id (CUID) | NO (global) | Travel |
| 51 | `museum_destinations` | museum_destinations | id (CUID) | NO (global) | Travel |
| 52 | `swim_destinations` | swim_destinations | id (CUID) | NO (global) | Travel |
| 53 | `rafting_destinations` | rafting_destinations | id (CUID) | NO (global) | Travel |
| 54 | `sail_destinations` | sail_destinations | id (CUID) | NO (global) | Travel |
| 55 | `places_cache` | places_cache | id (CUID) | NO (global) | Travel |
| 56 | `RFP` | RFP | id (TEXT) | NO | CRM |
| 57 | `prospects` | prospects | id (TEXT) | NO | CRM |
| 58 | `Account` | Account | id (CUID) | YES | NextAuth |
| 59 | `Session` | Session | id (CUID) | YES | NextAuth |
| 60 | `User` | User | id (CUID) | IS users | NextAuth |

### 1B. Monetary Field Type Inconsistencies

| Table | Field | Type | Issue |
|-------|-------|------|-------|
| `transactions` | amount | Float | Floating point for money |
| `investment_transactions` | amount, price, fees | Float | Floating point for money |
| `trading_positions` | open_price, cost_basis, realized_pl | Float | Floating point for money |
| `stock_lots` | cost_per_share, total_cost_basis | Float | Floating point for money |
| `lot_dispositions` | proceeds_per_share, realized_gain_loss | Float | Floating point for money |
| `ledger_entries` | amount | BigInt | **CORRECT** (cents) |
| `chart_of_accounts` | settled_balance | BigInt | **CORRECT** (cents) |
| `journal_entry_lines` | debit, credit | Decimal(12,2) | Different system |
| `budgets` | jan..dec | Decimal(12,2) | OK for budgets |
| `trip_expenses` | amount | Decimal(12,2) | OK |

**Finding:** Three different monetary representations coexist: Float (Plaid/trading), BigInt cents (ledger), Decimal(12,2) (manual entries). The Float→BigInt conversion happens at `journal-entry-service.ts:73` via `BigInt(line.amount)`.

### 1C. Dual User Systems

Two separate user tables exist:
- **`users`** (custom auth): id, email, password, name, tier, stripeCustomerId
- **`User`** (NextAuth): id, email, name, emailVerified, image

Both are active. Custom `users` drives all accounting logic. NextAuth `User` handles OAuth. The `[...nextauth]/route.ts` bridges them by setting a `userEmail` cookie on successful OAuth.

### 1D. Dual Journal Systems

| System | Tables | Purpose | Affects Ledger? |
|--------|--------|---------|----------------|
| Primary | `journal_transactions` + `ledger_entries` | Real double-entry | YES — updates COA balances |
| Secondary | `journal_entries` + `journal_entry_lines` | Manual adjusting entries UI | **NO** — memo only |

**Critical:** The secondary system (`journal_entries`) does NOT create `ledger_entries` and does NOT update `chart_of_accounts.settled_balance`. Manual adjusting entries are logged but have zero financial impact.

### 1E. DB-Level Protections (from migration SQL)

```
prisma/migrations/20250930_double_entry_foundation/migration.sql:

1. CHECK (amount > 0) on ledger_entries — prevents zero/negative amounts
2. CHECK (balance_type IN ('D', 'C')) on chart_of_accounts
3. CHECK (entry_type IN ('D', 'C')) on ledger_entries
4. CHECK (entity_type IN ('personal', 'business')) on chart_of_accounts
   (LATER UPDATED to include 'trading' via prisma/add-trading-entity.sql)
5. TRIGGER prevent_ledger_modifications() — blocks UPDATE/DELETE on ledger_entries
6. TRIGGER validate_transaction_balance() — enforces D=C at DB level per insert
```

### 1F. Unique Constraints (Critical for Migration)

| Table | Unique Constraint | Implication |
|-------|------------------|-------------|
| `chart_of_accounts` | code (GLOBAL) | Same code cannot exist for two users |
| `transactions` | transactionId | One Plaid txn per row |
| `investment_transactions` | investment_transaction_id | One Plaid inv txn per row |
| `accounts` | accountId | One bank account per row |
| `plaid_items` | itemId, accessToken | One Plaid item per row |
| `merchant_coa_mappings` | [userId, merchant_name, plaid_category_primary] | Per-user merchant memory |
| `budgets` | [userId, accountCode, year] | One budget per account per year |

**chart_of_accounts.code being globally unique is a BLOCKER for multi-tenant.** Currently works because single-tenant with P-/B-/T- prefixes.

---

## 2. ROW COUNT MATRIX (SQL Queries for Manual Execution)

Run these against the production database:

```sql
-- === CORE TABLES ===
SELECT 'users' as tbl, COUNT(*) as rows FROM users
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'plaid_items', COUNT(*) FROM plaid_items
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'investment_transactions', COUNT(*) FROM investment_transactions
UNION ALL SELECT 'securities', COUNT(*) FROM securities

-- === ACCOUNTING TABLES ===
UNION ALL SELECT 'chart_of_accounts', COUNT(*) FROM chart_of_accounts
UNION ALL SELECT 'journal_transactions', COUNT(*) FROM journal_transactions
UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries
UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries
UNION ALL SELECT 'journal_entry_lines', COUNT(*) FROM journal_entry_lines
UNION ALL SELECT 'merchant_coa_mappings', COUNT(*) FROM merchant_coa_mappings
UNION ALL SELECT 'category_coa_defaults', COUNT(*) FROM category_coa_defaults

-- === TRADING TABLES ===
UNION ALL SELECT 'trading_positions', COUNT(*) FROM trading_positions
UNION ALL SELECT 'stock_lots', COUNT(*) FROM stock_lots
UNION ALL SELECT 'lot_dispositions', COUNT(*) FROM lot_dispositions
UNION ALL SELECT 'lot_adjustments', COUNT(*) FROM lot_adjustments
UNION ALL SELECT 'corporate_actions', COUNT(*) FROM corporate_actions
UNION ALL SELECT 'tax_scenarios', COUNT(*) FROM tax_scenarios
UNION ALL SELECT 'tax_overrides', COUNT(*) FROM tax_overrides

-- === RECONCILIATION ===
UNION ALL SELECT 'bank_reconciliations', COUNT(*) FROM bank_reconciliations
UNION ALL SELECT 'reconciliation_items', COUNT(*) FROM reconciliation_items
UNION ALL SELECT 'period_closes', COUNT(*) FROM period_closes
UNION ALL SELECT 'closing_periods', COUNT(*) FROM closing_periods

-- === TRADING METADATA ===
UNION ALL SELECT 'trade_journal_entries', COUNT(*) FROM trade_journal_entries
UNION ALL SELECT 'trade_cards', COUNT(*) FROM trade_cards
UNION ALL SELECT 'trade_card_links', COUNT(*) FROM trade_card_links
UNION ALL SELECT 'tastytrade_connections', COUNT(*) FROM tastytrade_connections

-- === LIFESTYLE/BUDGET ===
UNION ALL SELECT 'budgets', COUNT(*) FROM budgets
UNION ALL SELECT 'budget_line_items', COUNT(*) FROM budget_line_items
UNION ALL SELECT 'calendar_events', COUNT(*) FROM calendar_events
UNION ALL SELECT 'home_expenses', COUNT(*) FROM home_expenses
UNION ALL SELECT 'module_expenses', COUNT(*) FROM module_expenses

-- === TRAVEL ===
UNION ALL SELECT 'trips', COUNT(*) FROM trips
UNION ALL SELECT 'trip_participants', COUNT(*) FROM trip_participants
UNION ALL SELECT 'trip_expenses', COUNT(*) FROM trip_expenses
UNION ALL SELECT 'trip_itinerary', COUNT(*) FROM trip_itinerary

ORDER BY tbl;
```

```sql
-- === PER-USER COUNTS (for userId = 'cmfi3rcrl0000zcj0ajbj4za5') ===
SELECT 'chart_of_accounts' as tbl, COUNT(*) as rows
FROM chart_of_accounts WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
UNION ALL
SELECT 'merchant_coa_mappings', COUNT(*)
FROM merchant_coa_mappings WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
UNION ALL
SELECT 'accounts', COUNT(*)
FROM accounts WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
UNION ALL
SELECT 'plaid_items', COUNT(*)
FROM plaid_items WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
UNION ALL
SELECT 'stock_lots', COUNT(*)
FROM stock_lots WHERE user_id = 'cmfi3rcrl0000zcj0ajbj4za5'
UNION ALL
SELECT 'budgets', COUNT(*)
FROM budgets WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5';
```

```sql
-- === COA BREAKDOWN BY ENTITY TYPE ===
SELECT entity_type, COUNT(*) as accounts,
       SUM(CASE WHEN settled_balance != 0 THEN 1 ELSE 0 END) as with_balance
FROM chart_of_accounts
WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
GROUP BY entity_type
ORDER BY entity_type;
```

```sql
-- === TRANSACTIONS COMMITTED VS UNCOMMITTED ===
SELECT
  CASE WHEN "accountCode" IS NOT NULL THEN 'committed' ELSE 'uncommitted' END as status,
  COUNT(*) as count
FROM transactions t
JOIN accounts a ON t."accountId" = a."accountId"
WHERE a."userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
GROUP BY 1;
```

```sql
-- === INVESTMENT TRANSACTIONS COMMITTED VS UNCOMMITTED ===
SELECT
  CASE WHEN "accountCode" IS NOT NULL THEN 'committed' ELSE 'uncommitted' END as status,
  COUNT(*) as count
FROM investment_transactions it
JOIN accounts a ON it."accountId" = a."accountId"
WHERE a."userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
GROUP BY 1;
```

```sql
-- === JOURNAL ENTRY INTEGRITY CHECK ===
SELECT
  jt.id,
  jt.description,
  SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as total_credits,
  SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) -
  SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as imbalance
FROM journal_transactions jt
JOIN ledger_entries le ON le.transaction_id = jt.id
GROUP BY jt.id, jt.description
HAVING SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) !=
       SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)
ORDER BY ABS(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) -
             SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)) DESC;
```

---

## 3. BOOKKEEPING PIPELINE MAP

### 3A. Complete Data Flow

```
STAGE 1: PLAID SYNC
  File: src/app/api/transactions/sync-complete/route.ts
  ┌─────────────┐
  │  Plaid API   │
  └──────┬───────┘
         │ transactionsGet (since 2024-01-01)
         │ investmentsTransactionsGet
         ▼
  ┌──────────────────────────┐     ┌─────────────────────┐
  │  transactions (staging)   │     │ investment_transactions│
  │  review_status='pending'  │     │ (raw Plaid data)       │
  └──────────┬───────────────┘     └────────────────────────┘
             │
STAGE 2: AUTO-CATEGORIZATION
  File: src/lib/auto-categorization-service.ts
  File: src/app/api/transactions/auto-categorize/route.ts
             │
  ┌──────────▼──────────────┐
  │  Tier 1: Merchant Memory │ merchant_coa_mappings (userId-scoped)
  │  confidence > 0.5        │ Unique(userId, merchant_name, plaid_category_primary)
  └──────────┬───────────────┘
             │ if no match
  ┌──────────▼──────────────┐
  │  Tier 2: Category Map    │ Hardcoded in auto-categorization-service.ts:51-62
  │  (P- codes ONLY)         │ ALL personal entity, NO business/trading
  │  confidence = 0.6        │
  └──────────┬───────────────┘
             │
  transactions UPDATED:
    predicted_coa_code, prediction_confidence, review_status='pending_review'

STAGE 3: REVIEW QUEUE
  File: src/app/api/transactions/review-queue/route.ts
             │
  User reviews/overrides predicted_coa_code → accountCode

STAGE 4: COMMIT TO LEDGER
  File: src/app/api/transactions/commit-to-ledger/route.ts
  File: src/lib/journal-entry-service.ts
             │
  ┌──────────▼──────────────┐
  │ Bank Account Detection   │  HARDCODED:
  │ (commit-to-ledger:58-64) │    robinhood/investment → P-1200
  │                          │    wells/default → P-1010
  └──────────┬───────────────┘
             │
  ┌──────────▼──────────────────────────────────────────┐
  │  journalEntryService.convertPlaidTransaction()       │
  │  1. Determines D/C from Plaid amount sign            │
  │     positive (expense) → DR expense, CR bank         │
  │     negative (income) → DR bank, CR income           │
  │  2. Validates D == C (journal-entry-service.ts:33)   │
  │  3. Looks up COA codes for userId (line 38-46)       │
  │  4. Inside $transaction:                             │
  │     a. Creates journal_transactions row               │
  │     b. Creates ledger_entries rows (BigInt cents)     │
  │     c. Updates chart_of_accounts.settled_balance      │
  │     d. Increments chart_of_accounts.version           │
  └──────────┬──────────────────────────────────────────┘
             │
  Merchant Feedback Loop (commit-to-ledger:80-158):
    - Correct prediction → confidence += 0.1 (cap 0.99)
    - Wrong prediction → confidence -= 0.2 (delete if < 0.3)
    - New mapping → confidence = 0.6

STAGE 5: FINANCIAL STATEMENTS
  File: src/app/api/statements/route.ts
             │
  chart_of_accounts aggregated by account_type:
    Income Statement: revenue - expenses = netIncome
    Balance Sheet: assets = liabilities + equity
    WARNING: NO date filtering — shows ALL-TIME totals

STAGE 6: UNCOMMIT (REVERSAL)
  File: src/app/api/transactions/uncommit/route.ts
             │
  Creates reversing journal_transactions:
    is_reversal = true
    reverses_journal_id = original.id
    Opposite D/C entries → balance restored
    Original marked: reversed_by_transaction_id
```

### 3B. FK Relationship Chain

```
transactions.accountId → accounts.accountId
accounts.plaidItemId → plaid_items.id
accounts.userId → users.id
plaid_items.userId → users.id

journal_transactions.plaid_transaction_id ← (soft link) → transactions.transactionId
journal_transactions.external_transaction_id ← (soft link) → investment_transactions.id

ledger_entries.transaction_id → journal_transactions.id (ON DELETE RESTRICT)
ledger_entries.account_id → chart_of_accounts.id (ON DELETE RESTRICT)

chart_of_accounts.userId → users.id
merchant_coa_mappings.userId → users.id

journal_transactions.reversed_by_transaction_id → journal_transactions.id (self-ref)
```

### 3C. Merchant Memory System

| Field | Type | Purpose |
|-------|------|---------|
| userId | TEXT NOT NULL | User isolation (added via migration 20260221) |
| merchant_name | VARCHAR(255) | Case-insensitive lookup |
| plaid_category_primary | VARCHAR(100) | Plaid category (nullable) |
| coa_code | VARCHAR(50) | Predicted account code |
| confidence_score | Decimal(3,2) | 0.00-0.99 confidence |
| usage_count | Int | Times used successfully |

**Confidence thresholds:** >0.5 to use, <0.3 to delete, cap at 0.99

### 3D. Hardcoded Category → COA Map (auto-categorization-service.ts:51-62)

```
FOOD_AND_DRINK     → P-6100
TRANSPORTATION     → P-6400
RENT_AND_UTILITIES → P-8100
GENERAL_MERCHANDISE→ P-8900
GENERAL_SERVICES   → P-8900
ENTERTAINMENT      → P-8170
PERSONAL_CARE      → P-8150
BANK_FEES          → P-6300  ← CODE MAY NOT EXIST IN COA
MEDICAL            → P-8130
TRAVEL             → P-6200  ← CODE MAY NOT EXIST IN COA
```

**Missing from map:** INCOME, LOAN_PAYMENTS, TRANSFER_IN, TRANSFER_OUT

---

## 4. TRADING PIPELINE DEPENDENCIES

### 4A. Complete Trading Flow

```
SYNC PHASE (External)
  Plaid investmentsTransactionsGet → investment_transactions (raw)
  Securities stored in securities table (option contracts, stocks)

MAPPING PHASE (User/Manual)
  POST /api/robinhood/append-history → Robinhood text export parsed
  robinhood-parser.ts matches RH fills to investment_transactions by:
    - symbol + quantity + price + date matching
    - Assigns trade numbers (sequential)
    - Assigns strategy names
    - Assigns COA codes (T-1200, T-1210, T-2100, T-4100)

COMMITMENT PHASE (Bookkeeping Boundary)
  POST /api/investment-transactions/commit-to-ledger
  ┌─────────────────────────────────────────────────┐
  │  positionTrackerService.commitOptionsTrade()      │
  │                                                   │
  │  Phase 1: OPEN legs                               │
  │    → Creates trading_positions (status=OPEN)       │
  │    → Creates journal_transactions + ledger_entries │
  │    → Updates chart_of_accounts balances            │
  │    → Buy call: DR T-1200, CR T-1010               │
  │    → Sell call: DR T-1010, CR T-2100              │
  │                                                   │
  │  Phase 2: CLOSE legs                              │
  │    → Matches to open position (symbol+strike+type) │
  │    → Calculates realized P/L                       │
  │    → Creates journal + ledger entries              │
  │    → Gain: CR T-4100 / Loss: DR T-5100           │
  │    → Updates trading_positions (status=CLOSED)     │
  │                                                   │
  │  For STOCKS:                                      │
  │    → Creates stock_lots (cost basis tracking)      │
  │    → Sale creates lot_dispositions                 │
  │    → Supports FIFO/LIFO/HIFO/LOFO/SPECIFIC ID    │
  └─────────────────────────────────────────────────┘

WASH SALE PHASE (Optional)
  POST /api/tax/wash-sales
  wash-sale-service.ts detects violations:
    - 30-day window (before + after)
    - Stock↔stock, stock↔option, option↔stock, option↔option
    - Updates lot_dispositions.is_wash_sale, wash_sale_loss
    - Adjusts stock_lots.wash_sale_adjustment, cost_per_share

TAX REPORTING PHASE
  GET /api/tax/report?year=2025
  tax-report-service.ts generates:
    - Form 8949 entries from lot_dispositions + trading_positions
    - Schedule D (aggregated by ST/LT, Box A/B/C)
    - Holding period: >= 365 days = long-term
    - TurboTax CSV export format
```

### 4B. Trading Account Codes (All Hardcoded)

| Code | Name | Type | balance_type | Used By |
|------|------|------|-------------|---------|
| T-1010 | Trading Cash | asset | D | position-tracker, investment-ledger |
| T-1100 | Stock Holdings | asset | D | position-tracker (stocks) |
| T-1200 | Long Call Positions | asset | D | position-tracker, robinhood-parser |
| T-1210 | Long Put Positions | asset | D | position-tracker, robinhood-parser |
| T-2100 | Short Call Positions | liability | C | position-tracker, robinhood-parser |
| T-2110 | Short Put Positions | liability | C | position-tracker |
| T-3200 | Contributions | equity | C | trading/route.ts |
| T-3300 | Withdrawals | equity | D | trading/route.ts |
| T-4100 | Trading Gains | revenue | C | position-tracker, tax-report |
| T-4140 | Options Gains | revenue | C | investment-ledger-service |
| T-5100 | Trading Losses | expense | D | position-tracker, tax-report |
| T-5140 | Options Losses | expense | D | investment-ledger-service |

### 4C. Trading → Bookkeeping Dependencies

**Tables SHARED between trading and bookkeeping:**
- `journal_transactions` — Trading commits create journal entries here
- `ledger_entries` — Trading commits create ledger entries here
- `chart_of_accounts` — Trading commits update balances here (T- accounts)

**Tables EXCLUSIVE to trading:**
- `trading_positions` — Open/close position tracking (operational)
- `stock_lots` — Cost basis lot tracking (operational)
- `lot_dispositions` — Disposal records (operational + tax)
- `lot_adjustments` — Corporate action adjustments
- `corporate_actions` — Stock splits, etc.
- `tax_scenarios` — Multi-method scenario comparison

**If you nuke the bookkeeping tables, trading journal entries are DESTROYED.**
**If you nuke trading tables, journal entries remain but orphaned trading_positions are lost.**

### 4D. Two Duplicate Services

Both `investment-ledger-service.ts` and `position-tracker-service.ts` do similar things:
- Both create journal entries for options trades
- Both update COA balances
- Both track positions
- Different account codes for gains: T-4140 vs T-4100

The commit-to-ledger route uses `positionTrackerService` (the newer one).

---

## 5. API ROUTE SECURITY MATRIX

### 5A. Route Count by Domain

| Domain | Routes | Auth Required | Tier Gated |
|--------|--------|--------------|------------|
| Auth | 6 | 1 (me) | 0 |
| Accounting | 20+ | ALL | 0 |
| Transactions | 11 | ALL | 0 |
| Investment Transactions | 8 | ALL | 0 |
| Trading | 10+ | ALL | 0 |
| Tax | 4 | ALL | 0 |
| Plaid/Banking | 4 | ALL | 3 (plaid tier) |
| AI Features | 7 | ALL | ALL (ai tier) |
| Tastytrade | 13 | ALL | 0 |
| Trip Planning | 15+ | ALL | 0 |
| Travel Booking | 4 | ALL | 0 |
| Admin | 5 | ALL | 0 |
| Stripe | 3 | 1 (webhook=signature) | 0 |
| Cron | 1 | Bearer token | 0 |
| Module Expenses | 9 | ALL | 0 |
| Hub/Stats | 6 | ALL | 0 |
| **TOTAL** | **~130** | **~125** | **10** |

### 5B. Auth Pattern

Every protected route follows:
```typescript
const userEmail = await getVerifiedEmail();
if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
```

### 5C. Ownership Verification (Present)

| Route | Ownership Check | Method |
|-------|----------------|--------|
| transactions/commit-to-ledger | accounts.userId = user.id | Prisma relation filter |
| transactions/uncommit | accounts.userId = user.id | Prisma relation filter |
| accounts/update-entity | accounts.userId + accounts.id | findFirst before update |
| investment-transactions/uncommit | accounts.userId = user.id | Prisma relation filter |
| stock-lots/commit | accounts.userId = user.id | Prisma relation filter |
| chart-of-accounts | chart_of_accounts.userId | WHERE clause |
| merchant-mappings | merchant_coa_mappings.userId | WHERE clause |

### 5D. Security Gaps

| Route | Issue | Severity |
|-------|-------|----------|
| `/api/admin/*` (all 5) | Any authenticated user can call — no admin role check | CRITICAL |
| `/api/admin/verify` | Plain text password comparison (`===`) | CRITICAL |
| All auth endpoints | No rate limiting | HIGH |
| `/api/cron/*` | No rate limiting on CRON_SECRET attempts | MEDIUM |
| Module expense routes | Raw SQL with user_id parameter (lower assurance) | LOW |

### 5E. External API Integrations

| API | Routes | Auth | Data Flow |
|-----|--------|------|-----------|
| Plaid | 4 + sync-complete | Bearer (access_token in DB) | Transactions, investments, securities |
| Tastytrade | 13 routes | OAuth (server-side refresh) | Options chains, Greeks, quotes, scanner |
| Anthropic | 3 routes | API key | Market brief, convergence, strategy |
| OpenAI | 3 routes | API key | Meal plan, spending insights, cart |
| X AI (Grok) | 1 route | API key | Trip AI assistant |
| Stripe | 3 routes | Webhook signature | Subscription billing |
| Finnhub | 1 route | API key | Ticker context, news, fundamentals |
| Amadeus | 3 routes | API key | Flights, hotels, transfers |
| Duffel | 1 route | API key | Flight search/booking |
| Google Places | 1 route | API key | Destination photos |

---

## 6. AUTH & SECURITY AUDIT

### 6A. Authentication Architecture

```
           ┌──────────────┐
           │  getVerifiedEmail()  │
           └────────┬─────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   HMAC Cookie    NextAuth    JWT Token
   (Primary)     (OAuth)     (Legacy)
```

**Cookie Auth** (`src/lib/cookie-auth.ts`):
- HMAC-SHA256 signature using JWT_SECRET
- Timing-safe comparison (`crypto.timingSafeEqual`)
- Format: `email.hmacHexDigest`
- HttpOnly, SameSite=Lax/Strict, Secure (prod)
- 7-day expiry (email/password), 30-day (OAuth)

**Middleware** (`src/middleware.ts`):
- Dual check: userEmail cookie OR NextAuth session token
- HMAC verification in edge runtime (Web Crypto API)
- Public paths: `/`, `/api/auth/*`, `/pricing`, `/terms`, `/privacy`, `/api/stripe/webhook`

### 6B. Tier-Based Access Control

```
FREE:    Manual entry only, 0 linked accounts
PRO:     Plaid sync, trading analytics, 10 linked accounts
PRO+:    All PRO + AI features, trip AI, 25 linked accounts
```

Enforced via `requireTier(user.tier, feature)` in `src/lib/tiers.ts`.

### 6C. Critical Security Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | Admin routes accessible to ANY authenticated user | `/api/admin/*` | CRITICAL |
| 2 | Admin password plain text comparison | `/api/admin/verify/route.ts` | CRITICAL |
| 3 | Dev mode auth bypass (`'default-dev-user'`) | `src/lib/auth.ts` | CRITICAL (if NODE_ENV wrong) |
| 4 | No rate limiting anywhere | All auth routes | HIGH |
| 5 | `Math.random()` for ID generation | Multiple auth routes | MEDIUM |
| 6 | Plaid access tokens stored as plaintext | `plaid_items.accessToken` | MEDIUM |
| 7 | CSP has `unsafe-inline` + `unsafe-eval` | `next.config.ts` | MEDIUM |

### 6D. What's Working Well

- HMAC cookie signing with timing-safe comparison
- Consistent `getVerifiedEmail()` pattern across 95%+ routes
- User data isolation on all accounting queries
- Stripe webhook signature validation
- bcrypt-12 password hashing
- Cron secret bearer token validation

---

## 7. EXISTING FEATURE INVENTORY

### 7A. Core Accounting

| Feature | Status | Key Files |
|---------|--------|-----------|
| Double-entry journal engine | Working | `src/lib/journal-entry-service.ts` |
| Chart of Accounts (P-/B-/T- prefixed) | Working | `src/lib/seedDefaultCOA.ts`, COA routes |
| Plaid bank sync (transactions) | Working | `src/app/api/transactions/sync-complete/route.ts` |
| Plaid investment sync | Working | Same file |
| Auto-categorization (merchant memory) | Working | `src/lib/auto-categorization-service.ts` |
| Transaction review queue | Working | `src/app/api/transactions/review-queue/route.ts` |
| Commit to ledger | Working | `src/app/api/transactions/commit-to-ledger/route.ts` |
| Uncommit (reversal) | Working | `src/app/api/transactions/uncommit/route.ts` |
| Financial statements | Working (no date filter) | `src/app/api/statements/route.ts` |
| Bank reconciliation | Partial | `src/app/api/bank-reconciliations/route.ts` |
| Period close | Status-only (no auto closing entries) | `src/app/api/period-closes/route.ts` |
| Manual journal entries | Memo-only (no ledger impact) | `src/app/api/journal-entries/route.ts` |

### 7B. Trading & Investments

| Feature | Status | Key Files |
|---------|--------|-----------|
| Options position tracking | Working | `src/lib/position-tracker-service.ts` |
| Stock lot tracking (FIFO/LIFO/HIFO/LOFO/SpecID) | Working | `src/app/api/stock-lots/commit/route.ts` |
| Robinhood history import | Working (year 2025 hardcoded) | `src/lib/robinhood-parser.ts` |
| Wash sale detection (IRS Pub 550) | Working | `src/lib/wash-sale-service.ts` |
| Corporate actions (stock splits) | Working | `src/app/api/corporate-actions/route.ts` |
| Tastytrade integration (OAuth) | Working | `src/app/api/tastytrade/` |
| Convergence intelligence (options scanner) | Working | `src/lib/convergence/` (16 sub-modules) |
| Trade cards | Working | `src/app/api/trade-cards/route.ts` |
| Trading journal | Working | `src/app/api/trading-journal/route.ts` |
| Investment uncommit (reversal) | Working | `src/app/api/investment-transactions/uncommit/route.ts` |

### 7C. Tax Reporting

| Feature | Status | Key Files |
|---------|--------|-----------|
| Form 8949 (capital gains) | Working | `src/lib/tax-report-service.ts` |
| Schedule D (summary) | Working | Same file |
| Schedule C (self-employment) | Working (B- accounts) | `src/lib/schedule-c-service.ts` |
| Schedule SE (self-employment tax) | Working | Same file |
| Form 1040 (estimator) | Working (bugs: LTCG rates) | `src/lib/form-1040-service.ts` |
| TurboTax CSV export | Working | `src/lib/tax-report-service.ts` |
| Tax overrides (manual W-2, 1099-R) | Working | `src/app/api/tax/overrides/route.ts` |
| CPA export (trial balance CSV) | Working | `CPAExport.tsx` component |

### 7D. AI Features

| Feature | Model Used | Key Files |
|---------|-----------|-----------|
| Market brief | Claude Sonnet | `src/app/api/ai/market-brief/route.ts` |
| Convergence synthesis | Claude + pipeline | `src/app/api/ai/convergence-synthesis/route.ts` |
| Strategy analysis | Claude | `src/app/api/ai/strategy-analysis/route.ts` |
| Spending insights | GPT-4.1-nano | `src/app/api/ai/spending-insights/route.ts` |
| Meal planner | GPT-4o / GPT-4.1-nano | `src/app/api/ai/meal-plan/route.ts` |
| Cart planner | GPT-4o | `src/app/api/ai/cart-plan/route.ts` |
| Trip AI assistant | Grok | `src/app/api/trips/[id]/ai-assistant/route.ts` |

### 7E. Travel & Lifestyle (Non-Accounting)

| Feature | Tables Used |
|---------|-------------|
| Trip planning with multi-participant | trips, trip_participants, trip_expenses |
| Flight/hotel/transfer search & booking | Amadeus, Duffel APIs |
| Destination database (13 activity types) | ikon_resorts, surf_spots, golf_courses, etc. |
| Expense splitting | expense_splits |
| Module expenses (auto, home, business, personal, shopping, health, growth) | module_expenses, home_expenses |
| Calendar/agenda system | calendar_events |
| Budget builder (monthly by COA) | budgets, budget_line_items |
| Stripe subscription billing | users.tier, stripe webhooks |

### 7F. Key Dependencies

```json
// From package.json
"next": "15.5.9",
"@prisma/client": "^6.15.0",
"plaid": "^11.0.0",
"@tastytrade/api": "^6.0.1",
"@anthropic-ai/sdk": "^0.74.0",
"openai": "^6.7.0",
"stripe": "^20.3.0",
"next-auth": "^4.24.13",
"bcryptjs": "^2.4.3",
"recharts": "^3.7.0",
"leaflet": "^1.9.4"
```

---

## 8. TARGET ARCHITECTURE COMPARISON

### 8A. Target Tables vs Current

| Target Table | Current Equivalent | Gap |
|-------------|-------------------|-----|
| `entities` | accounts.entityType (string field) | NO dedicated entity table; entity is a STRING on accounts + COA |
| `entity_versions` | NONE | NO audit trail for entity changes |
| `entity_members` | NONE | NO multi-member entity support |
| `coa_templates` | seedDefaultCOA.ts (hardcoded) | Template is CODE, not data. No per-entity templates |
| `coa_template_accounts` | NONE | Templates are not data-driven |
| `chart_of_accounts` | chart_of_accounts | EXISTS but code is globally unique (not per-entity) |
| `account_tax_mappings` | Hardcoded in schedule-c-service.ts | NO data table; name-pattern matching in code |
| `journal_entries` | journal_transactions | EXISTS but named differently + metadata fields differ |
| `journal_lines` | ledger_entries | EXISTS but named differently |
| `tax_forms` | NONE | Tax form generation is code-only, no persisted forms |
| `bank_accounts` | accounts | EXISTS but Plaid-coupled (id = Plaid accountId) |
| `bank_account_entity_links` | accounts.entityType (string) | NO M:M link; one account → one entity |
| `transactions` | transactions | EXISTS |

### 8B. Fundamental Architecture Gaps

1. **No Entity Model:** Entities (personal, business, trading) are string tags on accounts and COA, not first-class objects. No entity_id FK anywhere.

2. **No Entity Versioning:** No audit trail when entity type changes (e.g., account reclassified from personal to business).

3. **No COA Templates as Data:** Default COA is a TypeScript function (seedDefaultCOA.ts), not a database-driven template system. You can't create different COA templates for different entity types without code changes.

4. **No Tax Form Persistence:** Tax reports are generated on-the-fly from ledger data. There's no way to "snapshot" a tax form, review it, amend it, or compare versions.

5. **No Bank Account ↔ Entity M:M:** One bank account can only belong to one entity. A checking account used for both personal and business transactions requires duplicate plaid connections or manual splitting.

6. **COA Code Global Uniqueness:** `chart_of_accounts.code` is `@unique` globally. In multi-tenant, user A's "P-1010" would conflict with user B's "P-1010". Currently works only because single-tenant.

7. **No Account Tax Mappings Table:** Schedule C line mappings are hardcoded name patterns in `schedule-c-service.ts:58-74`. Adding a new expense category requires a code change.

---

## 9. NUKE IMPACT ASSESSMENT

### 9A. If You Drop Accounting Tables

**Tables to drop:** `chart_of_accounts`, `journal_transactions`, `ledger_entries`, `journal_entries`, `journal_entry_lines`, `merchant_coa_mappings`, `category_coa_defaults`, `bank_reconciliations`, `reconciliation_items`, `period_closes`, `closing_periods`

**Cascading impact:**
- ALL financial statements become empty
- ALL committed transaction links break (journal_transactions.plaid_transaction_id orphaned)
- ALL COA balances lost — NO way to recalculate without ledger_entries
- Trading journal entries for options P/L are DESTROYED (they live in journal_transactions)
- Tax reports (Form 8949, Schedule D) still work IF lot_dispositions + trading_positions survive
- Schedule C dies (depends on B- COA accounts)
- Form 1040 dies (depends on COA data)
- Merchant memory lost — auto-categorization starts from scratch
- Reconciliation history lost

**What SURVIVES:**
- Raw Plaid transactions in `transactions` table (uncommitted state)
- Raw investment transactions in `investment_transactions` table
- Stock lots and lot dispositions (independent of COA)
- Trading positions (independent of COA)
- Securities master data
- User accounts and Plaid connections
- All travel/lifestyle data

### 9B. If You Drop Trading Tables

**Tables to drop:** `trading_positions`, `stock_lots`, `lot_dispositions`, `lot_adjustments`, `corporate_actions`, `tax_scenarios`, `trade_journal_entries`, `trade_cards`, `trade_card_links`

**Cascading impact:**
- Form 8949 breaks (depends on lot_dispositions + trading_positions)
- Schedule D breaks (depends on Form 8949)
- Form 1040 line 7 (capital gains) breaks
- Wash sale detection impossible
- Position matching for options trades impossible
- Cost basis tracking lost
- Tax scenario analysis impossible

**What SURVIVES:**
- Journal entries for already-committed trades remain in journal_transactions/ledger_entries
- COA balances remain correct (trading P/L already recorded)
- Plaid investment_transactions remain (raw data)
- Securities remain
- Schedule C/SE unaffected (B- accounts)
- Regular banking pipeline unaffected

### 9C. Safe Nuke Order (If Rebuilding)

1. **SAFE TO DROP:** All destination tables (13), places_cache, RFP, prospects — zero accounting impact
2. **SAFE TO DROP:** Trip tables (trips, participants, expenses, itinerary, destinations) — zero accounting impact
3. **SAFE TO DROP:** Lifestyle (calendar_events, home_expenses, module_expenses, budgets, budget_line_items) — zero accounting impact
4. **SAFE TO DROP:** NextAuth tables (Account, Session, User, VerificationToken) — IF custom auth is retained
5. **CAREFUL:** journal_entries, journal_entry_lines — currently memo-only, safe IF no important adjusting entries exist
6. **CAREFUL:** bank_reconciliations, reconciliation_items, period_closes, closing_periods — audit trail data
7. **DANGEROUS:** merchant_coa_mappings — learning data, expensive to rebuild
8. **DANGEROUS:** trading tables — tax reporting breaks
9. **CRITICAL:** journal_transactions, ledger_entries — ALL financial history destroyed
10. **CRITICAL:** chart_of_accounts — ALL account balances destroyed

---

## 10. MIGRATION SURFACE

### 10A. Migration History (Chronological)

| # | Migration | Date | Purpose |
|---|-----------|------|---------|
| 1 | 20250905050518_add_users | 2025-09-05 | Initial users table |
| 2 | 20250905053340_add_plaid_models | 2025-09-05 | plaid_items + accounts + transactions |
| 3 | 20250930_double_entry_foundation | 2025-09-30 | COA + journal_transactions + ledger_entries + triggers |
| 4 | 20251001010100_merchant_mapping | 2025-10-01 | merchant_coa_mappings + category_coa_defaults |
| 5 | 20251002001200_add_investment_columns | 2025-10-02 | strategy + tradeNum on investment_transactions |
| 6 | 20251024152838_add_auto_categorization | 2025-10-24 | Auto-categorization fields on transactions |
| 7 | 20251026230000_create_investment_tables | 2025-10-26 | securities + investment_transactions tables |
| 8 | 20260124_multi_activities | 2026-01-24 | Multi-activity trips (empty file) |
| 9 | 20260221_add_reversal_fields | 2026-02-21 | is_reversal, reverses_journal_id, reversal_date |
| 10 | 20260221_merchant_mappings_user_isolation | 2026-02-21 | userId on merchant_coa_mappings |
| 11 | add_robinhood_reconciliation | undated | rh_* columns on investment_transactions |

### 10B. Out-of-Band SQL Files (NOT in migrations/)

| File | Purpose | Applied? |
|------|---------|---------|
| `prisma/add-journal-metadata.sql` | account_code, amount, strategy, trade_num on journal_transactions | Likely yes |
| `prisma/add-trading-entity.sql` | Adds 'trading' to entity_type CHECK constraint | Likely yes |
| `prisma/add_plaid_rich_data.sql` | 15+ rich Plaid columns on transactions | Likely yes |
| `prisma/migrations/add_missing_columns.sql` | needs_update on plaid_items, rfps table | Likely yes |
| `add_securities.sql` | DROP + recreate securities table | Superseded |
| `fix-irs-coa.sh` | sed replacement for assignCOA in robinhood-parser.ts | Code change, not DB |
| `tag-accounts.js` | Tags investment→trading, checking→personal | Data change |

### 10C. Tables Created Outside Prisma Migrations

The schema has 60 models but only 11 migrations. Many tables were created via:
- `prisma db push` (schema sync without migration)
- Raw SQL scripts
- Manual DDL

**This means `prisma migrate deploy` may NOT reproduce the full schema.** The `prisma/schema.prisma` file is the source of truth, not the migration history.

---

## 11. RISKS AND UNKNOWNS

### 11A. Known Bugs (from Previous Audits)

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| 1 | LTCG taxed at ordinary rates | `form-1040-service.ts:255` | Overestimates tax liability |
| 2 | Business meals at 100% not 50% | `schedule-c-service.ts` line 24b | Underestimates tax liability |
| 3 | Hardcoded bank mapping (wells→P-1010, robinhood→P-1200) | `commit-to-ledger/route.ts:58-64` | Wrong bank account for non-Wells/RH banks |
| 4 | Year 2025 hardcoded | `robinhood-parser.ts:368,607` | Breaks for 2026 trades |
| 5 | Financial statements have NO date filtering | `statements/route.ts` | Shows all-time, not period |
| 6 | Manual journal entries don't affect ledger | `journal_entries` system | Adjusting entries are memo-only |
| 7 | INCOME not in auto-categorization category map | `auto-categorization-service.ts:51-62` | Income transactions get no prediction |
| 8 | Stock lot rounding (independent Math.round) | `stock-lots/commit/route.ts:196-200` | Can create 1-cent imbalances |
| 9 | Two duplicate services for options P/L | investment-ledger vs position-tracker | Different account codes (T-4140 vs T-4100) |
| 10 | Missing COA codes P-6300, P-6200 | auto-categorization-service.ts | Will fail on BANK_FEES, TRAVEL categories |

### 11B. Schema Risks for Rebuild

1. **Global COA code uniqueness** — Must be changed to per-entity or per-user unique before multi-tenant
2. **No entity_id FK** — Entity is a string tag, not a proper FK relationship
3. **Float for money** — transactions.amount, investment_transactions.amount are Float, not BigInt/Decimal
4. **Two journal systems** — Must decide: merge, keep both, or drop one
5. **journal_transactions has no userId** — Must trace through ledger_entries → chart_of_accounts to find owner
6. **ledger_entries has DB trigger blocking UPDATE/DELETE** — Must DROP trigger before any data migration on that table
7. **trading_positions has no userId** — Must trace through investment_transactions → accounts to find owner
8. **Prisma schema ≠ migration history** — Many tables created via `db push`, not tracked migrations

### 11C. Data Preservation Requirements

| Data | Can Regenerate? | Priority |
|------|----------------|----------|
| ledger_entries + journal_transactions | NO — append-only history | MUST PRESERVE |
| chart_of_accounts balances | YES — recalculate from ledger_entries | Can rebuild |
| merchant_coa_mappings | NO — learned from user behavior over months | SHOULD PRESERVE |
| stock_lots + lot_dispositions | NO — tax-critical cost basis history | MUST PRESERVE |
| trading_positions | NO — P/L history | MUST PRESERVE |
| transactions (raw Plaid) | YES — re-sync from Plaid | Can rebuild |
| investment_transactions (raw Plaid) | YES — re-sync from Plaid | Can rebuild |
| securities | YES — re-sync from Plaid | Can rebuild |
| tax_overrides | NO — manually entered W-2/1099-R data | MUST PRESERVE |

### 11D. Unknown State (Requires DB Verification)

1. **How many unbalanced journal entries exist?** (Run integrity check query in Section 2)
2. **How many orphaned COA accounts still exist?** (userId = NULL)
3. **How many transactions are committed vs uncommitted?**
4. **Are there journal_entries with status='posted' that should affect the ledger but don't?**
5. **Are there investment_transactions with accountCode set but no corresponding trading_positions?**
6. **What's the actual COA account list beyond the seed defaults?**

---

## RECON COMPLETE

**Summary:** 60 Prisma models, ~130 API routes, 30+ services, 16 convergence sub-modules. The bookkeeping core (journal_transactions + ledger_entries + chart_of_accounts) is architecturally sound with DB-level protections. The main rebuild targets are:

1. **Entity model** — Promote from string tag to first-class entity with proper FK
2. **COA uniqueness** — Change from global to per-entity unique
3. **Tax form persistence** — Add tables to snapshot generated forms
4. **Bank ↔ Entity M:M** — Allow accounts to serve multiple entities
5. **COA templates as data** — Move from hardcoded seed to configurable templates
6. **Merge or kill dual journal systems** — One journal to rule them all
7. **Fix monetary types** — Standardize on BigInt cents or Decimal everywhere
