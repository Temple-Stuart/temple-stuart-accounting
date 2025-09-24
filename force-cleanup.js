require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceCleanup() {
  console.log('Force cleaning all data...');
  
  // Delete ALL transactions first
  const deletedTxns = await prisma.transactions.deleteMany({});
  console.log(`Deleted ${deletedTxns.count} transactions`);
  
  // Delete ALL accounts (including orphaned ones with NULL userId)
  const deletedAccounts = await prisma.accounts.deleteMany({});
  console.log(`Deleted ${deletedAccounts.count} accounts`);
  
  // Delete ALL plaid items
  const deletedItems = await prisma.plaid_items.deleteMany({});
  console.log(`Deleted ${deletedItems.count} Plaid items`);
  
  console.log('\nDatabase completely cleared! Now reconnect in dashboard for real balances.');
  await prisma.$disconnect();
}

forceCleanup();
