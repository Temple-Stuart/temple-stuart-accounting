const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDuplicates() {
  const nvdaDupes = await prisma.investment_transactions.findMany({
    where: {
      name: { contains: 'sell 3.000 NVDA call for $0.10 each to open' },
      date: { gte: new Date('2025-06-25'), lt: new Date('2025-06-26') }
    }
  });
  
  console.log('NVDA $0.10 sell 3.000 matches: ' + nvdaDupes.length);
  nvdaDupes.forEach(t => console.log('  ID: ' + t.id + ' | ' + t.investment_transaction_id));
  
  await prisma.$disconnect();
}

findDuplicates();
