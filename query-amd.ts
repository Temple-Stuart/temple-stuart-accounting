import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const txns = await prisma.investment_transactions.findMany({
    where: {
      date: { 
        gte: new Date('2025-06-18'),
        lte: new Date('2025-06-28')
      }
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  
  console.log(`Found ${txns.length} transactions in June 18-28`);
  console.log('=== AMD JUNE TRADES ===');
  
  const amdTrades = txns.filter(t => 
    t.security?.option_underlying_ticker === 'AMD' || 
    t.name?.includes('AMD')
  );
  
  console.log(`Found ${amdTrades.length} AMD trades`);
  
  amdTrades.forEach(t => {
    console.log(JSON.stringify({
      id: t.id,
      date: t.date,
      name: t.name,
      type: t.type,
      price: t.price,
      quantity: t.quantity,
      security: t.security ? {
        underlying: t.security.option_underlying_ticker,
        strike: t.security.option_strike_price,
        expiry: t.security.option_expiration_date,
        contract_type: t.security.option_contract_type
      } : null
    }, null, 2));
    console.log('---');
  });
}

main().then(() => prisma.$disconnect());
