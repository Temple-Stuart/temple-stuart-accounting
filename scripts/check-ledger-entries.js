const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLedgerEntries() {
  const results = await prisma.$queryRaw`
    SELECT 
      jt.id as journal_id,
      jt.description,
      le.id as ledger_entry_id,
      le.entry_type,
      le.amount,
      coa.code as account_code,
      coa.name as account_name
    FROM journal_transactions jt
    INNER JOIN ledger_entries le ON le.transaction_id = jt.id
    INNER JOIN chart_of_accounts coa ON coa.id = le.account_id
    ORDER BY jt.created_at DESC
    LIMIT 10
  `;
  
  console.log('\n=== LEDGER ENTRIES CHECK ===\n');
  console.log('Found ' + results.length + ' ledger entries\n');
  
  results.forEach(r => {
    console.log(r.description);
    console.log('  ' + r.entry_type + ' | ' + r.account_code + ' - ' + r.account_name + ' | $' + (Number(r.amount) / 100).toFixed(2));
  });
  
  await prisma.$disconnect();
}

checkLedgerEntries();
