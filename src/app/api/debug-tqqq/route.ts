import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const tqqq = await prisma.investment_transactions.findMany({
    where: {
      OR: [
        { name: { contains: 'TQQQ', mode: 'insensitive' } },
        { security: { ticker_symbol: 'TQQQ' } }
      ]
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  
  await prisma.$disconnect();
  
  return NextResponse.json({ 
    count: tqqq.length,
    transactions: tqqq.map(t => ({
      id: t.investment_transaction_id,
      date: t.date,
      name: t.name,
      type: t.type,
      price: t.price,
      quantity: t.quantity,
      amount: t.amount,
      tradeNum: t.tradeNum,
      symbol: t.security?.ticker_symbol,
      strike: t.security?.option_strike_price,
      optionType: t.security?.option_contract_type
    }))
  });
}
