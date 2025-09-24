require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  // Keep only the connections for your main account (Astuart@templestuart.com)
  const mainUser = await prisma.users.findFirst({
    where: { email: 'Astuart@templestuart.com' }
  });
  
  const toDelete = await prisma.plaid_items.findMany({
    where: {
      userId: { not: mainUser.id }
    },
    include: { accounts: true }
  });
  
  console.log(`Deleting ${toDelete.length} test/duplicate connections...`);
  
  for (const item of toDelete) {
    // First, delete all transactions for accounts in this plaid item
    for (const account of item.accounts) {
      const deletedTxns = await prisma.transactions.deleteMany({
        where: { accountId: account.id }
      });
      console.log(`  Deleted ${deletedTxns.count} transactions for account ${account.name}`);
    }
    
    // Then delete the accounts
    const deletedAccounts = await prisma.accounts.deleteMany({
      where: { plaidItemId: item.id }
    });
    console.log(`  Deleted ${deletedAccounts.count} accounts`);
    
    // Finally delete the plaid item
    await prisma.plaid_items.delete({
      where: { id: item.id }
    });
    
    console.log(`Deleted connection ${item.id}`);
  }
  
  console.log('\nRemaining connections need to be reconnected in dashboard to get real balances.');
  await prisma.$disconnect();
}

cleanup();
