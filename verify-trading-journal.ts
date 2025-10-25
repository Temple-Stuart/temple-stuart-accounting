import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const lastJournal = await prisma.journalTransaction.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { 
      ledgerEntries: {
        include: { account: true }
      }
    }
  });
  
  console.log('\n📝 Last Journal Entry:');
  console.log(`  Account: ${lastJournal?.accountCode}`);
  console.log(`  Amount: $${lastJournal?.amount}`);
  console.log(`  Strategy: ${lastJournal?.strategy}`);
  console.log(`  Trade #: ${lastJournal?.tradeNum || 'N/A'}`);
  console.log(`\n💰 Ledger Entries: ${lastJournal?.ledgerEntries.length}`);
  lastJournal?.ledgerEntries.forEach(entry => {
    const amt = Number(entry.amount) / 100;
    console.log(`  ${entry.entryType === 'D' ? 'DR' : 'CR'} ${entry.account.code}: $${amt.toFixed(2)}`);
  });
}

verify().finally(() => prisma.$disconnect());
