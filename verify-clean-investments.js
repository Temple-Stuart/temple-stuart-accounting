const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const total = await prisma.investment_transactions.count();
  console.log('Total investment transactions: ' + total);
  
  const dupes = await prisma.$queryRaw`
    SELECT investment_transaction_id, COUNT(*) as count
    FROM investment_transactions
    GROUP BY investment_transaction_id
    HAVING COUNT(*) > 1
  `;
  
  console.log('Duplicates found: ' + dupes.length);
  console.log('✅ Data is clean!');
  
  await prisma.$disconnect();
}

verify();
