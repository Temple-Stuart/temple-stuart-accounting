import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trades = await prisma.investment_transactions.findMany({
      where: {
        account: { userId: user.id },
        accountCode: { not: null },
        strategy: { not: null }
      },
      orderBy: { date: 'desc' }
    });

    const groupedByTradeNum: { [key: string]: any[] } = {};
    
    trades.forEach(trade => {
      const key = trade.tradeNum || trade.id;
      if (!groupedByTradeNum[key]) {
        groupedByTradeNum[key] = [];
      }
      groupedByTradeNum[key].push(trade);
    });

    const tradeGroups = Object.entries(groupedByTradeNum).map(([tradeNum, legs]) => {
      const totalPL = legs.reduce((sum, leg) => sum + (leg.amount || 0), 0);
      const totalFees = legs.reduce((sum, leg) => sum + (leg.fees || 0), 0);
      const netPL = totalPL - totalFees;
      
      return {
        tradeNum,
        strategy: legs[0].strategy,
        symbol: legs[0].name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) || 'Unknown',
        entryDate: legs[0].date,
        exitDate: legs[legs.length - 1].date,
        legs: legs.length,
        totalPL,
        totalFees,
        netPL,
        isWinner: netPL > 0,
        trades: legs
      };
    });

    return NextResponse.json(tradeGroups);
  } catch (error) {
    console.error('Trading journal error:', error);
    return NextResponse.json({ error: 'Failed to fetch trading journal' }, { status: 500 });
  }
}
