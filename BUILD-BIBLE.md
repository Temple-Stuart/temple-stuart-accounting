# TEMPLE STUART BOOKKEEPING REBUILD — BUILD BIBLE

**Version:** 1.0
**Date:** 2026-02-25
**Status:** DEFINITIVE — All decisions locked. No open questions.
**Author:** Alex Stuart + Claude (Chat)

---

## PURPOSE

This is the single source of truth for the bookkeeping rebuild. Every schema field, every migration step, every Claude Code prompt is defined here. No other document supersedes this one.

**Goal:** Clean, investor-auditable ledger. Zero reversals. Every journal entry traceable to exactly one source transaction. An auditor opens the books and sees perfection.

---

## TABLE OF CONTENTS

1. [Current State Diagnosis](#1-current-state-diagnosis)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Schema Specification](#3-schema-specification)
4. [Data Preservation Matrix](#4-data-preservation-matrix)
5. [Migration Plan](#5-migration-plan)
6. [Rebuild Pipeline](#6-rebuild-pipeline)
7. [Tax Compliance Reference](#7-tax-compliance-reference)
8. [Claude Code Prompt Sequence](#8-claude-code-prompt-sequence)

---

## 1. CURRENT STATE DIAGNOSIS

### 1A. What's Broken

| Problem | Evidence | Impact |
|---------|----------|--------|
| **Duplicate journal entries** | 361 banking + 379 investment txns have 2+ journal entries each | ~1,358 phantom entries inflating all balances |
| **Zero reversals** | `is_reversal = true` count: **0** across 5,696 entries | Uncommit/recommit created duplicates, not reversals |
| **Accounting equation gap** | Assets - Liabilities - Equity - Revenue + Expenses = **-$25,899.56** | Books are mathematically wrong |
| **Inflated revenue** | Ledger shows $293,807 vs actual ~$172,640 | $121,167 phantom revenue from duplicates |
| **17 NULL entity_type accounts** | P-prefix accounts without entity classification | P-4000 (Wages $93,155) invisible to entity-filtered queries |
| **Broken FK chain** | 4,183 transactions have accountId but 0 join to accounts table | Committed/uncommitted status unqueryable via JOIN |
| **Global COA code uniqueness** | `chart_of_accounts.code` is `@unique` globally | Blocks multi-tenant (User A P-1010 collides with User B P-1010) |
| **Two duplicate trading services** | `investment-ledger-service` (T-4140/T-5140) vs `position-tracker-service` (T-4100/T-5100) | Same concept, different codes |
| **Float for money** | transactions.amount, investment_transactions.amount use Float | Floating point errors in financial calculations |
| **Dead memo journal system** | `journal_entries` + `journal_entry_lines`: 0 rows total | Entire system unused, zero ledger impact |

### 1B. Production Row Counts (2026-02-25)

| Table | Rows | Owner | Fate |
|-------|------|-------|------|
| users | 102 | All | KEEP |
| accounts | 7 (6 Alex, 1 other) | Mixed | KEEP |
| plaid_items | 3 | Alex | KEEP |
| transactions | 4,183 | Alex | KEEP (reset accountCode to NULL) |
| investment_transactions | 824 | Alex | KEEP (reset accountCode to NULL) |
| securities | 296 | Global | KEEP |
| chart_of_accounts | 164 | Alex | **NUKE** (rebuild from templates) |
| journal_transactions | 5,696 | Alex | **NUKE** (all corrupted by duplicates) |
| ledger_entries | 11,690 | Alex | **NUKE** (all corrupted) |
| journal_entries | 0 | — | **DROP TABLE** |
| journal_entry_lines | 0 | — | **DROP TABLE** |
| merchant_coa_mappings | 715 | Alex | **KEEP** (remap codes during rebuild) |
| category_coa_defaults | 12 | Global | **NUKE** (rebuild from templates) |
| trading_positions | 262 | Alex | KEEP |
| stock_lots | 169 | Alex | KEEP |
| lot_dispositions | 180 | Alex | KEEP |
| lot_adjustments | ? | Alex | KEEP |
| corporate_actions | ? | Alex | KEEP |
| tax_overrides | 0 | — | KEEP (structure) |
| tax_scenarios | ? | Alex | KEEP |
| budgets | 48 (41 Alex) | Mixed | KEEP (but codes need remapping) |
| budget_line_items | ? | Alex | KEEP (codes need remapping) |
| trade_cards | 3 | Alex | KEEP |
| trade_journal_entries | ? | Alex | KEEP |
| tastytrade_connections | 2 | Alex | KEEP |
| bank_reconciliations | ? | Alex | **NUKE** (audit trail of broken data) |
| reconciliation_items | ? | Alex | **NUKE** |
| period_closes | ? | Alex | **NUKE** |
| closing_periods | ? | Alex | **NUKE** |

### 1C. COA Balance Snapshot (Pre-Nuke)

| Entity Type | Accounts | With Balance | Total Abs Balance |
|-------------|----------|-------------|-------------------|
| business | 34 | 3 | $4,516.34 |
| personal | 60 | 26 | $530,542.90 |
| trading | 53 | 10 | $110,052.00 |
| NULL | 17 | 6 | $94,671.92 |

### 1D. Accounting Equation (Pre-Nuke, Broken)

| Component | Cents |
|-----------|-------|
| Assets | 15,137,650 |
| Liabilities | 3,603,194 |
| Equity | 3,532,524 |
| Revenue | 29,380,741 |
| Expenses | 18,788,853 |
| **Gap** | **-2,589,956 ($25,899.56)** |

---

## 2. ARCHITECTURE DECISIONS

All decisions are final. No reopening.

### 2A. Core Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **BigInt cents for ALL monetary fields** | Eliminates floating point errors. 1 dollar = 100 cents stored as BigInt. Conversion happens at display layer only. |
| 2 | **Total wipe of journal/ledger/COA** | 100% of entries are corrupted by duplicates. Zero reversals exist. Surgical cleanup is more complex and less reliable than clean rebuild. |
| 3 | **Entity as first-class table with versioning** | Entities (Personal, Business, Trading) become proper database objects with FK relationships. Supports future: multiple businesses, SMLLC→S-Corp conversions, partnerships. |
| 4 | **COA uniqueness: compound [userId, entityId, code]** | Replaces global uniqueness. Each entity gets its own code namespace. Multi-tenant safe. |
| 5 | **COA templates as database data** | Replaces hardcoded `seedDefaultCOA.ts`. Templates stored in `coa_templates` + `coa_template_accounts`. New entity → instantiate from template. |
| 6 | **One journal system** | Kill `journal_entries` + `journal_entry_lines` (0 rows, dead). Single journal: `journal_entries` (new) + `ledger_entries` (new). Manual adjusting entries go through the SAME pipeline as automated commits. |
| 7 | **Immutable append-only ledger** | Entries never updated or deleted. Corrections via reversing entries only. DB trigger enforces immutability. |
| 8 | **Kill investment-ledger-service** | `position-tracker-service` wins. T-4100/T-5100 for trading gains/losses. T-4140/T-5140 retired. |
| 9 | **Merchant memory preserved + remapped** | 715 learned mappings survive. Old codes (P-6100) mapped to new codes during rebuild. |
| 10 | **Six-state transaction lifecycle** | Imported → Pending Review → Categorized → Approved → Committed → Voided. No direct uncommit-and-recommit cycles. |
| 11 | **Proper reversals from day 1** | Every reversal creates a new journal entry with `is_reversal=true`, `reverses_entry_id` pointing to original. Original gets `reversed_by_entry_id`. Both entries are permanent. |
| 12 | **AI handles translation, not calculation** | AI explains entries in plain English. All financial math is deterministic code. No AI in the accounting pipeline. |
| 13 | **Row-Level Security (RLS) on all tenant tables** | PostgreSQL policies enforce user isolation at DB level. Application code is defense-in-depth, not sole protection. |

### 2B. What We Are NOT Building (Phase 1)

- Multi-member entities (partnerships, S-Corp payroll)
- Entity version transitions (SMLLC → S-Corp conversion)
- Tax form persistence / snapshot system
- Bank account ↔ Entity many-to-many links
- Cross-account wash sale detection
- Year-end closing automation
- CPA export pack
- State tax calculations (CA Schedule CA)
- QBI deduction calculator

These are Phase 2+. Phase 1 is: clean data, clean schema, clean pipeline, one user (Alex), sole prop + SMLLC + trading.

---

## 3. SCHEMA SPECIFICATION

### 3A. New Tables

All monetary fields are **BigInt (cents)**. All IDs are **UUID v4** unless noted. All tenant tables have **userId TEXT NOT NULL** with RLS policy.

#### `entities`
The first-class entity model. Every user gets a "Personal" entity auto-created.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| userId | TEXT | NOT NULL, FK → users.id | RLS scoped |
| name | VARCHAR(100) | NOT NULL | "Personal Finances", "My LLC", etc. |
| entity_type | VARCHAR(20) | NOT NULL, CHECK IN ('personal','sole_prop','smllc','s_corp','c_corp','partnership') | |
| is_default | BOOLEAN | NOT NULL DEFAULT false | True for auto-created Personal entity |
| state_of_formation | VARCHAR(2) | NULL | Two-letter state code |
| ein | VARCHAR(20) | NULL | Encrypted at rest |
| fiscal_year_start | INT | NOT NULL DEFAULT 1 | Month number (1=Jan) |
| naics_code | VARCHAR(6) | NULL | Industry classification |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Unique:** `[userId, name]`
**Index:** `[userId, is_default]`

#### `chart_of_accounts`
Rebuilt with entity scoping. No more global code uniqueness.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| userId | TEXT | NOT NULL, FK → users.id | RLS scoped |
| entity_id | UUID | NOT NULL, FK → entities.id | |
| code | VARCHAR(10) | NOT NULL | e.g., "1010", "6100" — no prefix needed, entity provides context |
| name | VARCHAR(100) | NOT NULL | |
| account_type | VARCHAR(20) | NOT NULL, CHECK IN ('asset','liability','equity','revenue','expense') | |
| balance_type | CHAR(1) | NOT NULL, CHECK IN ('D','C') | Normal balance side |
| sub_type | VARCHAR(50) | NULL | e.g., "cash", "accounts_receivable", "meals_50_pct" |
| tax_form_line | VARCHAR(50) | NULL | e.g., "schedule_c_line_8", "form_8949" |
| is_archived | BOOLEAN | NOT NULL DEFAULT false | Soft delete |
| settled_balance | BIGINT | NOT NULL DEFAULT 0 | Cached balance in cents. Source of truth = SUM(ledger_entries) |
| version | INT | NOT NULL DEFAULT 0 | Optimistic concurrency |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Unique:** `[userId, entity_id, code]`
**Index:** `[entity_id, account_type]`, `[userId, code]`

#### `coa_templates`
Master template definitions per entity type.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| entity_type | VARCHAR(20) | NOT NULL | Matches entities.entity_type |
| name | VARCHAR(100) | NOT NULL | "Sole Proprietor Standard" |
| version | INT | NOT NULL DEFAULT 1 | Template versioning |
| is_active | BOOLEAN | NOT NULL DEFAULT true | |

**Unique:** `[entity_type, name]`

#### `coa_template_accounts`
Individual accounts within a template.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| template_id | UUID | NOT NULL, FK → coa_templates.id | |
| code | VARCHAR(10) | NOT NULL | |
| name | VARCHAR(100) | NOT NULL | |
| account_type | VARCHAR(20) | NOT NULL | |
| balance_type | CHAR(1) | NOT NULL | |
| sub_type | VARCHAR(50) | NULL | |
| tax_form_line | VARCHAR(50) | NULL | |

**Unique:** `[template_id, code]`

#### `journal_entries` (NEW — replaces both old systems)
One entry per financial event. Immutable once posted.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| userId | TEXT | NOT NULL, FK → users.id | RLS scoped |
| entity_id | UUID | NOT NULL, FK → entities.id | Primary entity |
| date | DATE | NOT NULL | Transaction date |
| description | TEXT | NOT NULL | |
| source_type | VARCHAR(20) | NOT NULL, CHECK IN ('plaid_txn','investment_txn','manual','reversal','closing') | |
| source_id | TEXT | NULL | FK to source record (plaid txn id, investment txn id, etc.) |
| status | VARCHAR(20) | NOT NULL DEFAULT 'posted', CHECK IN ('posted','reversed') | |
| is_reversal | BOOLEAN | NOT NULL DEFAULT false | |
| reverses_entry_id | UUID | NULL, FK → journal_entries.id | Points to entry being reversed |
| reversed_by_entry_id | UUID | NULL, FK → journal_entries.id | Points to reversing entry |
| metadata | JSONB | NULL | Strategy name, trade number, etc. |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Index:** `[userId, date]`, `[source_type, source_id]`, `[entity_id, date]`
**Unique:** `[source_type, source_id]` WHERE `is_reversal = false` — prevents duplicate commits

#### `ledger_entries` (NEW — clean slate)
Individual debit/credit lines. Immutable.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| journal_entry_id | UUID | NOT NULL, FK → journal_entries.id ON DELETE RESTRICT | |
| account_id | UUID | NOT NULL, FK → chart_of_accounts.id ON DELETE RESTRICT | |
| entry_type | CHAR(1) | NOT NULL, CHECK IN ('D','C') | |
| amount | BIGINT | NOT NULL, CHECK (amount > 0) | Always positive, in cents |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

**Index:** `[journal_entry_id]`, `[account_id, created_at]`

#### `account_tax_mappings`
Replaces hardcoded Schedule C line matching in code.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| account_id | UUID | NOT NULL, FK → chart_of_accounts.id | |
| tax_form | VARCHAR(50) | NOT NULL | "schedule_c", "form_8949", "form_1040" |
| form_line | VARCHAR(50) | NOT NULL | "line_8", "line_24b", "line_7" |
| tax_year | INT | NOT NULL | 2025, 2026, etc. |
| multiplier | DECIMAL(5,4) | NOT NULL DEFAULT 1.0 | 0.5 for 50% meals deduction |

**Unique:** `[account_id, tax_form, form_line, tax_year]`

### 3B. Modified Tables

#### `transactions` (existing — modifications)
| Change | Detail |
|--------|--------|
| Reset `accountCode` to NULL | All 4,183 rows — forces re-categorization through clean pipeline |
| Add `entity_id` | UUID, FK → entities.id, nullable initially |
| Add `review_status` | Already exists, verify values are clean |
| Keep all Plaid-sourced columns | Raw data preserved |

#### `investment_transactions` (existing — modifications)
| Change | Detail |
|--------|--------|
| Reset `accountCode` to NULL | All 824 rows |
| Add `entity_id` | UUID, FK → entities.id, nullable initially |
| Keep all Plaid-sourced + Robinhood columns | Raw data preserved |

#### `merchant_coa_mappings` (existing — modifications)
| Change | Detail |
|--------|--------|
| Add `entity_id` | UUID, FK → entities.id |
| Remap `coa_code` | Old P-6100 → new entity-scoped "6100", etc. |
| Keep `confidence_score`, `usage_count` | Learning data preserved |

#### `budgets` (existing — modifications)
| Change | Detail |
|--------|--------|
| Add `entity_id` | UUID, FK → entities.id |
| Remap `accountCode` | Strip P-/B-/T- prefix |

### 3C. Dropped Tables
| Table | Reason |
|-------|--------|
| `journal_entries` (old) | 0 rows. Memo-only dead system. |
| `journal_entry_lines` (old) | 0 rows. Associated dead system. |
| `category_coa_defaults` | Replaced by `coa_templates` + `coa_template_accounts` |
| `bank_reconciliations` | Audit trail of corrupted data |
| `reconciliation_items` | Same |
| `period_closes` | Same |
| `closing_periods` | Same |

### 3D. DB-Level Protections (Recreated)

```sql
-- 1. Immutable ledger trigger
CREATE OR REPLACE FUNCTION prevent_ledger_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. Create reversing entries instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_ledger_immutability
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modifications();

-- 2. Balance validation trigger (debits must equal credits per journal entry)
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits BIGINT;
  total_credits BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'D' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'C' THEN amount ELSE 0 END), 0)
  INTO total_debits, total_credits
  FROM ledger_entries
  WHERE journal_entry_id = NEW.journal_entry_id;

  -- Only validate after all lines for this entry are inserted
  -- This is called per-statement, not per-row
  IF total_debits != total_credits THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debits=% credits=%',
      NEW.journal_entry_id, total_debits, total_credits;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied as CONSTRAINT TRIGGER (deferred to end of transaction)
CREATE CONSTRAINT TRIGGER enforce_journal_balance
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION validate_journal_balance();

-- 3. CHECK constraints
ALTER TABLE ledger_entries ADD CONSTRAINT chk_positive_amount CHECK (amount > 0);
ALTER TABLE ledger_entries ADD CONSTRAINT chk_entry_type CHECK (entry_type IN ('D', 'C'));
ALTER TABLE chart_of_accounts ADD CONSTRAINT chk_balance_type CHECK (balance_type IN ('D', 'C'));
ALTER TABLE chart_of_accounts ADD CONSTRAINT chk_account_type
  CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense'));

-- 4. Unique constraint preventing duplicate commits
CREATE UNIQUE INDEX idx_unique_source_commit
  ON journal_entries (source_type, source_id)
  WHERE is_reversal = false AND source_id IS NOT NULL;
```

### 3E. Row-Level Security

```sql
-- Enable RLS on all tenant tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_coa_mappings ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE merchant_coa_mappings FORCE ROW LEVEL SECURITY;

-- Policies (set current_setting('app.user_id') in middleware)
CREATE POLICY user_isolation ON entities
  USING ("userId" = current_setting('app.user_id', true));
CREATE POLICY user_isolation ON chart_of_accounts
  USING ("userId" = current_setting('app.user_id', true));
CREATE POLICY user_isolation ON journal_entries
  USING ("userId" = current_setting('app.user_id', true));
CREATE POLICY user_isolation ON merchant_coa_mappings
  USING ("userId" = current_setting('app.user_id', true));

-- ledger_entries isolated via journal_entries JOIN
CREATE POLICY user_isolation ON ledger_entries
  USING (journal_entry_id IN (
    SELECT id FROM journal_entries
    WHERE "userId" = current_setting('app.user_id', true)
  ));
```

---

## 4. DATA PRESERVATION MATRIX

| Data | Rows | Can Regenerate? | Action | Notes |
|------|------|----------------|--------|-------|
| transactions | 4,183 | Yes (Plaid re-sync) | KEEP, reset accountCode to NULL | Source data for recommit |
| investment_transactions | 824 | Yes (Plaid re-sync) | KEEP, reset accountCode to NULL | Source data for recommit |
| merchant_coa_mappings | 715 | No (months of learning) | KEEP, add entity_id, remap codes | Strip P-/B-/T- prefix from coa_code |
| trading_positions | 262 | No | KEEP | Operational + P/L history |
| stock_lots | 169 | No | KEEP | Tax-critical cost basis |
| lot_dispositions | 180 | No | KEEP | Tax-critical disposal records |
| securities | 296 | Yes (Plaid re-sync) | KEEP | Reference data |
| budgets | 48 | No (user-created) | KEEP, add entity_id, remap codes | Strip prefix from accountCode |
| trade_cards | 3 | No (user-created) | KEEP | Trading journal cards |
| users | 102 | No | KEEP | Auth data |
| accounts | 7 | No (Plaid linked) | KEEP | Bank connections |
| plaid_items | 3 | No | KEEP | Plaid access tokens |
| journal_transactions | 5,696 | — | **DELETE ALL** | 100% corrupted |
| ledger_entries | 11,690 | — | **DELETE ALL** | 100% corrupted |
| chart_of_accounts | 164 | Yes (from templates) | **DELETE ALL** | Balances wrong, rebuild from templates |
| journal_entries (old) | 0 | — | **DROP TABLE** | Dead system |
| journal_entry_lines (old) | 0 | — | **DROP TABLE** | Dead system |

---

## 5. MIGRATION PLAN

### 5A. Pre-Migration Checklist

- [ ] Full database backup (pg_dump)
- [ ] Verify backup can be restored (pg_restore to test instance)
- [ ] Screenshot current financial statements (evidence of pre-state)
- [ ] Export merchant_coa_mappings to CSV (safety copy)
- [ ] Export trading_positions, stock_lots, lot_dispositions to CSV
- [ ] Confirm Alex's userId: `cmfi3rcrl0000zcj0ajbj4za5`

### 5B. Migration Steps (Exact Order)

**STEP 1: BACKUP**
```sql
-- Full backup
pg_dump "CONNECTION_STRING" > temple_stuart_backup_2026_02_25.sql

-- Safety exports
\copy merchant_coa_mappings TO 'merchant_mappings_backup.csv' WITH CSV HEADER;
\copy trading_positions TO 'trading_positions_backup.csv' WITH CSV HEADER;
\copy stock_lots TO 'stock_lots_backup.csv' WITH CSV HEADER;
\copy lot_dispositions TO 'lot_dispositions_backup.csv' WITH CSV HEADER;
```

**STEP 2: DROP IMMUTABILITY TRIGGER (required before deleting ledger_entries)**
```sql
DROP TRIGGER IF EXISTS enforce_ledger_immutability ON ledger_entries;
DROP TRIGGER IF EXISTS prevent_ledger_modifications ON ledger_entries;
DROP TRIGGER IF EXISTS validate_transaction_balance ON ledger_entries;
```

**STEP 3: NUKE CORRUPTED DATA**
```sql
-- Order matters: FK dependencies
DELETE FROM ledger_entries;                -- 11,690 rows (depends on journal_transactions)
DELETE FROM journal_transactions;          -- 5,696 rows (old journal entries table name)
DELETE FROM chart_of_accounts;             -- 164 rows (balances all wrong)
DELETE FROM category_coa_defaults;         -- 12 rows

-- Drop dead tables
DROP TABLE IF EXISTS journal_entry_lines;  -- 0 rows
DROP TABLE IF EXISTS journal_entries;      -- 0 rows (old memo system)
DROP TABLE IF EXISTS bank_reconciliations CASCADE;
DROP TABLE IF EXISTS reconciliation_items CASCADE;
DROP TABLE IF EXISTS period_closes CASCADE;
DROP TABLE IF EXISTS closing_periods CASCADE;
```

**STEP 4: RESET SOURCE DATA**
```sql
-- Reset all transactions to uncommitted state
UPDATE transactions SET "accountCode" = NULL, review_status = 'pending';
UPDATE investment_transactions SET "accountCode" = NULL;
```

**STEP 5: CREATE NEW TABLES**
Via Prisma migration — creates `entities`, new `chart_of_accounts` (rebuilt), new `journal_entries`, new `ledger_entries`, `coa_templates`, `coa_template_accounts`, `account_tax_mappings`.

**STEP 6: SEED ENTITY + COA**
```sql
-- Create Alex's Personal entity
INSERT INTO entities (id, "userId", name, entity_type, is_default)
VALUES (gen_random_uuid(), 'cmfi3rcrl0000zcj0ajbj4za5', 'Personal Finances', 'personal', true);

-- Create Trading entity
INSERT INTO entities (id, "userId", name, entity_type, is_default)
VALUES (gen_random_uuid(), 'cmfi3rcrl0000zcj0ajbj4za5', 'Trading', 'personal', false);

-- Create Business entity (if Alex has one)
INSERT INTO entities (id, "userId", name, entity_type, is_default)
VALUES (gen_random_uuid(), 'cmfi3rcrl0000zcj0ajbj4za5', 'Business', 'sole_prop', false);

-- Then seed COA from templates for each entity (via application code)
```

**STEP 7: REMAP MERCHANT MEMORY**
```sql
-- Add entity_id column
ALTER TABLE merchant_coa_mappings ADD COLUMN entity_id UUID;

-- Map old prefixed codes to new codes + entity
-- P-xxxx → personal entity, code xxxx
-- B-xxxx → business entity, code xxxx
-- T-xxxx → trading entity, code xxxx
UPDATE merchant_coa_mappings SET
  coa_code = SUBSTRING(coa_code FROM 3),
  entity_id = (SELECT id FROM entities WHERE "userId" = merchant_coa_mappings."userId"
    AND entity_type = CASE
      WHEN coa_code LIKE 'P-%' THEN 'personal'
      WHEN coa_code LIKE 'B-%' THEN 'sole_prop'
      WHEN coa_code LIKE 'T-%' THEN 'personal'  -- trading codes need mapping
    END
    LIMIT 1);
```

**STEP 8: RECREATE DB PROTECTIONS**
Apply all triggers, CHECK constraints, and RLS policies from Section 3D and 3E.

**STEP 9: VERIFY**
```sql
-- Accounting equation must be 0 (empty books)
SELECT
  SUM(CASE WHEN account_type = 'asset' THEN settled_balance ELSE 0 END) -
  SUM(CASE WHEN account_type = 'liability' THEN settled_balance ELSE 0 END) -
  SUM(CASE WHEN account_type = 'equity' THEN settled_balance ELSE 0 END) -
  SUM(CASE WHEN account_type = 'revenue' THEN settled_balance ELSE 0 END) +
  SUM(CASE WHEN account_type = 'expense' THEN settled_balance ELSE 0 END) as gap
FROM chart_of_accounts;
-- Expected: 0 (or NULL if no balances yet)
```

---

## 6. REBUILD PIPELINE

After migration, Alex re-imports data through the FIXED pipeline.

### 6A. Transaction Lifecycle (New)

```
[Plaid Sync]
    │
    ▼
IMPORTED ──────── Raw transaction lands in transactions table
    │              review_status = 'imported', accountCode = NULL
    │
    ▼
PENDING REVIEW ── Auto-categorization runs:
    │              1. Merchant memory lookup (entity-scoped)
    │              2. Category default map
    │              Sets predicted_coa_code + prediction_confidence
    │
    ▼
CATEGORIZED ───── User reviews in queue:
    │              Accepts prediction OR overrides with correct code
    │              Sets accountCode = chosen code
    │
    ▼
COMMITTED ─────── Commit to ledger:
    │              Creates ONE journal_entry + TWO ledger_entries (D+C)
    │              Updates chart_of_accounts.settled_balance
    │              Updates merchant memory (feedback loop)
    │              Sets review_status = 'committed'
    │
    ▼
(VOIDED) ──────── If error found later:
                   Creates REVERSING journal_entry (is_reversal=true)
                   Original entry status → 'reversed'
                   Reversing entry linked via reverses_entry_id
                   Transaction review_status → 'imported' (can recommit correctly)
                   ONE original + ONE reversal = audit trail preserved
```

### 6B. Commit Rules (Non-Negotiable)

1. **One journal entry per source transaction.** The unique index `[source_type, source_id] WHERE is_reversal = false` enforces this at DB level. Attempting to commit an already-committed transaction returns an error, not a duplicate.

2. **Reversals are separate entries.** A reversal is a new journal entry with `is_reversal = true` and opposite debits/credits. The original entry is NEVER modified except to set `reversed_by_entry_id` and `status = 'reversed'`.

3. **No uncommit-and-rewrite.** The old pattern (delete old entry, create new one) is gone. The new pattern: reverse the old entry → recommit the corrected version. Two entries for one correction, both permanent.

4. **Accounting equation verified on every commit.** After each journal entry is committed, the running equation check runs. If A ≠ L + E + R - X, the commit is rejected.

### 6C. Trading Commit Pipeline (Rebuilt)

```
[investment_transactions] ── Raw Plaid/Robinhood data
    │
    ▼
position-tracker-service (ONLY service, investment-ledger-service deleted)
    │
    ├── OPEN legs → journal_entry (DR asset, CR cash/liability)
    │   T-1200 Long Calls (asset)
    │   T-1210 Long Puts (asset)
    │   T-2100 Short Calls (liability)
    │   T-2110 Short Puts (liability)
    │   T-1010 Trading Cash
    │
    ├── CLOSE legs → journal_entry (match to open, calculate P/L)
    │   Gain: CR T-4100 Trading Gains (revenue)
    │   Loss: DR T-5100 Trading Losses (expense)
    │
    └── STOCK trades → stock_lots + lot_dispositions
        T-1100 Stock Holdings (asset)
        FIFO/LIFO/HIFO/LOFO/SpecificID
```

### 6D. Alex's Reimport Workflow

1. **Plaid sync** — pulls all transactions fresh (they're already in the DB, just reset to uncommitted)
2. **Auto-categorize** — merchant memory kicks in for ~715 known merchants
3. **Review queue** — Alex reviews batch-by-batch, entity-by-entity
4. **Commit** — one clean journal entry per transaction, no duplicates possible
5. **Verify** — accounting equation = 0 after each batch
6. **Trading commit** — process investment_transactions through position-tracker
7. **Final audit** — full trial balance, all accounts reconcile, zero gap

---

## 7. TAX COMPLIANCE REFERENCE (2025 Filing)

### 7A. Key Numbers

| Item | Value | Source |
|------|-------|--------|
| Standard deduction (Single) | $15,750 | IRS Rev. Proc. 2024-40 |
| LTCG 0% bracket | Up to $48,350 | |
| LTCG 15% bracket | $48,351–$533,400 | |
| LTCG 20% bracket | Over $533,400 | |
| SE tax rate | 15.3% on 92.35% of net | |
| SS wage base | $176,100 | |
| Business meals deduction | **50%** (not 100%) | Post-TCJA permanent |
| Standard mileage rate | $0.70/mile | |
| Long-term holding period | ≥ 366 days | |
| CA capital gains | Taxed as ordinary income (no preferential rate) | |
| CA LLC franchise tax | $800/year | First-year exemption expired 1/1/2024 |

### 7B. Account → Tax Form Mapping (via account_tax_mappings table)

| Account | Tax Form | Line | Multiplier | Notes |
|---------|----------|------|------------|-------|
| Advertising | Schedule C | Line 8 | 1.0 | |
| Car & truck | Schedule C | Line 9 | 1.0 | |
| Insurance | Schedule C | Line 15 | 1.0 | |
| Legal & professional | Schedule C | Line 17 | 1.0 | |
| Office expense | Schedule C | Line 18 | 1.0 | |
| Supplies | Schedule C | Line 22 | 1.0 | |
| Travel | Schedule C | Line 24a | 1.0 | |
| **Meals** | **Schedule C** | **Line 24b** | **0.5** | **50% deduction** |
| Utilities | Schedule C | Line 25 | 1.0 | |
| Wages paid | Schedule C | Line 26 | 1.0 | |
| Software & SaaS | Schedule C | Line 27a (Other) | 1.0 | |
| Trading Gains | Form 8949 | Per disposition | 1.0 | ST vs LT by holding period |
| Wages & Salary | Form 1040 | Line 1a | 1.0 | From tax_overrides W-2 data |

### 7C. Known Tax Bugs to Fix

| Bug | Location | Fix |
|-----|----------|-----|
| LTCG taxed at ordinary rates | form-1040-service.ts:255 | Implement 0%/15%/20% bracket lookup |
| Business meals at 100% | schedule-c-service.ts line 24b | Apply 0.5 multiplier from account_tax_mappings |
| Hardcoded bank mapping | commit-to-ledger/route.ts:58-64 | Replace with entity-aware bank account lookup |
| Year 2025 hardcoded | robinhood-parser.ts:368,607 | Use dynamic year from transaction date |
| Statements have no date filter | statements/route.ts | Add date range params, fiscal period support |

---

## 8. CLAUDE CODE PROMPT SEQUENCE

Each prompt is a self-contained unit of work. Execute in order. Review results between each. Every prompt ends with git commit + push.

### PROMPT 0: BACKUP
```
CRITICAL: Before any destructive operations, create a full database backup.

1. Run: pg_dump "CONNECTION_STRING" > /tmp/temple_stuart_backup_$(date +%Y%m%d_%H%M%S).sql
2. Verify the backup file size is > 0 bytes
3. Run: pg_dump "CONNECTION_STRING" --data-only -t merchant_coa_mappings > /tmp/merchant_mappings_backup.csv
4. Run: pg_dump "CONNECTION_STRING" --data-only -t trading_positions > /tmp/trading_positions_backup.csv
5. Run: pg_dump "CONNECTION_STRING" --data-only -t stock_lots > /tmp/stock_lots_backup.csv
6. Run: pg_dump "CONNECTION_STRING" --data-only -t lot_dispositions > /tmp/lot_dispositions_backup.csv

Report: file sizes of each backup.
Do NOT proceed to any other steps.
```

### PROMPT 1: NUKE CORRUPTED DATA
```
TRUTH-FIRST: Read these files before doing ANYTHING:
- prisma/schema.prisma (full file)
- prisma/migrations/ (list all)

Then connect to the production database and execute IN THIS EXACT ORDER:

1. DROP triggers that prevent ledger modification:
   DROP TRIGGER IF EXISTS enforce_ledger_immutability ON ledger_entries;
   DROP TRIGGER IF EXISTS prevent_ledger_modifications ON ledger_entries;
   DROP TRIGGER IF EXISTS validate_transaction_balance ON ledger_entries;

2. Delete corrupted data (FK order):
   DELETE FROM ledger_entries;
   DELETE FROM journal_transactions;
   DELETE FROM chart_of_accounts;
   DELETE FROM category_coa_defaults;
   DELETE FROM bank_reconciliations;
   DELETE FROM reconciliation_items;
   DELETE FROM period_closes;
   DELETE FROM closing_periods;

3. Drop dead tables:
   DROP TABLE IF EXISTS journal_entry_lines;
   DROP TABLE IF EXISTS journal_entries;

4. Reset source data to uncommitted:
   UPDATE transactions SET "accountCode" = NULL, review_status = 'pending';
   UPDATE investment_transactions SET "accountCode" = NULL;

5. VERIFY — run these and report results:
   SELECT COUNT(*) FROM ledger_entries;        -- expect 0
   SELECT COUNT(*) FROM journal_transactions;  -- expect 0
   SELECT COUNT(*) FROM chart_of_accounts;     -- expect 0
   SELECT COUNT(*) FROM transactions WHERE "accountCode" IS NOT NULL;  -- expect 0
   SELECT COUNT(*) FROM investment_transactions WHERE "accountCode" IS NOT NULL;  -- expect 0
   SELECT COUNT(*) FROM merchant_coa_mappings; -- expect 715 (preserved)
   SELECT COUNT(*) FROM trading_positions;     -- expect 262 (preserved)
   SELECT COUNT(*) FROM stock_lots;            -- expect 169 (preserved)

Do NOT modify any code files. Do NOT create branches.
Report all query results.
```

### PROMPT 2: SCHEMA MIGRATION
```
TRUTH-FIRST: Read the BUILD-BIBLE.md Section 3 (Schema Specification) completely before starting.
Also read: prisma/schema.prisma (current state post-nuke)

Update prisma/schema.prisma to implement the new schema:

1. ADD new models:
   - entities (Section 3A)
   - coa_templates (Section 3A)
   - coa_template_accounts (Section 3A)
   - account_tax_mappings (Section 3A)

2. REBUILD existing models:
   - chart_of_accounts: add entity_id FK, change unique constraint to [userId, entity_id, code], remove global @unique on code
   - journal_entries: NEW model per Section 3A spec (replaces both old systems)
   - ledger_entries: NEW model per Section 3A spec

3. MODIFY existing models:
   - transactions: add entity_id (optional UUID)
   - investment_transactions: add entity_id (optional UUID)
   - merchant_coa_mappings: add entity_id (optional UUID)
   - budgets: add entity_id (optional UUID)

4. REMOVE old models:
   - journal_entry_lines (already dropped)
   - journal_entries (old version, already dropped — the new journal_entries model replaces it)
   - category_coa_defaults (replaced by coa_templates)
   - bank_reconciliations, reconciliation_items, period_closes, closing_periods

5. Run: npx prisma db push
6. Verify: npx prisma generate

DO NOT use prisma migrate. Use prisma db push (we're past tracked migrations mattering).

git add -A && git commit -m "schema: rebuild bookkeeping schema per Build Bible" && git push origin main
Confirm push: git log origin/main --oneline -1
```

### PROMPT 3: DB PROTECTIONS + RLS
```
TRUTH-FIRST: Read BUILD-BIBLE.md Section 3D (DB-Level Protections) and Section 3E (Row-Level Security).
Read the current prisma/schema.prisma to confirm new tables exist.

Connect to production database and execute:

1. Create immutable ledger trigger (Section 3D, item 1)
2. Create balance validation trigger (Section 3D, item 2 — CONSTRAINT TRIGGER, DEFERRABLE)
3. Create CHECK constraints (Section 3D, item 3)
4. Create unique source commit index (Section 3D, item 4)
5. Enable RLS + create policies (Section 3E, all statements)

VERIFY each:
- Try UPDATE on ledger_entries (should fail if any rows exist, otherwise test after first commit)
- SELECT * FROM pg_policies WHERE tablename IN ('entities','chart_of_accounts','journal_entries','ledger_entries','merchant_coa_mappings');
- Report all policy names and tables

Do NOT modify application code. SQL only.
```

### PROMPT 4: SEED TEMPLATES + ENTITIES
```
TRUTH-FIRST: Read BUILD-BIBLE.md Section 3A (coa_templates, coa_template_accounts).
Read BUILD-BIBLE.md Section 7B (Account → Tax Form Mapping).

1. Create seed file: src/lib/seed-coa-templates.ts
   - Template for 'personal' entity type with all P- accounts (without prefix)
   - Template for 'sole_prop' entity type with all B- accounts (without prefix)
   - Template for 'personal' trading accounts (all T- accounts without prefix, sub_type distinguishes)
   - Include tax_form_line for every account that maps to a tax form
   - Use BigInt(0) for all initial balances

2. Create entity seeder: src/lib/seed-entities.ts
   - Creates "Personal Finances" entity (personal, is_default=true)
   - Creates "Trading" entity (personal, is_default=false)
   - Creates "Business" entity (sole_prop, is_default=false) — only if B- accounts existed
   - For each entity, instantiate COA from matching template
   - Populate account_tax_mappings for Schedule C, Form 8949, Form 1040

3. Create API route or script to run the seeder for Alex (userId = 'cmfi3rcrl0000zcj0ajbj4za5')

4. VERIFY:
   SELECT COUNT(*) FROM entities WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5';  -- expect 3
   SELECT COUNT(*) FROM chart_of_accounts WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5';  -- expect ~147 (P+B+T accounts)
   SELECT entity_id, COUNT(*) FROM chart_of_accounts WHERE "userId" = 'cmfi3rcrl0000zcj0ajbj4za5' GROUP BY entity_id;
   Accounting equation gap = 0 (all balances are 0)

git add -A && git commit -m "feat: COA templates + entity seeder per Build Bible" && git push origin main
```

### PROMPT 5: REMAP MERCHANT MEMORY
```
TRUTH-FIRST: Read current merchant_coa_mappings structure.
Read BUILD-BIBLE.md Section 5B Step 7 (Remap Merchant Memory).

1. Check current coa_code values:
   SELECT DISTINCT LEFT(coa_code, 2) as prefix, COUNT(*) FROM merchant_coa_mappings GROUP BY 1;

2. Add entity_id column (if not already added by Prompt 2):
   ALTER TABLE merchant_coa_mappings ADD COLUMN IF NOT EXISTS entity_id UUID;

3. Map old codes to new entity + code:
   - P-xxxx → personal entity_id, code = xxxx (strip "P-")
   - B-xxxx → business entity_id, code = xxxx (strip "B-")
   - T-xxxx → trading entity_id, code = xxxx (strip "T-")

4. VERIFY:
   SELECT COUNT(*) FROM merchant_coa_mappings WHERE entity_id IS NULL;  -- expect 0
   SELECT COUNT(*) FROM merchant_coa_mappings WHERE coa_code LIKE 'P-%';  -- expect 0
   SELECT COUNT(*) FROM merchant_coa_mappings WHERE coa_code LIKE 'B-%';  -- expect 0
   SELECT coa_code, COUNT(*) FROM merchant_coa_mappings GROUP BY coa_code ORDER BY COUNT(*) DESC LIMIT 10;

Do NOT delete any mappings. All 715 must survive.
```

### PROMPT 6: REBUILD COMMIT PIPELINE
```
TRUTH-FIRST: Read these files completely:
- src/app/api/transactions/commit-to-ledger/route.ts
- src/lib/journal-entry-service.ts
- src/app/api/transactions/uncommit/route.ts
- BUILD-BIBLE.md Section 6A (Transaction Lifecycle) and 6B (Commit Rules)

Rebuild the commit pipeline:

1. Rewrite journal-entry-service.ts:
   - Creates journal_entries (new table) not journal_transactions
   - Creates ledger_entries (new table)
   - Updates chart_of_accounts.settled_balance
   - Enforces unique [source_type, source_id] — reject duplicate commits
   - All amounts in BigInt cents (convert from Float at entry point)
   - Entity-scoped: every entry tied to an entity_id

2. Rewrite commit-to-ledger/route.ts:
   - Remove hardcoded bank mapping (wells→P-1010, robinhood→P-1200)
   - Look up bank account's entity and COA code dynamically
   - Use new journal_entries table
   - Set review_status = 'committed' on transaction

3. Rewrite uncommit/route.ts:
   - Creates REVERSING journal entry (is_reversal=true, reverses_entry_id=original.id)
   - Sets original entry reversed_by_entry_id and status='reversed'
   - NEVER deletes original entry
   - Resets transaction review_status to 'imported'

4. Delete src/lib/investment-ledger-service.ts (killed per Build Bible Decision #8)

5. VERIFY — the code compiles:
   npx tsc --noEmit

git add -A && git commit -m "feat: rebuild commit pipeline with proper reversals per Build Bible" && git push origin main
```

### PROMPT 7: REBUILD TRADING COMMIT
```
TRUTH-FIRST: Read these files completely:
- src/lib/position-tracker-service.ts
- src/app/api/investment-transactions/commit-to-ledger/route.ts
- BUILD-BIBLE.md Section 6C (Trading Commit Pipeline)

Rebuild the trading commit pipeline:

1. Update position-tracker-service.ts:
   - Use new journal_entries table (not journal_transactions)
   - Use new ledger_entries table
   - Remove all T-4140/T-5140 references (use T-4100/T-5100 only — wait, strip prefix: use "4100"/"5100")
   - Entity-scoped: trading entity_id on all entries
   - Duplicate protection: unique [source_type, source_id]

2. Update investment commit route:
   - Entity-aware bank/position account lookup
   - Remove hardcoded T- prefix codes, use entity-scoped codes
   - Same reversal pattern as banking commits

3. VERIFY — the code compiles:
   npx tsc --noEmit

git add -A && git commit -m "feat: rebuild trading commit pipeline per Build Bible" && git push origin main
```

### PROMPT 8: REBUILD FINANCIAL STATEMENTS
```
TRUTH-FIRST: Read these files completely:
- src/app/api/statements/route.ts
- src/lib/schedule-c-service.ts
- src/lib/form-1040-service.ts
- src/lib/tax-report-service.ts
- BUILD-BIBLE.md Section 7 (Tax Compliance Reference)

Fix all tax bugs and add date filtering:

1. statements/route.ts:
   - Add date range params (startDate, endDate)
   - Add entity_id filter
   - Query by entity, not by prefix string matching

2. schedule-c-service.ts:
   - Use account_tax_mappings table instead of hardcoded name matching
   - Apply 50% multiplier for meals (from account_tax_mappings.multiplier)
   - Scope to business/sole_prop entity

3. form-1040-service.ts:
   - Fix LTCG bracket calculation (0%/15%/20% per Section 7A)
   - Use account_tax_mappings for line mapping

4. tax-report-service.ts:
   - Fix holding period: >= 366 days for long-term
   - Use entity-scoped accounts

5. VERIFY:
   npx tsc --noEmit

git add -A && git commit -m "fix: tax bugs + date-filtered statements per Build Bible" && git push origin main
```

### PROMPT 9: AUTO-CATEGORIZATION FIX
```
TRUTH-FIRST: Read these files:
- src/lib/auto-categorization-service.ts
- BUILD-BIBLE.md Section 3B (merchant_coa_mappings modifications)

Fix auto-categorization:

1. Update merchant memory lookup to be entity-scoped (use entity_id)
2. Fix hardcoded category map:
   - Remove P- prefixes from all codes
   - Add INCOME mapping
   - Add TRANSFER_IN, TRANSFER_OUT, LOAN_PAYMENTS mappings
   - Verify codes P-6300 (BANK_FEES) and P-6200 (TRAVEL) exist in templates — if not, add them
3. Update confidence feedback loop to work with new table structure

4. VERIFY:
   npx tsc --noEmit

git add -A && git commit -m "fix: entity-scoped auto-categorization per Build Bible" && git push origin main
```

### PROMPT 10: INTEGRATION TEST + FINAL VERIFY
```
TRUTH-FIRST: Read the rebuilt pipeline files from Prompts 6-9.

Run a full integration test:

1. Pick one transaction from the transactions table (the simplest one — a grocery purchase or similar)
2. Manually set its accountCode to the correct COA code
3. Call the commit-to-ledger endpoint for that single transaction
4. VERIFY:
   - SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 1;
   - SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 2;
   - Debits = Credits for this entry
   - chart_of_accounts.settled_balance updated correctly for both accounts
   - Accounting equation = 0

5. Test reversal:
   - Call uncommit for the same transaction
   - VERIFY: original entry has status='reversed', new reversal entry exists, balances restored to 0

6. Test duplicate prevention:
   - Try to commit the same transaction again (after reversal, should work)
   - Try to commit it a SECOND time (should fail with unique constraint error)

7. Report ALL query results.

Do NOT commit code changes. This is verification only.
```

---

## APPENDIX A: COA TEMPLATE — PERSONAL

Accounts for the Personal entity. Code has no prefix — entity provides context.

| Code | Name | Type | Balance | Sub-Type | Tax Line |
|------|------|------|---------|----------|----------|
| 1010 | Primary Checking | asset | D | cash | |
| 1020 | Savings | asset | D | cash | |
| 1030 | Cash & Wallet | asset | D | cash | |
| 1200 | Brokerage Account | asset | D | investment | |
| 1300 | Retirement (457b) | asset | D | retirement | |
| 1310 | Retirement (IRA) | asset | D | retirement | |
| 2010 | Credit Card | liability | C | credit_card | |
| 2020 | Student Loans | liability | C | loan | |
| 3000 | Personal Equity | equity | C | | |
| 3100 | Opening Balances | equity | C | | |
| 4000 | Wages & Salary | revenue | C | | form_1040_line_1a |
| 4100 | Interest Income | revenue | C | | form_1040_line_2b |
| 4200 | Other Income | revenue | C | | form_1040_line_8 |
| 6100 | Groceries & Food | expense | D | | |
| 6110 | Coffee & Snacks | expense | D | | |
| 6120 | Dating & Social | expense | D | | |
| 6150 | Dining Out | expense | D | | |
| 6200 | Travel & Vacation | expense | D | | |
| 6300 | Bank Fees & Interest | expense | D | | |
| 6400 | Transportation | expense | D | | |
| 6500 | Auto Payment | expense | D | | |
| 6510 | Auto Insurance | expense | D | | |
| 6520 | Gas & Fuel | expense | D | | |
| 6530 | Auto Maintenance | expense | D | | |
| 6610 | Auto Registration | expense | D | | |
| 6620 | Parking | expense | D | | |
| 6630 | Tolls | expense | D | | |
| 8100 | Rent | expense | D | | |
| 8110 | Renters Insurance | expense | D | | |
| 8120 | Utilities | expense | D | | |
| 8130 | Medical & Health | expense | D | | |
| 8140 | Prescriptions | expense | D | | |
| 8150 | Personal Care | expense | D | | |
| 8160 | Clothing & Apparel | expense | D | | |
| 8170 | Entertainment | expense | D | | |
| 8180 | Streaming & Subscriptions | expense | D | | |
| 8190 | Phone & Internet | expense | D | | |
| 8200 | Home & Household | expense | D | | |
| 8210 | Office Supplies | expense | D | | |
| 8220 | Coworking Space | expense | D | | |
| 8230 | Storage Unit | expense | D | | |
| 8310 | Hygiene & Toiletries | expense | D | | |
| 8320 | Cleaning Supplies | expense | D | | |
| 8330 | Kitchen & Household | expense | D | | |
| 8410 | Gym & Fitness | expense | D | | |
| 8420 | Supplements & Vitamins | expense | D | | |
| 8430 | Mental Health | expense | D | | |
| 8510 | Professional Development | expense | D | | |
| 8520 | Community & Social | expense | D | | |
| 8530 | Books & Learning | expense | D | | |
| 8900 | Miscellaneous | expense | D | | |
| 9000 | Uncategorized | expense | D | | |

## APPENDIX B: COA TEMPLATE — SOLE PROP / SMLLC

| Code | Name | Type | Balance | Tax Line |
|------|------|------|---------|----------|
| 1010 | Business Checking | asset | D | |
| 1020 | Business Savings | asset | D | |
| 1100 | Accounts Receivable | asset | D | |
| 1400 | Equipment | asset | D | |
| 1410 | Accum. Depreciation | asset | D | |
| 2010 | Accounts Payable | liability | C | |
| 2020 | Credit Card (Business) | liability | C | |
| 3000 | Owner's Equity | equity | C | |
| 3100 | Owner's Draws | equity | D | |
| 3200 | Owner's Contributions | equity | C | |
| 4000 | Service Revenue | revenue | C | schedule_c_line_1 |
| 4100 | Product Revenue | revenue | C | schedule_c_line_1 |
| 4200 | Other Business Income | revenue | C | schedule_c_line_6 |
| 6000 | Advertising | expense | D | schedule_c_line_8 |
| 6010 | Car & Truck Expenses | expense | D | schedule_c_line_9 |
| 6020 | Commissions & Fees | expense | D | schedule_c_line_10 |
| 6050 | Insurance (Business) | expense | D | schedule_c_line_15 |
| 6060 | Interest (Business) | expense | D | schedule_c_line_16b |
| 6070 | Legal & Professional | expense | D | schedule_c_line_17 |
| 6080 | Office Expense | expense | D | schedule_c_line_18 |
| 6100 | Rent (Business) | expense | D | schedule_c_line_20b |
| 6120 | Supplies | expense | D | schedule_c_line_22 |
| 6130 | Taxes & Licenses | expense | D | schedule_c_line_23 |
| 6140 | Travel (Business) | expense | D | schedule_c_line_24a |
| 6150 | Meals (Business) | expense | D | schedule_c_line_24b |
| 6160 | Utilities (Business) | expense | D | schedule_c_line_25 |
| 6170 | Wages Paid | expense | D | schedule_c_line_26 |
| 6200 | Software & SaaS | expense | D | schedule_c_line_27a |
| 6210 | Hosting & Cloud | expense | D | schedule_c_line_27a |
| 6220 | Phone & Internet (Business) | expense | D | schedule_c_line_27a |
| 6230 | Education & Training | expense | D | schedule_c_line_27a |
| 6240 | Subscriptions (Business) | expense | D | schedule_c_line_27a |

## APPENDIX C: COA TEMPLATE — TRADING

| Code | Name | Type | Balance | Tax Line |
|------|------|------|---------|----------|
| 1010 | Trading Cash | asset | D | |
| 1100 | Stock Holdings | asset | D | |
| 1200 | Long Call Positions | asset | D | |
| 1210 | Long Put Positions | asset | D | |
| 2100 | Short Call Positions | liability | C | |
| 2110 | Short Put Positions | liability | C | |
| 3000 | Trading Equity | equity | C | |
| 3200 | Contributions | equity | C | |
| 3300 | Withdrawals | equity | D | |
| 4100 | Trading Gains | revenue | C | form_8949 |
| 5100 | Trading Losses | expense | D | form_8949 |

---

## APPENDIX D: SECURITY CRITICAL ISSUES (Not Part of Rebuild, But Tracked)

These must be addressed before next public exposure:

| # | Issue | Severity |
|---|-------|----------|
| 1 | Admin routes accessible to ANY authenticated user | CRITICAL |
| 2 | Admin password plain text comparison | CRITICAL |
| 3 | Dev mode auth bypass if NODE_ENV wrong | CRITICAL |
| 4 | No rate limiting on auth endpoints | HIGH |
| 5 | Math.random() for ID generation | MEDIUM |
| 6 | Plaid access tokens stored as plaintext | MEDIUM |
| 7 | CSP has unsafe-inline + unsafe-eval | MEDIUM |

---

*END OF BUILD BIBLE*
