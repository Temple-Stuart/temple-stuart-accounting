require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullCleanup() {
  const user = await prisma.users.findFirst({
    where: { email: 'Astuart@templestuart.com' }
  });
  
  console.log('Cleaning up all data to start fresh...');
  
  // Get all plaid items for this user
  const plaidItems = await prisma.plaid_items.findMany({
    where: { userId: user.id },
    include: { accounts: true }
  });
  
  let totalTxns = 0;
  let totalAccounts = 0;
  
  // Delete in correct order: transactions -> accounts -> plaid_items
  for (const item of plaidItems) {
    for (const account of item.accounts) {
      // Delete transactions for this account
      const deletedTxns = await prisma.transactions.deleteMany({
        where: { accountId: account.id }
      });
      totalTxns += deletedTxns.count;
    }
  }
  
  // Now delete all accounts for this user
  const deletedAccounts = await prisma.accounts.deleteMany({
    where: { userId: user.id }
  });
  totalAccounts = deletedAccounts.count;
  
  // Finally delete all plaid items
  const deletedItems = await prisma.plaid_items.deleteMany({
    where: { userId: user.id }
  });
  
  console.log(`Deleted ${totalTxns} transactions`);
  console.log(`Deleted ${totalAccounts} accounts`);
  console.log(`Deleted ${deletedItems.count} Plaid connections`);
  console.log('\nAll cleared! Now reconnect in dashboard to get REAL balances from Plaid.');
  
  await prisma.$disconnect();
}

fullCleanup();
