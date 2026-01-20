import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get all OPEN trading positions grouped by trade_num
    const positions = await prisma.trading_positions.findMany({
      where: { status: 'OPEN' },
      orderBy: [
        { trade_num: 'asc' },
        { open_date: 'asc' }
      ]
    });

    // Group positions by trade_num
    const tradeGroups: { [tradeNum: string]: typeof positions } = {};
    positions.forEach(pos => {
      const key = pos.trade_num || 'unassigned';
      if (!tradeGroups[key]) tradeGroups[key] = [];
      tradeGroups[key].push(pos);
    });

    // Transform to trade objects
    const trades = Object.entries(tradeGroups).map(([tradeNum, legs]) => {
      const firstLeg = legs[0];
      const totalCostBasis = legs.reduce((sum, leg) => sum + leg.cost_basis, 0);
      
      return {
        id: firstLeg.id,
        trade_num: tradeNum,
        symbol: firstLeg.symbol,
        strategy: firstLeg.strategy || 'unknown',
        status: 'OPEN',
        open_date: firstLeg.open_date.toISOString(),
        cost_basis: totalCostBasis,
        legs: legs.map(leg => ({
          id: leg.id,
          option_type: leg.option_type,
          strike_price: leg.strike_price,
          expiration_date: leg.expiration_date?.toISOString(),
          position_type: leg.position_type,
          quantity: leg.quantity,
          open_price: leg.open_price,
          cost_basis: leg.cost_basis
        }))
      };
    });

    // Sort by trade number
    trades.sort((a, b) => {
      const numA = parseInt(a.trade_num) || 0;
      const numB = parseInt(b.trade_num) || 0;
      return numA - numB;
    });

    return NextResponse.json({ trades });
    
  } catch (error: any) {
    console.error('Open trades fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch open trades' },
      { status: 500 }
    );
  }
}
