const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const recent = await prisma.investment_transactions.findMany({
    take: 5,
    orderBy: { date: 'desc' },
    include: { security: true }
  });
  
  console.log('Recent 5 transactions:');
  recent.forEach(t => {
    console.log(`Date: ${t.date}, Symbol: ${t.security?.ticker_symbol}, Qty: ${t.quantity}, Strike: ${t.security?.option_strike_price}`);
  });
  
  await prisma.$disconnect();
}

main();
