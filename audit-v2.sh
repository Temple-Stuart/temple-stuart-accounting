#!/bin/bash

echo "======================================"
echo "STEP 0: FIND ALEX'S USER ID"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT id, email, name, tier FROM users 
WHERE email ILIKE '%stuart%' OR email ILIKE '%temple%' OR name ILIKE '%alex%';
"

psql "$DATABASE_URL" -c "
SELECT DISTINCT \"userId\" FROM chart_of_accounts LIMIT 10;
"

psql "$DATABASE_URL" -c "
SELECT \"userId\", COUNT(*) as coa_count 
FROM chart_of_accounts GROUP BY \"userId\" ORDER BY coa_count DESC;
"

echo "======================================"
echo "1A: FULL CHART OF ACCOUNTS (biggest user)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT entity_type, code, name, account_type, balance_type, settled_balance, is_archived
FROM chart_of_accounts
WHERE \"userId\" = (SELECT \"userId\" FROM chart_of_accounts GROUP BY \"userId\" ORDER BY COUNT(*) DESC LIMIT 1)
ORDER BY entity_type NULLS LAST, code;
"

echo "======================================"
echo "1B: CONNECTED PLAID ACCOUNTS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT a.name, a.type, a.subtype, a.\"entityType\", a.\"accountCode\", pi.\"institutionName\"
FROM accounts a
JOIN plaid_items pi ON a.\"plaidItemId\" = pi.id
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
GROUP BY pi.\"institutionName\", a.name, a.type
ORDER BY pi.\"institutionName\", a.name;
"

echo "======================================"
echo "1D: CATEGORIZATION STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  CASE WHEN review_status = 'approved' THEN 'approved'
       WHEN review_status IS NOT NULL THEN review_status
       WHEN \"accountCode\" IS NOT NULL THEN 'has_code_no_status'
       ELSE 'uncategorized' END as status,
  COUNT(*) as count,
  MIN(date) as earliest, MAX(date) as latest
FROM transactions
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
LEFT JOIN chart_of_accounts c ON t.\"accountCode\" = c.code
WHERE t.\"accountCode\" IS NOT NULL
GROUP BY t.\"accountCode\", c.name, c.entity_type, c.account_type
ORDER BY c.entity_type NULLS LAST, t.\"accountCode\";
"

echo "======================================"
echo "1F: JOURNAL ENTRY STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_journal_txns, 
       MIN(transaction_date) as earliest, 
       MAX(transaction_date) as latest
FROM journal_transactions;
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_ledger_entries,
       SUM(CASE WHEN entry_type = 'D' THEN amount ELSE 0 END) as total_debits,
       SUM(CASE WHEN entry_type = 'C' THEN amount ELSE 0 END) as total_credits,
       SUM(CASE WHEN entry_type = 'D' THEN amount ELSE 0 END) - 
       SUM(CASE WHEN entry_type = 'C' THEN amount ELSE 0 END) as debit_credit_diff
FROM ledger_entries;
"

echo "======================================"
echo "1G: UNBALANCED JOURNAL ENTRIES"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT jt.id, jt.description, jt.transaction_date,
       SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) as debits,
       SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as credits
FROM journal_transactions jt
JOIN ledger_entries le ON le.transaction_id = jt.id
GROUP BY jt.id, jt.description, jt.transaction_date
HAVING SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) 
    != SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)
LIMIT 20;
"

echo "======================================"
echo "1H: TRADING DATA STATE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_positions,
       COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_pos,
       COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_pos
FROM trading_positions;
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_lots,
       COUNT(CASE WHEN status = 'open' THEN 1 END) as open_lots,
       COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_lots
FROM stock_lots;
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_dispositions,
       ROUND(SUM(realized_gain_loss)::numeric, 2) as total_gain_loss,
       COUNT(CASE WHEN is_wash_sale = true THEN 1 END) as wash_sales
FROM lot_dispositions;
"

echo "======================================"
echo "1I: TAX OVERRIDES"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT * FROM tax_overrides ORDER BY tax_year;
"

echo "======================================"
echo "1J: MERCHANT MAPPINGS (top 20)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT merchant_name, coa_code, confidence_score, usage_count
FROM merchant_coa_mappings
ORDER BY usage_count DESC NULLS LAST
LIMIT 20;
"

echo "======================================"
echo "4A: COA BALANCE INTEGRITY"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT c.code, c.name, c.settled_balance as stored_balance,
       COALESCE(SUM(CASE 
         WHEN c.balance_type = 'D' AND le.entry_type = 'D' THEN le.amount
         WHEN c.balance_type = 'D' AND le.entry_type = 'C' THEN -le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'C' THEN le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'D' THEN -le.amount
       END), 0) as computed_balance
FROM chart_of_accounts c
LEFT JOIN ledger_entries le ON le.account_id = c.id
WHERE c.\"userId\" = (SELECT \"userId\" FROM chart_of_accounts GROUP BY \"userId\" ORDER BY COUNT(*) DESC LIMIT 1)
GROUP BY c.code, c.name, c.settled_balance, c.balance_type
HAVING c.settled_balance != COALESCE(SUM(CASE 
         WHEN c.balance_type = 'D' AND le.entry_type = 'D' THEN le.amount
         WHEN c.balance_type = 'D' AND le.entry_type = 'C' THEN -le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'C' THEN le.amount
         WHEN c.balance_type = 'C' AND le.entry_type = 'D' THEN -le.amount
       END), 0)
ORDER BY c.code;
"

echo "======================================"
echo "4B: ACCOUNTING EQUATION"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  SUM(CASE WHEN account_type = 'asset' THEN settled_balance ELSE 0 END) as total_assets,
  SUM(CASE WHEN account_type = 'liability' THEN settled_balance ELSE 0 END) as total_liabilities,
  SUM(CASE WHEN account_type = 'equity' THEN settled_balance ELSE 0 END) as total_equity,
  SUM(CASE WHEN account_type = 'revenue' THEN settled_balance ELSE 0 END) as total_revenue,
  SUM(CASE WHEN account_type = 'expense' THEN settled_balance ELSE 0 END) as total_expenses
FROM chart_of_accounts
WHERE \"userId\" = (SELECT \"userId\" FROM chart_of_accounts GROUP BY \"userId\" ORDER BY COUNT(*) DESC LIMIT 1)
AND is_archived = false;
"

echo "======================================"
echo "5: SAMPLE JOURNAL ENTRIES (latest 10)"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT jt.id, jt.description, jt.transaction_date, jt.amount,
       le.entry_type, le.amount as le_amount, le.account_id
FROM journal_transactions jt
JOIN ledger_entries le ON le.transaction_id = jt.id
ORDER BY jt.transaction_date DESC
LIMIT 20;
"

echo "======================================"
echo "6: ROBINHOOD TRANSACTIONS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as rh_transactions,
       COUNT(CASE WHEN t.\"accountCode\" IS NOT NULL AND t.\"accountCode\" LIKE 'T-%' THEN 1 END) as with_trading_coa
FROM transactions t
JOIN accounts a ON t.\"accountId\" = a.\"accountId\"
JOIN plaid_items pi ON a.\"plaidItemId\" = pi.id
WHERE pi.\"institutionName\" ILIKE '%robinhood%';
"

echo "======================================"
echo "AUDIT COMPLETE"
echo "======================================"
