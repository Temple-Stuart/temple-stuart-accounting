import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const lastJournal = await prisma.journal_entries.findFirst({
    orderBy: { created_at: 'desc' },
    include: {
      ledger_entries: {
        include: { account: true }
      }
    }
  });

  console.log('\nLast Journal Entry:');
  console.log(`  Source: ${lastJournal?.source_type} / ${lastJournal?.source_id}`);
  console.log(`  Description: ${lastJournal?.description}`);
  console.log(`  Status: ${lastJournal?.status}`);
  console.log(`\nLedger Entries: ${lastJournal?.ledger_entries.length}`);
  lastJournal?.ledger_entries.forEach(entry => {
    const amt = Number(entry.amount) / 100;
    console.log(`  ${entry.entry_type === 'D' ? 'DR' : 'CR'} ${entry.account.code}: $${amt.toFixed(2)}`);
  });
}

verify().finally(() => prisma.$disconnect());
