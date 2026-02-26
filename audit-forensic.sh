#!/bin/bash

echo "======================================"
echo "F1: WHAT DO TRANSACTION accountIds LOOK LIKE?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT \"accountId\", COUNT(*) as txn_count
FROM transactions
GROUP BY \"accountId\"
ORDER BY txn_count DESC;
"

echo "======================================"
echo "F2: WHAT DO ACCOUNT accountIds LOOK LIKE?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT \"accountId\", name, \"userId\", \"entityType\"
FROM accounts
ORDER BY \"userId\";
"

echo "======================================"
echo "F3: DO ANY TRANSACTION accountIds MATCH ACCOUNT accountIds?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN a.\"accountId\" IS NOT NULL THEN 1 END) as matched_to_account,
  COUNT(CASE WHEN a.\"accountId\" IS NULL THEN 1 END) as orphaned
FROM transactions t
LEFT JOIN accounts a ON t.\"accountId\" = a.\"accountId\";
"

echo "======================================"
echo "F4: WHAT IS IN journal_transactions.account_code?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT account_code, COUNT(*) as count
FROM journal_transactions
GROUP BY account_code
ORDER BY count DESC
LIMIT 30;
"

echo "======================================"
echo "F5: SAMPLE JOURNAL ENTRIES WITH ALL FIELDS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT id, transaction_date, description, account_code, amount, 
       plaid_transaction_id, external_transaction_id,
       is_reversal, strategy, trade_num
FROM journal_transactions
ORDER BY transaction_date DESC
LIMIT 10;
"

echo "======================================"
echo "F6: LEDGER ENTRIES — WHAT account_id VALUES EXIST?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT le.account_id, c.code as coa_code, c.name as coa_name, 
       COUNT(*) as entry_count
FROM ledger_entries le
LEFT JOIN chart_of_accounts c ON le.account_id = c.id
GROUP BY le.account_id, c.code, c.name
ORDER BY entry_count DESC
LIMIT 30;
"

echo "======================================"
echo "F7: WHAT HAPPENS ON UNCOMMIT — IS THERE A deleted/void STATUS?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT review_status, COUNT(*) FROM transactions GROUP BY review_status;
"

psql "$DATABASE_URL" -c "
SELECT DISTINCT is_reversal, COUNT(*) FROM journal_transactions GROUP BY is_reversal;
"

psql "$DATABASE_URL" -c "
SELECT COUNT(*) as with_reversal_link 
FROM journal_transactions 
WHERE reversed_by_transaction_id IS NOT NULL;
"

echo "======================================"
echo "F8: SAMPLE TRANSACTIONS — RAW DATA"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT id, \"accountId\", name, amount, date, \"accountCode\", 
       review_status, \"merchantName\"
FROM transactions
ORDER BY date DESC
LIMIT 10;
"

echo "======================================"
echo "F9: CAN WE MATCH transactions TO accounts BY ANY FIELD?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT t.\"accountId\" as txn_account_id, 
       a.\"accountId\" as acct_account_id,
       a.id as acct_id,
       a.name as acct_name
FROM transactions t
LEFT JOIN accounts a ON t.\"accountId\" = a.\"accountId\"
LIMIT 5;
"

psql "$DATABASE_URL" -c "
SELECT t.\"accountId\" as txn_account_id, 
       a.\"accountId\" as acct_account_id,
       a.id as acct_id,
       a.name as acct_name
FROM transactions t
LEFT JOIN accounts a ON t.\"accountId\" = a.id
LIMIT 5;
"

echo "======================================"
echo "F10: ALL TABLE ROW COUNTS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT 'transactions' as tbl, COUNT(*) FROM transactions
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'plaid_items', COUNT(*) FROM plaid_items
UNION ALL SELECT 'journal_transactions', COUNT(*) FROM journal_transactions
UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries
UNION ALL SELECT 'chart_of_accounts', COUNT(*) FROM chart_of_accounts
UNION ALL SELECT 'trading_positions', COUNT(*) FROM trading_positions
UNION ALL SELECT 'stock_lots', COUNT(*) FROM stock_lots
UNION ALL SELECT 'lot_dispositions', COUNT(*) FROM lot_dispositions
UNION ALL SELECT 'merchant_coa_mappings', COUNT(*) FROM merchant_coa_mappings
UNION ALL SELECT 'users', COUNT(*) FROM users
ORDER BY tbl;
"

echo "======================================"
echo "FORENSIC AUDIT COMPLETE"
echo "======================================"
