const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJournalEntries() {
  try {
    const results = await prisma.$queryRaw`
      SELECT 
        t.id as transaction_id,
        t.name as transaction_name,
        t.date as transaction_date,
        t.amount as transaction_amount,
        t."accountCode" as assigned_coa,
        jt.id as journal_entry_id,
        jt.description as journal_description,
        jt.posted_at
      FROM transactions t
      LEFT JOIN journal_transactions jt 
        ON jt.plaid_transaction_id = t."transactionId"
      WHERE t."accountCode" IS NOT NULL
      ORDER BY t.date DESC
      LIMIT 20
    `;
    
    console.log('\n=== JOURNAL ENTRY CHECK ===\n');
    console.log('Found ' + results.length + ' committed transactions\n');
    
    const withJournals = results.filter(r => r.journal_entry_id);
    const withoutJournals = results.filter(r => !r.journal_entry_id);
    
    console.log('✅ ' + withJournals.length + ' have journal entries');
    console.log('❌ ' + withoutJournals.length + ' missing journal entries\n');
    
    if (withoutJournals.length > 0) {
      console.log('Sample transactions WITHOUT journal entries:');
      withoutJournals.slice(0, 5).forEach(r => {
        console.log('- ' + r.transaction_name + ' | $' + r.transaction_amount + ' | COA: ' + r.assigned_coa);
      });
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJournalEntries();
