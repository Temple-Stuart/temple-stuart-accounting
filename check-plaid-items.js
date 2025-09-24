require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkItems() {
  const items = await prisma.plaid_items.findMany({
    include: { 
      accounts: true,
      user: true 
    }
  });
  
  console.log('Plaid Items in database:');
  items.forEach(item => {
    console.log(`\nID: ${item.id}`);
    console.log(`  User: ${item.user.email}`);
    console.log(`  Created: ${item.createdAt}`);
    console.log(`  Accounts: ${item.accounts.length}`);
    item.accounts.forEach(acc => {
      console.log(`    - ${acc.name}: ${acc.type} (Balance: $${acc.currentBalance || 0})`);
    });
  });
  
  await prisma.$disconnect();
}

checkItems();
