#!/bin/bash
ALEX="(SELECT id FROM users WHERE email = 'Astuart@templestuart.com')"
ALEX_ALT="(SELECT id FROM users WHERE email = 'stuart.alexander.phi@gmail.com')"

echo "======================================"
echo "0: WHICH USER HAS THE DATA?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT u.id, u.email, u.name, u.tier,
  (SELECT COUNT(*) FROM chart_of_accounts WHERE \"userId\" = u.id) as coa_count,
  (SELECT COUNT(*) FROM accounts WHERE \"userId\" = u.id) as plaid_accounts,
  (SELECT COUNT(*) FROM merchant_coa_mappings WHERE \"userId\" = u.id) as merchant_maps
FROM users u
WHERE u.email IN ('Astuart@templestuart.com', 'stuart.alexander.phi@gmail.com', 'stuart.alexander.phi@icloud.com')
ORDER BY u.email;
"

echo "======================================"
echo "1: COMMIT vs REVIEW STATUS INVESTIGATION"
echo "======================================"
echo "--- What review_status values actually exist? ---"
psql "$DATABASE_URL" -c "
SELECT review_status, COUNT(*) as count
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
GROUP BY review_status
ORDER BY count DESC;
"

echo "--- How many transactions have accountCode but still pending_review? ---"
psql "$DATABASE_URL" -c "
SELECT 
  CASE WHEN \"accountCode\" IS NOT NULL THEN 'has_code' ELSE 'no_code' END as categorized,
  review_status,
  COUNT(*) as count
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
GROUP BY categorized, review_status
ORDER BY categorized, review_status;
"

echo "--- Do journal entries link back to transactions? ---"
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as total_journals,
  COUNT(plaid_transaction_id) as with_plaid_link,
  COUNT(external_transaction_id) as with_external_link,
  COUNT(CASE WHEN is_reversal = true THEN 1 END) as reversals
FROM journal_transactions
WHERE account_code IN (SELECT code FROM chart_of_accounts WHERE \"userId\" IN $ALEX_ALT);
"

echo "======================================"
echo "2: TRACE THE EQUATION IMBALANCE"
echo "======================================"
echo "--- Balances by entity and account type ---"
psql "$DATABASE_URL" -c "
SELECT 
  COALESCE(entity_type, 'NULL') as entity,
  account_type,
  COUNT(*) as num_accounts,
  SUM(settled_balance) as total_cents,
  ROUND(SUM(settled_balance) / 100.0, 2) as total_dollars
FROM chart_of_accounts
WHERE \"userId\" IN $ALEX_ALT
AND is_archived = false
GROUP BY entity_type, account_type
ORDER BY entity_type NULLS LAST, account_type;
"

echo "--- Accounts with non-zero balances (the ones that matter) ---"
psql "$DATABASE_URL" -c "
SELECT entity_type, code, name, account_type, balance_type, 
       settled_balance as cents,
       ROUND(settled_balance / 100.0, 2) as dollars
FROM chart_of_accounts
WHERE \"userId\" IN $ALEX_ALT
AND settled_balance != 0
AND is_archived = false
ORDER BY entity_type NULLS LAST, code;
"

echo "======================================"
echo "3: VERIFY THE BIG TRANSACTIONS"  
echo "======================================"
echo "--- P-4000 Wages (UCLA W-2): 67 txns totaling 93155 ---"
psql "$DATABASE_URL" -c "
SELECT name, amount, date, \"accountCode\"
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
AND \"accountCode\" = 'P-4000'
ORDER BY date DESC
LIMIT 15;
"

echo "--- P-4200 Other Income: The single 79485 transaction ---"
psql "$DATABASE_URL" -c "
SELECT name, amount, date, \"accountCode\", \"merchantName\", category
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
AND \"accountCode\" = 'P-4200';
"

echo "--- P-6500 Vehicle Maintenance (NEGATIVE balance) ---"
psql "$DATABASE_URL" -c "
SELECT name, amount, date, \"accountCode\"
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
AND \"accountCode\" = 'P-6500'
ORDER BY date;
"

echo "======================================"
echo "4: STOCK LOTS - ACTUAL STATUS VALUES"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT status, COUNT(*) as count
FROM stock_lots
WHERE user_id IN $ALEX_ALT
GROUP BY status;
"

psql "$DATABASE_URL" -c "
SELECT symbol, acquired_date, original_quantity, remaining_quantity, 
       cost_per_share, total_cost_basis, status,
       ROUND(wash_sale_disallowed::numeric, 2) as wash_disallowed
FROM stock_lots
WHERE user_id IN $ALEX_ALT
ORDER BY acquired_date DESC
LIMIT 15;
"

echo "======================================"
echo "5: TRADING POSITIONS SAMPLE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT symbol, option_type, strike_price, position_type, quantity,
       open_price, close_price, realized_pl, status, strategy,
       open_date, close_date
FROM trading_positions
ORDER BY open_date DESC
LIMIT 15;
"

echo "======================================"
echo "6: LOT DISPOSITIONS SAMPLE"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT sl.symbol, sl.acquired_date, ld.disposed_date,
       ld.quantity_disposed, ld.cost_basis_disposed, 
       ld.total_proceeds, ld.realized_gain_loss,
       ld.holding_period_days, ld.is_long_term, ld.is_wash_sale,
       ld.matching_method
FROM lot_dispositions ld
JOIN stock_lots sl ON ld.lot_id = sl.id
WHERE sl.user_id IN $ALEX_ALT
ORDER BY ld.disposed_date DESC
LIMIT 15;
"

echo "======================================"
echo "7: WHAT PLAID CATEGORIES EXIST FOR DOORDASH?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT name, \"merchantName\", amount, date, category, 
       personal_finance_category::text as pfc
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
AND (name ILIKE '%doordash%' OR \"merchantName\" ILIKE '%doordash%')
ORDER BY date DESC
LIMIT 20;
"

echo "======================================"
echo "8: WHAT DOES UBER LOOK LIKE IN THE DATA?"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT name, \"merchantName\", amount, date, \"accountCode\",
       personal_finance_category::text as pfc
FROM transactions
WHERE \"accountId\" IN (SELECT \"accountId\" FROM accounts WHERE \"userId\" IN $ALEX_ALT)
AND (name ILIKE '%uber%' OR \"merchantName\" ILIKE '%uber%')
ORDER BY date DESC
LIMIT 20;
"

echo "======================================"
echo "9: NULL ENTITY_TYPE ACCOUNTS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT code, name, account_type, settled_balance
FROM chart_of_accounts
WHERE \"userId\" IN $ALEX_ALT
AND entity_type IS NULL
ORDER BY code;
"

echo "======================================"
echo "10: UNCOMMIT EVIDENCE - REVERSALS"
echo "======================================"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as total_reversals,
       MIN(reversal_date) as first_reversal,
       MAX(reversal_date) as last_reversal
FROM journal_transactions
WHERE is_reversal = true
AND account_code IN (SELECT code FROM chart_of_accounts WHERE \"userId\" IN $ALEX_ALT);
"

psql "$DATABASE_URL" -c "
SELECT description, transaction_date, reversal_date, amount, account_code, is_reversal
FROM journal_transactions
WHERE is_reversal = true
AND account_code IN (SELECT code FROM chart_of_accounts WHERE \"userId\" IN $ALEX_ALT)
ORDER BY reversal_date DESC
LIMIT 10;
"

echo "======================================"
echo "DEEP AUDIT V4 COMPLETE"
echo "======================================"
