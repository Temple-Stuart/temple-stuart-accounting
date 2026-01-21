import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // ========== OPTION TRADES (from investment_transactions) ==========
    const committedTxns = await prisma.investment_transactions.findMany({
      where: {
        tradeNum: { not: null },
        accounts: { userId: user.id }
      },
      include: { security: true },
      orderBy: { date: 'asc' }
    });

    // Filter for option trades only (have "to open" or "to close" or are options)
    const optionTxns = committedTxns.filter(t => {
      const name = t.name.toLowerCase();
      const isOptionTrade = name.includes('to open') || name.includes('to close') || 
                           name.includes('call') || name.includes('put');
      const isStockTrade = t.strategy === 'stock-long' || t.strategy === 'stock-short';
      return isOptionTrade && !isStockTrade;
    });

    // Group option transactions by trade number
    const optionGroups: Record<string, typeof optionTxns> = {};
    optionTxns.forEach(txn => {
      const key = txn.tradeNum!;
      if (!optionGroups[key]) optionGroups[key] = [];
      optionGroups[key].push(txn);
    });

    // Build option trade objects
    const optionTrades = Object.entries(optionGroups).map(([tradeNum, txns]) => {
      const firstTxn = txns[0];
      
      const underlying = firstTxn.security?.option_underlying_ticker || 
                        firstTxn.security?.ticker_symbol ||
                        extractTicker(firstTxn.name);
      
      const opens = txns.filter(t => t.name.toLowerCase().includes('to open'));
      const closes = txns.filter(t => {
        const name = t.name.toLowerCase();
        return name.includes('to close') || name.includes('exercise') || name.includes('assignment');
      });
      
      // Calculate P&L for options
      const openAmount = opens.reduce((sum, t) => {
        const amount = t.amount || 0;
        const name = t.name.toLowerCase();
        const isOption = name.includes('call') || name.includes('put');
        return sum + (isOption ? amount * 100 : amount);
      }, 0);
      
      const closeAmount = closes.reduce((sum, t) => {
        const name = t.name.toLowerCase();
        const isExerciseOrAssignment = name.includes('exercise') || name.includes('assignment');
        
        if (isExerciseOrAssignment) {
          const isSellStock = name.includes('sell') && name.includes('shares');
          const amount = t.amount || 0;
          return sum + (isSellStock ? -amount : amount);
        }
        
        const amount = t.amount || 0;
        const isOption = name.includes('call') || name.includes('put');
        return sum + (isOption ? amount * 100 : amount);
      }, 0);
      
      const isClosed = closes.length > 0;
      const realizedPL = isClosed ? -(openAmount + closeAmount) : 0;

      return {
        tradeNum,
        type: 'option',
        underlying,
        strategy: firstTxn.strategy || 'unknown',
        status: isClosed ? 'CLOSED' : 'OPEN',
        openDate: firstTxn.date.toISOString(),
        closeDate: isClosed ? txns[txns.length - 1].date.toISOString() : null,
        legs: txns.length,
        realizedPL,
        transactions: txns.map(t => ({
          id: t.id,
          date: t.date,
          name: t.name,
          amount: t.amount,
          quantity: t.quantity
        }))
      };
    });

    // ========== STOCK POSITIONS (from stock_lots + lot_dispositions) ==========
    const stockLots = await prisma.stock_lots.findMany({
      where: { user_id: user.id },
      include: { dispositions: true },
      orderBy: { acquired_date: 'asc' }
    });

    // Group lots by symbol to create stock positions
    const stockBySymbol: Record<string, typeof stockLots> = {};
    stockLots.forEach(lot => {
      if (!stockBySymbol[lot.symbol]) stockBySymbol[lot.symbol] = [];
      stockBySymbol[lot.symbol].push(lot);
    });

    const stockPositions = Object.entries(stockBySymbol).map(([symbol, lots]) => {
      const totalOriginalShares = lots.reduce((sum, l) => sum + l.original_quantity, 0);
      const totalRemainingShares = lots.reduce((sum, l) => sum + l.remaining_quantity, 0);
      const totalCostBasis = lots.reduce((sum, l) => sum + l.total_cost_basis, 0);
      
      // Get all dispositions
      const allDispositions = lots.flatMap(l => l.dispositions);
      const totalProceeds = allDispositions.reduce((sum, d) => sum + d.total_proceeds, 0);
      const totalDisposedCostBasis = allDispositions.reduce((sum, d) => sum + d.cost_basis_disposed, 0);
      const realizedPL = allDispositions.reduce((sum, d) => sum + d.realized_gain_loss, 0);
      const shortTermPL = allDispositions.filter(d => !d.is_long_term).reduce((sum, d) => sum + d.realized_gain_loss, 0);
      const longTermPL = allDispositions.filter(d => d.is_long_term).reduce((sum, d) => sum + d.realized_gain_loss, 0);
      
      const firstLot = lots[0];
      const isClosed = totalRemainingShares < 0.01;
      const isPartial = totalRemainingShares > 0.01 && allDispositions.length > 0;

      return {
        tradeNum: `S-${symbol}`, // Stock positions use symbol as identifier
        type: 'stock',
        underlying: symbol,
        strategy: 'stock-long',
        status: isClosed ? 'CLOSED' : isPartial ? 'PARTIAL' : 'OPEN',
        openDate: firstLot.acquired_date.toISOString(),
        closeDate: isClosed && allDispositions.length > 0 
          ? allDispositions[allDispositions.length - 1].disposed_date.toISOString() 
          : null,
        legs: lots.length,
        shares: {
          original: totalOriginalShares,
          remaining: totalRemainingShares,
          sold: totalOriginalShares - totalRemainingShares
        },
        costBasis: totalCostBasis,
        avgCostPerShare: totalOriginalShares > 0 ? totalCostBasis / totalOriginalShares : 0,
        proceeds: totalProceeds,
        realizedPL,
        shortTermPL,
        longTermPL,
        unrealizedCostBasis: totalCostBasis - totalDisposedCostBasis,
        lots: lots.map(l => ({
          id: l.id,
          acquiredDate: l.acquired_date,
          originalQty: l.original_quantity,
          remainingQty: l.remaining_quantity,
          costPerShare: l.cost_per_share,
          status: l.status
        })),
        dispositions: allDispositions.map(d => ({
          id: d.id,
          date: d.disposed_date,
          quantity: d.quantity_disposed,
          proceeds: d.total_proceeds,
          costBasis: d.cost_basis_disposed,
          gainLoss: d.realized_gain_loss,
          isLongTerm: d.is_long_term,
          method: d.matching_method
        }))
      };
    });

    // ========== COMBINE AND SORT ==========
    const allTrades = [...optionTrades, ...stockPositions].sort((a, b) => {
      return new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
    });

    // Calculate totals
    const totalRealizedPL = allTrades.reduce((sum, t) => sum + (t.realizedPL || 0), 0);
    const openCount = allTrades.filter(t => t.status === 'OPEN' || t.status === 'PARTIAL').length;
    const closedCount = allTrades.filter(t => t.status === 'CLOSED').length;

    // Group by strategy for P&L breakdown
    const byStrategyMap: Record<string, { strategy: string; trades: number; wins: number; losses: number; realizedPL: number }> = {};
    allTrades.filter(t => t.status === 'CLOSED').forEach(t => {
      const key = t.strategy || 'unknown';
      if (!byStrategyMap[key]) {
        byStrategyMap[key] = { strategy: key, trades: 0, wins: 0, losses: 0, realizedPL: 0 };
      }
      byStrategyMap[key].trades++;
      byStrategyMap[key].realizedPL += t.realizedPL || 0;
      if ((t.realizedPL || 0) >= 0) byStrategyMap[key].wins++;
      else byStrategyMap[key].losses++;
    });
    const byStrategy = Object.values(byStrategyMap);

    // Group by ticker for P&L breakdown
    const byTickerMap: Record<string, { ticker: string; trades: number; wins: number; losses: number; realizedPL: number }> = {};
    allTrades.filter(t => t.status === 'CLOSED').forEach(t => {
      const key = t.underlying || 'UNKNOWN';
      if (!byTickerMap[key]) {
        byTickerMap[key] = { ticker: key, trades: 0, wins: 0, losses: 0, realizedPL: 0 };
      }
      byTickerMap[key].trades++;
      byTickerMap[key].realizedPL += t.realizedPL || 0;
      if ((t.realizedPL || 0) >= 0) byTickerMap[key].wins++;
      else byTickerMap[key].losses++;
    });
    const byTicker = Object.values(byTickerMap);

    return NextResponse.json({
      trades: allTrades,
      byStrategy,
      byTicker,
      summary: {
        total: allTrades.length,
        open: openCount,
        closed: closedCount,
        totalRealizedPL
      }
    });
  } catch (error) {
    console.error('Trades endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function extractTicker(name: string): string {
  const words = name.split(' ');
  for (const word of words) {
    if (/^[A-Z]{1,5}$/.test(word)) return word;
  }
  return 'UNKNOWN';
}
