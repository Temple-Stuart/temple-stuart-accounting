#!/bin/bash
echo "======================================"
echo "1A: FULL CHART OF ACCOUNTS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT entity_type, code, name, account_type, balance_type, settled_balance, is_archived
FROM chart_of_accounts
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
ORDER BY entity_type, code;
"

echo "======================================"
echo "1B: CONNECTED PLAID ACCOUNTS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT a.name, a.type, a.subtype, a.\"entityType\", a.\"accountCode\", pi.\"institutionName\"
FROM accounts a
JOIN plaid_items pi ON a.\"plaidItemId\" = pi.id
WHERE a.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
ORDER BY pi.\"institutionName\", a.name;
"

echo "======================================"
echo "1C: TRANSACTION VOLUME BY ACCOUNT"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT pi.\"institutionName\", a.name as account_name, a.type,
       COUNT(t.id) as txn_count,
       MIN(t.date) as earliest, MAX(t.date) as latest,
       ROUND(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END)::numeric, 2) as total_positive,
       ROUND(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END)::numeric, 2) as total_negative
FROM transactions t
JOIN accounts a ON t.\"accountId\" = a.\"accountId\"
JOIN plaid_items pi ON a.\"plaidItemId\" = pi.id
WHERE t.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
GROUP BY pi.\"institutionName\", a.name, a.type
ORDER BY pi.\"institutionName\", a.name;
"

echo "======================================"
echo "1D: CATEGORIZATION STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  CASE WHEN \"approvalStatus\" = 'approved' THEN 'committed/approved'
       WHEN \"accountCode\" IS NOT NULL THEN 'categorized_not_committed'
       ELSE 'uncategorized' END as status,
  COUNT(*) as count,
  MIN(date) as earliest, MAX(date) as latest
FROM transactions
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
GROUP BY status
ORDER BY status;
"

echo "======================================"
echo "1E: COA CODES IN USE ON TRANSACTIONS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT t.\"accountCode\", c.name as coa_name, c.entity_type, c.account_type,
       COUNT(*) as txn_count,
       ROUND(SUM(t.amount)::numeric, 2) as total_amount
FROM transactions t
LEFT JOIN chart_of_accounts c ON t.\"accountCode\" = c.code AND c.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
WHERE t.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
AND t.\"accountCode\" IS NOT NULL
GROUP BY t.\"accountCode\", c.name, c.entity_type, c.account_type
ORDER BY c.entity_type, t.\"accountCode\";
"

echo "======================================"
echo "1F: JOURNAL ENTRY STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_journal_txns, MIN(date) as earliest, MAX(date) as latest
FROM journal_transactions
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze';
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_ledger_entries,
       SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
       SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) - 
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) as debit_credit_diff
FROM ledger_entries le
JOIN journal_transactions jt ON le.\"journalTransactionId\" = jt.id
WHERE jt.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze';
"

echo "======================================"
echo "1G: ORPHAN CHECK — UNBALANCED JOURNAL ENTRIES"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT jt.id, jt.description, jt.date,
       SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END) as debits,
       SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END) as credits
FROM journal_transactions jt
JOIN ledger_entries le ON le.\"journalTransactionId\" = jt.id
WHERE jt.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
GROUP BY jt.id, jt.description, jt.date
HAVING SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END) 
    != SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END)
LIMIT 20;
"

echo "======================================"
echo "1H: TRADING DATA STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as total_positions,
  COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_pos,
  COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_pos
FROM trading_positions
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze';
"

psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as total_lots,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as open_lots,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_lots
FROM stock_lots
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze';
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_dispositions,
       ROUND(SUM(\"gainLoss\")::numeric, 2) as total_gain_loss,
       COUNT(CASE WHEN \"isWashSale\" = true THEN 1 END) as wash_sales
FROM lot_dispositions ld
JOIN stock_lots sl ON ld.\"lotId\" = sl.id
WHERE sl.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze';
"

echo "======================================"
echo "1I: TAX OVERRIDES"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT tax_year, field_key, field_value
FROM tax_overrides
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
ORDER BY tax_year, field_key;
"

echo "======================================"
echo "1J: MERCHANT MAPPINGS (top 20)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT \"merchantName\", \"coaCode\", confidence, \"timesUsed\"
FROM merchant_coa_mappings
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
ORDER BY \"timesUsed\" DESC
LIMIT 20;
"

echo "======================================"
echo "4A: COA BALANCE INTEGRITY (discrepancies only)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT c.code, c.name, c.settled_balance as stored_balance,
       COALESCE(SUM(CASE 
         WHEN c.balance_type = 'D' AND le.entry_type = 'DEBIT' THEN le.amount
         WHEN c.balance_type = 'D' AND le.entry_type = 'CREDIT' THEN -le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'CREDIT' THEN le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'DEBIT' THEN -le.amount
       END), 0) as computed_balance
FROM chart_of_accounts c
LEFT JOIN ledger_entries le ON le.\"accountCode\" = c.code 
  AND le.\"journalTransactionId\" IN (
    SELECT id FROM journal_transactions WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
  )
WHERE c.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
GROUP BY c.code, c.name, c.settled_balance, c.balance_type
HAVING c.settled_balance != COALESCE(SUM(CASE 
         WHEN c.balance_type = 'D' AND le.entry_type = 'DEBIT' THEN le.amount
         WHEN c.balance_type = 'D' AND le.entry_type = 'CREDIT' THEN -le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'CREDIT' THEN le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'DEBIT' THEN -le.amount
       END), 0)
ORDER BY c.code;
"

echo "======================================"
echo "4B: ACCOUNTING EQUATION CHECK"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  SUM(CASE WHEN account_type = 'asset' THEN settled_balance ELSE 0 END) as total_assets,
  SUM(CASE WHEN account_type = 'liability' THEN settled_balance ELSE 0 END) as total_liabilities,
  SUM(CASE WHEN account_type = 'equity' THEN settled_balance ELSE 0 END) as total_equity,
  SUM(CASE WHEN account_type = 'revenue' THEN settled_balance ELSE 0 END) as total_revenue,
  SUM(CASE WHEN account_type = 'expense' THEN settled_balance ELSE 0 END) as total_expenses,
  SUM(CASE WHEN account_type = 'asset' THEN settled_balance ELSE 0 END) -
  (SUM(CASE WHEN account_type = 'liability' THEN settled_balance ELSE 0 END) +
   SUM(CASE WHEN account_type = 'equity' THEN settled_balance ELSE 0 END) +
   SUM(CASE WHEN account_type = 'revenue' THEN settled_balance ELSE 0 END) -
   SUM(CASE WHEN account_type = 'expense' THEN settled_balance ELSE 0 END)) as equation_imbalance
FROM chart_of_accounts
WHERE \"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
AND is_archived = false;
"

echo "======================================"
echo "5: SAMPLE JOURNAL ENTRIES (latest 10)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT jt.id, jt.description, jt.date, jt.amount,
       le.entry_type, le.amount as le_amount, le.\"accountCode\"
FROM journal_transactions jt
JOIN ledger_entries le ON le.\"journalTransactionId\" = jt.id
WHERE jt.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
ORDER BY jt.date DESC
LIMIT 20;
"

echo "======================================"
echo "6: ROBINHOOD TRANSACTION STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as rh_transactions,
       COUNT(CASE WHEN \"tradeNumber\" IS NOT NULL THEN 1 END) as with_trade_number,
       COUNT(CASE WHEN \"accountCode\" IS NOT NULL AND \"accountCode\" LIKE 'T-%' THEN 1 END) as with_trading_coa
FROM transactions t
JOIN accounts a ON t.\"accountId\" = a.\"accountId\"
JOIN plaid_items pi ON a.\"plaidItemId\" = pi.id
WHERE t.\"userId\" = 'cmf6dqgj70000zcrmhwwssuze'
AND pi.\"institutionName\" ILIKE '%robinhood%';
"

echo "======================================"
echo "AUDIT COMPLETE"
echo "======================================"
