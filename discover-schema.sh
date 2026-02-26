#!/bin/bash
echo "======================================"
echo "SCHEMA DISCOVERY"
echo "======================================"

echo "--- chart_of_accounts columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'chart_of_accounts' ORDER BY ordinal_position;
"

echo "--- transactions columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'transactions' ORDER BY ordinal_position;
"

echo "--- accounts columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'accounts' ORDER BY ordinal_position;
"

echo "--- journal_transactions columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'journal_transactions' ORDER BY ordinal_position;
"

echo "--- ledger_entries columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'ledger_entries' ORDER BY ordinal_position;
"

echo "--- trading_positions columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'trading_positions' ORDER BY ordinal_position;
"

echo "--- stock_lots columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'stock_lots' ORDER BY ordinal_position;
"

echo "--- lot_dispositions columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'lot_dispositions' ORDER BY ordinal_position;
"

echo "--- merchant_coa_mappings columns ---"
psql "$DATABASE_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'merchant_coa_mappings' ORDER BY ordinal_position;
"

echo "======================================"
echo "FIND THE USER"
echo "======================================"
psql "$DATABASE_URL" -c "SELECT * FROM users LIMIT 5;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_coa_rows FROM chart_of_accounts;"
psql "$DATABASE_URL" -c "SELECT * FROM chart_of_accounts LIMIT 3;"

echo "======================================"
echo "DISCOVERY COMPLETE"
echo "======================================"
