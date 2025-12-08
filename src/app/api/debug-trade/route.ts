import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AMD';
  const date = searchParams.get('date') || '2025-06-20';
  
  const txns = await prisma.investment_transactions.findMany({
    where: {
      security: {
        option_underlying_ticker: symbol
      },
      date: {
        gte: new Date(date + 'T00:00:00Z'),
        lte: new Date(date + 'T23:59:59Z')
      }
    },
    include: { security: true },
    orderBy: { date: 'asc' }
  });
  
  await prisma.$disconnect();
  
  return NextResponse.json({
    symbol,
    date,
    count: txns.length,
    transactions: txns.map(t => ({
      id: t.investment_transaction_id,
      date: t.date,
      name: t.name,
      type: t.type,
      strike: t.security?.option_strike_price,
      optionType: t.security?.option_contract_type,
      price: t.price,
      quantity: t.quantity,
      amount: t.amount
    }))
  });
}
