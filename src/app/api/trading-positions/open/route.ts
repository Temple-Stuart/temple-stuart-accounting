import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const openPositions = await prisma.trading_positions.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        trade_num: true,
        symbol: true,
        strike_price: true,
        option_type: true,
        position_type: true,
        strategy: true,
        status: true
      }
    });
    
    return NextResponse.json(openPositions);
  } catch (error) {
    console.error('Error fetching open positions:', error);
    return NextResponse.json([], { status: 500 });
  }
}
