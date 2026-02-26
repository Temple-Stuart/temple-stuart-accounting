const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  const result = await prisma.$queryRaw`
    SELECT investment_transaction_id, COUNT(*) as count
    FROM investment_transactions
    GROUP BY investment_transaction_id
    HAVING COUNT(*) > 1
  `;
  
  console.log('Duplicate investment_transaction_ids: ' + result.length);
  if (result.length > 0) {
    console.log('Sample duplicates:');
    result.slice(0, 5).forEach(r => console.log('  ' + r.investment_transaction_id + ' appears ' + r.count + ' times'));
  }
  
  await prisma.$disconnect();
}

checkDuplicates();
