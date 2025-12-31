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

    // Get all trading COA codes (T-entity + P-5XXX)
    const tradingCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'trading' },
      select: { code: true, name: true, account_type: true }
    });

    const codes = tradingCodes.map(c => c.code);

    // Get transactions
    const transactions = await prisma.transactions.findMany({
      where: { accountCode: { in: codes } },
      orderBy: { date: 'desc' }
    });

    // Get investment transactions (actual trades)
    const investmentTxns = await prisma.investment_transactions.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      include: { security: true }
    });

    // Get open positions
    const openPositions = await prisma.trading_positions.findMany({
      where: { status: 'OPEN' },
      orderBy: { open_date: 'desc' }
    });

    // Get closed positions for P&L
    const closedPositions = await prisma.trading_positions.findMany({
      where: { status: 'CLOSED' },
      orderBy: { close_date: 'desc' },
      take: 50
    });

    // Calculate P&L
    const totalRealizedPL = closedPositions.reduce((sum, p) => sum + (p.realized_pl || 0), 0);
    const totalUnrealizedPL = openPositions.reduce((sum, p) => {
      // Simplified - would need current prices for accurate unrealized P&L
      return sum;
    }, 0);

    // Group by strategy
    const byStrategy: Record<string, { count: number; realizedPL: number }> = {};
    closedPositions.forEach(p => {
      const strategy = p.strategy || 'Unknown';
      if (!byStrategy[strategy]) byStrategy[strategy] = { count: 0, realizedPL: 0 };
      byStrategy[strategy].count += 1;
      byStrategy[strategy].realizedPL += p.realized_pl || 0;
    });

    // Capital flows (T-3200 contributions, T-3300 withdrawals)
    const contributions = transactions
      .filter(t => t.accountCode === 'T-3200')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const withdrawals = transactions
      .filter(t => t.accountCode === 'T-3300')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return NextResponse.json({
      summary: {
        totalRealizedPL,
        totalUnrealizedPL,
        openPositionCount: openPositions.length,
        closedTradeCount: closedPositions.length,
        contributions,
        withdrawals,
        netCapitalFlow: contributions - withdrawals
      },
      openPositions: openPositions.slice(0, 20).map(p => ({
        id: p.id,
        symbol: p.symbol,
        optionType: p.option_type,
        strikePrice: p.strike_price,
        expirationDate: p.expiration_date,
        quantity: p.quantity,
        costBasis: p.cost_basis,
        openDate: p.open_date,
        strategy: p.strategy
      })),
      closedPositions: closedPositions.slice(0, 20).map(p => ({
        id: p.id,
        symbol: p.symbol,
        optionType: p.option_type,
        strikePrice: p.strike_price,
        quantity: p.quantity,
        realizedPL: p.realized_pl,
        openDate: p.open_date,
        closeDate: p.close_date,
        strategy: p.strategy
      })),
      byStrategy: Object.entries(byStrategy).map(([strategy, data]) => ({
        strategy,
        ...data
      })),
      recentTrades: investmentTxns.slice(0, 20).map(t => ({
        id: t.id,
        date: t.date,
        name: t.name,
        type: t.type,
        subtype: t.subtype,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount,
        ticker: t.security?.ticker_symbol
      }))
    });
  } catch (error) {
    console.error('Trading API error:', error);
    return NextResponse.json({ error: 'Failed to fetch trading data' }, { status: 500 });
  }
}
