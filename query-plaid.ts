import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const txns = await prisma.investment_transactions.findMany({
    where: {
      date: { gte: new Date('2025-06-20') }
    },
    include: { security: true },
    take: 5,
    orderBy: { date: 'desc' }
  });
  
  console.log('=== PLAID TRANSACTION DATA ===');
  txns.forEach(t => {
    console.log(JSON.stringify({
      date: t.date,
      name: t.name,
      type: t.type,
      subtype: t.subtype,
      price: t.price,
      quantity: t.quantity,
      security: t.security ? {
        ticker: t.security.ticker_symbol,
        strike: t.security.option_strike_price,
        expiry: t.security.option_expiration_date,
        contract_type: t.security.option_contract_type,
        underlying: t.security.option_underlying_ticker
      } : null
    }, null, 2));
    console.log('---');
  });
}

main().then(() => prisma.$disconnect());
