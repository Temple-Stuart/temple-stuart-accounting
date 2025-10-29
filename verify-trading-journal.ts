import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const lastJournal = await prisma.journal_transactions.findFirst({
    orderBy: { created_at: 'desc' },
    include: { 
      ledger_entries: {
        include: { chart_of_accounts: true }
      }
    }
  });
  
  console.log('\n📝 Last Journal Entry:');
  console.log(`  Account: ${lastJournal?.account_code}`);
  console.log(`  Amount: $${lastJournal?.amount}`);
  console.log(`  Strategy: ${lastJournal?.strategy}`);
  console.log(`  Trade #: ${lastJournal?.trade_num || 'N/A'}`);
  console.log(`\n💰 Ledger Entries: ${lastJournal?.ledger_entries.length}`);
  lastJournal?.ledger_entries.forEach(entry => {
    const amt = Number(entry.amount) / 100;
    console.log(`  ${entry.entry_type === 'D' ? 'DR' : 'CR'} ${entry.chart_of_accounts.code}: $${amt.toFixed(2)}`);
  });
}

verify().finally(() => prisma.$disconnect());
