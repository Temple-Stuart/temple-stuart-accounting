import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // ========== OPTION POSITIONS ==========
    // Get all user investment txn IDs for scoping
    const userAccounts = await prisma.accounts.findMany({
      where: { userId: user.id },
      select: { id: true }
    });
    const accountIds = userAccounts.map(a => a.id);

    const userInvestmentTxnIds = accountIds.length > 0
      ? (await prisma.investment_transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: { id: true }
        })).map(t => t.id)
      : [];

    const allOptionPositions = userInvestmentTxnIds.length > 0
      ? await prisma.trading_positions.findMany({
          where: { open_investment_txn_id: { in: userInvestmentTxnIds } },
          orderBy: { open_date: 'asc' }
        })
      : [];

    const openOptions = allOptionPositions.filter(p => p.status === 'OPEN');
    const closedOptions = allOptionPositions.filter(p => p.status === 'CLOSED');

    // Option P&L
    const optionRealizedPL = closedOptions.reduce((sum, p) => sum + (p.realized_pl || 0), 0);

    // ========== STOCK POSITIONS (from stock_lots + lot_dispositions) ==========
    const stockLots = await prisma.stock_lots.findMany({
      where: { user_id: user.id },
      include: { dispositions: true },
      orderBy: { acquired_date: 'asc' }
    });

    // Group lots by symbol
    const stockBySymbol: Record<string, typeof stockLots> = {};
    stockLots.forEach(lot => {
      if (!stockBySymbol[lot.symbol]) stockBySymbol[lot.symbol] = [];
      stockBySymbol[lot.symbol].push(lot);
    });

    // Build stock position summaries
    const stockPositions = Object.entries(stockBySymbol).map(([symbol, lots]) => {
      const totalOriginalShares = lots.reduce((sum, l) => sum + l.original_quantity, 0);
      const totalRemainingShares = lots.reduce((sum, l) => sum + l.remaining_quantity, 0);
      const totalCostBasis = lots.reduce((sum, l) => sum + l.total_cost_basis, 0);

      const allDispositions = lots.flatMap(l => l.dispositions);
      const totalProceeds = allDispositions.reduce((sum, d) => sum + d.total_proceeds, 0);
      const totalDisposedCostBasis = allDispositions.reduce((sum, d) => sum + d.cost_basis_disposed, 0);
      const realizedPL = allDispositions.reduce((sum, d) => sum + d.realized_gain_loss, 0);
      const shortTermPL = allDispositions.filter(d => !d.is_long_term).reduce((sum, d) => sum + d.realized_gain_loss, 0);
      const longTermPL = allDispositions.filter(d => d.is_long_term).reduce((sum, d) => sum + d.realized_gain_loss, 0);

      const isClosed = totalRemainingShares < 0.01;
      const isPartial = totalRemainingShares > 0.01 && allDispositions.length > 0;

      return {
        symbol,
        type: 'stock' as const,
        status: isClosed ? 'CLOSED' as const : isPartial ? 'PARTIAL' as const : 'OPEN' as const,
        shares: { original: totalOriginalShares, remaining: totalRemainingShares },
        costBasis: totalCostBasis,
        remainingCostBasis: totalCostBasis - totalDisposedCostBasis,
        avgCostPerShare: totalOriginalShares > 0 ? totalCostBasis / totalOriginalShares : 0,
        proceeds: totalProceeds,
        realizedPL,
        shortTermPL,
        longTermPL,
        openDate: lots[0].acquired_date.toISOString(),
        closeDate: isClosed && allDispositions.length > 0
          ? allDispositions[allDispositions.length - 1].disposed_date.toISOString()
          : null,
        lotCount: lots.length,
        dispositionCount: allDispositions.length
      };
    });

    // Stock P&L totals
    const stockRealizedPL = stockPositions.reduce((sum, p) => sum + p.realizedPL, 0);
    const stockShortTermPL = stockPositions.reduce((sum, p) => sum + p.shortTermPL, 0);
    const stockLongTermPL = stockPositions.reduce((sum, p) => sum + p.longTermPL, 0);

    // ========== OPEN OPTION POSITION DETAILS ==========
    const openOptionDetails = openOptions.map(p => ({
      id: p.id,
      symbol: p.symbol,
      type: 'option' as const,
      optionType: p.option_type,
      positionType: p.position_type,
      strike: p.strike_price,
      expiration: p.expiration_date?.toISOString() ?? null,
      quantity: p.quantity,
      remainingQuantity: p.remaining_quantity,
      costBasis: p.cost_basis,
      openPrice: p.open_price,
      openDate: p.open_date.toISOString(),
      strategy: p.strategy,
      tradeNum: p.trade_num
    }));

    // ========== CLOSED OPTION POSITION DETAILS ==========
    const closedOptionDetails = closedOptions.map(p => ({
      id: p.id,
      symbol: p.symbol,
      type: 'option' as const,
      optionType: p.option_type,
      positionType: p.position_type,
      strike: p.strike_price,
      expiration: p.expiration_date?.toISOString() ?? null,
      quantity: p.quantity,
      costBasis: p.cost_basis,
      proceeds: p.proceeds,
      realizedPL: p.realized_pl || 0,
      openDate: p.open_date.toISOString(),
      closeDate: p.close_date?.toISOString() ?? null,
      strategy: p.strategy,
      tradeNum: p.trade_num,
      holdingDays: p.close_date && p.open_date
        ? Math.floor((p.close_date.getTime() - p.open_date.getTime()) / (24 * 60 * 60 * 1000))
        : null,
      isLongTerm: p.close_date && p.open_date
        ? Math.floor((p.close_date.getTime() - p.open_date.getTime()) / (24 * 60 * 60 * 1000)) >= 365
        : false
    }));

    // Option ST/LT breakdown
    const optionShortTermPL = closedOptionDetails.filter(p => !p.isLongTerm).reduce((sum, p) => sum + p.realizedPL, 0);
    const optionLongTermPL = closedOptionDetails.filter(p => p.isLongTerm).reduce((sum, p) => sum + p.realizedPL, 0);

    // ========== OPEN STOCK POSITION DETAILS ==========
    const openStockPositions = stockPositions.filter(p => p.status !== 'CLOSED');
    const closedStockPositions = stockPositions.filter(p => p.status === 'CLOSED');

    // ========== COMBINED SUMMARY ==========
    const totalRealizedPL = optionRealizedPL + stockRealizedPL;
    const totalShortTermPL = optionShortTermPL + stockShortTermPL;
    const totalLongTermPL = optionLongTermPL + stockLongTermPL;

    // Strategy breakdown (closed positions only)
    const byStrategy: Record<string, { strategy: string; count: number; wins: number; losses: number; pl: number }> = {};
    closedOptions.forEach(p => {
      const key = p.strategy || 'unknown';
      if (!byStrategy[key]) byStrategy[key] = { strategy: key, count: 0, wins: 0, losses: 0, pl: 0 };
      byStrategy[key].count++;
      byStrategy[key].pl += p.realized_pl || 0;
      if ((p.realized_pl || 0) >= 0) byStrategy[key].wins++;
      else byStrategy[key].losses++;
    });
    closedStockPositions.forEach(p => {
      const key = 'stock-long';
      if (!byStrategy[key]) byStrategy[key] = { strategy: key, count: 0, wins: 0, losses: 0, pl: 0 };
      byStrategy[key].count++;
      byStrategy[key].pl += p.realizedPL;
      if (p.realizedPL >= 0) byStrategy[key].wins++;
      else byStrategy[key].losses++;
    });

    // Win/loss metrics
    const closedTrades = [...closedOptionDetails, ...closedStockPositions];
    const wins = closedTrades.filter(t => (t.realizedPL || 0) >= 0);
    const losses = closedTrades.filter(t => (t.realizedPL || 0) < 0);
    const totalWinAmount = wins.reduce((sum, t) => sum + (t.realizedPL || 0), 0);
    const totalLossAmount = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPL || 0), 0));

    return NextResponse.json({
      summary: {
        totalRealizedPL: Math.round(totalRealizedPL * 100) / 100,
        optionRealizedPL: Math.round(optionRealizedPL * 100) / 100,
        stockRealizedPL: Math.round(stockRealizedPL * 100) / 100,
        shortTermPL: Math.round(totalShortTermPL * 100) / 100,
        longTermPL: Math.round(totalLongTermPL * 100) / 100,
        openPositions: openOptions.length + openStockPositions.length,
        closedPositions: closedOptions.length + closedStockPositions.length,
        winRate: closedTrades.length > 0
          ? Math.round((wins.length / closedTrades.length) * 100)
          : 0,
        avgWin: wins.length > 0 ? Math.round((totalWinAmount / wins.length) * 100) / 100 : 0,
        avgLoss: losses.length > 0 ? Math.round((-totalLossAmount / losses.length) * 100) / 100 : 0,
        profitFactor: totalLossAmount > 0
          ? Math.round((totalWinAmount / totalLossAmount) * 100) / 100
          : totalWinAmount > 0 ? 999 : 0,
      },
      byStrategy: Object.values(byStrategy).sort((a, b) => b.pl - a.pl),
      openPositions: {
        options: openOptionDetails,
        stocks: openStockPositions
      },
      closedPositions: {
        options: closedOptionDetails.sort((a, b) =>
          new Date(b.closeDate || 0).getTime() - new Date(a.closeDate || 0).getTime()
        ),
        stocks: closedStockPositions.sort((a, b) =>
          new Date(b.closeDate || 0).getTime() - new Date(a.closeDate || 0).getTime()
        )
      }
    });
  } catch (error) {
    console.error('Position summary error:', error);
    return NextResponse.json({ error: 'Failed to generate position summary' }, { status: 500 });
  }
}
