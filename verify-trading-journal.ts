import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const lastJournal = await prisma.journalTransaction.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { ledgerEntries: true }
  });
  
  console.log('\n📝 Last Journal Entry:');
  console.log(`  Account: ${lastJournal?.accountCode}`);
  console.log(`  Amount: $${lastJournal?.amount}`);
  console.log(`  Strategy: ${lastJournal?.strategy}`);
  console.log(`  Trade #: ${lastJournal?.tradeNum || 'N/A'}`);
  console.log(`\n💰 Ledger Entries: ${lastJournal?.ledgerEntries.length}`);
  lastJournal?.ledgerEntries.forEach(entry => {
    console.log(`  ${entry.debit ? 'DR' : 'CR'} ${entry.accountCode}: $${entry.debit || entry.credit}`);
  });
}

verify().finally(() => prisma.$disconnect());
