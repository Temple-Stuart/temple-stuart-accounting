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

    // Query ALL trading positions (both OPEN and CLOSED)
    const positions = await prisma.trading_positions.findMany({
      where: {
        status: 'CLOSED'  // Only show completed trades
      },
      orderBy: { close_date: 'desc' }
    });

    console.log(`Found ${positions.length} closed positions`);

    // Group positions by trade_num
    const groupedByTradeNum: { [key: string]: any[] } = {};
    
    positions.forEach(position => {
      const key = position.trade_num || position.id;
      if (!groupedByTradeNum[key]) {
        groupedByTradeNum[key] = [];
      }
      groupedByTradeNum[key].push(position);
    });

    const tradeGroups = Object.entries(groupedByTradeNum).map(([tradeNum, legs]) => {
      // Use calculated realized_pl from position tracker (IRS-compliant)
      const totalPL = legs.reduce((sum, leg) => sum + (Number(leg.realized_pl) || 0), 0);
      const totalFees = legs.reduce((sum, leg) => sum + (Number(leg.open_fees) || 0) + (Number(leg.close_fees) || 0), 0);
      const netPL = totalPL;
      
      const firstLeg = legs[0];
      const lastLeg = legs[legs.length - 1];
      
      return {
        tradeNum,
        strategy: firstLeg.strategy || 'Unknown',
        symbol: firstLeg.symbol,
        entryDate: firstLeg.open_date,
        exitDate: lastLeg.close_date || lastLeg.open_date,
        legs: legs.length,
        totalPL,
        totalFees,
        netPL,
        isWinner: netPL > 0,
        trades: legs.map(leg => ({
          id: leg.id,
          date: leg.open_date,
          name: `${leg.position_type} ${leg.symbol} $${leg.strike_price} ${leg.option_type}`,
          quantity: leg.quantity,
          price: Number(leg.open_price),
          amount: Number(leg.realized_pl),
          fees: Number(leg.open_fees) + Number(leg.close_fees)
        }))
      };
    });

    return NextResponse.json(tradeGroups);
  } catch (error) {
    console.error('Trading journal error:', error);
    return NextResponse.json({ error: 'Failed to fetch trading journal' }, { status: 500 });
  }
}
