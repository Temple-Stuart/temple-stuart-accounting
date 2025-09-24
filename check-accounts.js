const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccounts() {
  try {
    const accounts = await prisma.accounts.findMany({
      select: {
        name: true,
        type: true,
        subtype: true,
        currentBalance: true,
        availableBalance: true,
        accountId: true,
        mask: true
      }
    });
    
    console.log('Accounts in database:');
    accounts.forEach(acc => {
      console.log(`\n${acc.name}:`);
      console.log(`  Type: ${acc.type} / ${acc.subtype}`);
      console.log(`  Current Balance: ${acc.currentBalance}`);
      console.log(`  Available Balance: ${acc.availableBalance}`);
      console.log(`  Account ID: ${acc.accountId}`);
      console.log(`  Mask: ${acc.mask || 'N/A'}`);
    });
    
    // Also check transactions count per account
    for (const acc of accounts) {
      const txnCount = await prisma.transactions.count({
        where: { account: { accountId: acc.accountId } }
      });
      console.log(`  Transactions: ${txnCount}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccounts();
