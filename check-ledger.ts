import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const lastJournal = await prisma.journalTransaction.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { 
      ledgerEntries: {
        include: { account: true }
      }
    }
  });
  
  console.log('\n📝 Journal Entry:');
  console.log(`  ID: ${lastJournal?.id}`);
  console.log(`  Account: ${lastJournal?.accountCode}`);
  console.log(`  Amount: $${(lastJournal?.amount || 0) / 100}`);
  console.log(`  Strategy: ${lastJournal?.strategy}`);
  
  console.log(`\n💰 Ledger Entries (${lastJournal?.ledgerEntries.length}):`);
  lastJournal?.ledgerEntries.forEach(entry => {
    const amt = Number(entry.amount) / 100;
    console.log(`  ${entry.entryType === 'D' ? 'DR' : 'CR'} ${entry.account.code}: $${amt.toFixed(2)}`);
  });
}

check().finally(() => prisma.$disconnect());
