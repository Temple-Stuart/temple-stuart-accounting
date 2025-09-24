require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeFakeAccounts() {
  // Delete all existing accounts and plaid items for your user
  const user = await prisma.users.findFirst({
    where: { email: 'Astuart@templestuart.com' }
  });
  
  // Delete all transactions first
  await prisma.transactions.deleteMany({
    where: { account: { userId: user.id } }
  });
  
  // Delete all accounts
  await prisma.accounts.deleteMany({
    where: { userId: user.id }
  });
  
  // Delete all plaid items
  await prisma.plaid_items.deleteMany({
    where: { userId: user.id }
  });
  
  console.log('Cleared all connections. Now reconnect in dashboard for real data.');
  await prisma.$disconnect();
}

removeFakeAccounts();
