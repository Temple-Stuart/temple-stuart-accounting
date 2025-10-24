const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInvestments() {
  const committed = await prisma.investment_transactions.count({
    where: { accountCode: { not: null } }
  });
  const uncommitted = await prisma.investment_transactions.count({
    where: { accountCode: null }
  });
  
  console.log('Investment transactions:');
  console.log('  Committed: ' + committed);
  console.log('  Uncommitted: ' + uncommitted);
  
  await prisma.$disconnect();
}

checkInvestments();
