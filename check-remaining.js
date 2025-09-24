require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRemaining() {
  const allAccounts = await prisma.accounts.findMany({
    select: { 
      id: true, 
      name: true, 
      userId: true,
      plaidItemId: true,
      _count: { select: { transactions: true } }
    }
  });
  
  console.log(`Total accounts in database: ${allAccounts.length}`);
  allAccounts.forEach(acc => {
    console.log(`- ${acc.name}: userId=${acc.userId || 'NULL'}, plaidItem=${acc.plaidItemId}, txns=${acc._count.transactions}`);
  });
  
  const allPlaidItems = await prisma.plaid_items.findMany();
  console.log(`\nTotal Plaid items: ${allPlaidItems.length}`);
  
  await prisma.$disconnect();
}

checkRemaining();
