import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get all committed investment transactions (have tradeNum assigned)
    const committedTxns = await prisma.investment_transactions.findMany({
      where: {
        tradeNum: { not: null }
      },
      include: { security: true },
      orderBy: { date: 'asc' }
    });

    // Get journal transactions with trade numbers for P&L data
    const journalTxns = await prisma.journal_transactions.findMany({
      where: {
        trade_num: { not: null }
      },
      include: {
        ledger_entries: {
          include: { chart_of_accounts: true }
        }
      },
      orderBy: { transaction_date: 'asc' }
    });

    // Group investment transactions by trade number
    const tradeGroups: Record<string, typeof committedTxns> = {};
    committedTxns.forEach(txn => {
      const key = txn.tradeNum!;
      if (!tradeGroups[key]) tradeGroups[key] = [];
      tradeGroups[key].push(txn);
    });

    // Build trade objects
    const trades = Object.entries(tradeGroups).map(([tradeNum, txns]) => {
      const firstTxn = txns[0];
      const lastTxn = txns[txns.length - 1];
      
      // Get underlying symbol
      const underlying = firstTxn.security?.option_underlying_ticker || 
                        firstTxn.security?.ticker_symbol ||
                        extractTicker(firstTxn.name);
      
      // Separate opens and closes
      const opens = txns.filter(t => t.name.toLowerCase().includes('to open'));
      const closes = txns.filter(t => {
        const name = t.name.toLowerCase();
        return name.includes('to close') || name.includes('exercise') || name.includes('assignment');
      });
      
      // Calculate totals
      // Option amounts are per-contract, multiply by 100 for total
      // (Stock amounts from exercise/assignment are already total)
      const openAmount = opens.reduce((sum, t) => {
        const amount = t.amount || 0;
        // Options have "call" or "put" in the name
        const name = t.name.toLowerCase();
        const isOption = name.includes('call') || name.includes('put');
        return sum + (isOption ? amount * 100 : amount);
      }, 0);
      
      // For closes, need to handle exercise/assignment specially
      // Exercise/assignment stock transactions have positive amounts regardless of buy/sell
      // We need to check the name to determine the actual cash flow direction
      const closeAmount = closes.reduce((sum, t) => {
        const name = t.name.toLowerCase();
        const isExerciseOrAssignment = name.includes('exercise') || name.includes('assignment');
        
        if (isExerciseOrAssignment) {
          // For stock transactions from exercise/assignment:
          // - "sell X shares" in name = you receive money (negative amount for P&L calc)
          // - "buy X shares" in name = you pay money (positive amount for P&L calc)
          const isSellStock = name.includes('sell') && name.includes('shares');
          const amount = t.amount || 0;
          return sum + (isSellStock ? -amount : amount);
        }
        
        // Normal option close: multiply by 100 for total
        const amount = t.amount || 0;
        const isOption = name.includes('call') || name.includes('put');
        return sum + (isOption ? amount * 100 : amount);
      }, 0);
      
      let realizedPL = 0;
      const isClosed = closes.length > 0;
      
      if (isClosed) {
        // P&L = -(openAmount + closeAmount)
        // For credit spread: openAmount is negative (received credit)
        // For normal close: closeAmount reflects what you paid/received to close
        // For exercise/assignment: closeAmount is now correctly signed
        realizedPL = -(openAmount + closeAmount);
      }
      
      // Get journal entries for this trade to find P&L from ledger
      const tradeJournals = journalTxns.filter(j => j.trade_num === tradeNum);
      let ledgerPL = 0;
      tradeJournals.forEach(j => {
        j.ledger_entries.forEach(entry => {
          const code = entry.chart_of_accounts.code;
          const amount = Number(entry.amount) / 100;
          if (code.startsWith('T-4')) {
            ledgerPL += entry.entry_type === 'C' ? amount : -amount;
          } else if (code.startsWith('T-5')) {
            ledgerPL -= entry.entry_type === 'D' ? amount : -amount;
          }
        });
      });

      return {
        tradeNum,
        underlying,
        strategy: firstTxn.strategy || 'unknown',
        status: isClosed ? 'CLOSED' : 'OPEN',
        openDate: firstTxn.date.toISOString(),
        closeDate: isClosed ? lastTxn.date.toISOString() : null,
        legs: txns.length,
        openLegs: opens.length,
        closeLegs: closes.length,
        openAmount: Math.abs(openAmount),
        closeAmount: Math.abs(closeAmount),
        realizedPL: ledgerPL !== 0 ? ledgerPL : realizedPL,
        transactions: txns.map(t => ({
          id: t.id,
          date: t.date.toISOString(),
          name: t.name,
          type: t.type,
          quantity: t.quantity,
          price: t.price,
          amount: t.amount,
          isOpen: t.name.toLowerCase().includes('to open'),
          isClose: t.name.toLowerCase().includes('to close')
        }))
      };
    });

    // Sort by open date descending
    trades.sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime());

    // Calculate summary stats
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const openTrades = trades.filter(t => t.status === 'OPEN');
    
    const totalRealizedPL = closedTrades.reduce((sum, t) => sum + t.realizedPL, 0);
    const winners = closedTrades.filter(t => t.realizedPL > 0);
    const losers = closedTrades.filter(t => t.realizedPL < 0);
    const winRate = closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0;
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.realizedPL, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.realizedPL, 0) / losers.length : 0;

    // P&L by ticker
    const byTicker: Record<string, { count: number; pl: number; wins: number; losses: number }> = {};
    closedTrades.forEach(t => {
      const ticker = t.underlying || 'UNKNOWN';
      if (!byTicker[ticker]) byTicker[ticker] = { count: 0, pl: 0, wins: 0, losses: 0 };
      byTicker[ticker].count++;
      byTicker[ticker].pl += t.realizedPL;
      if (t.realizedPL > 0) byTicker[ticker].wins++;
      else if (t.realizedPL < 0) byTicker[ticker].losses++;
    });

    // P&L by strategy
    const byStrategy: Record<string, { count: number; pl: number; wins: number; losses: number }> = {};
    closedTrades.forEach(t => {
      const strategy = t.strategy || 'unknown';
      if (!byStrategy[strategy]) byStrategy[strategy] = { count: 0, pl: 0, wins: 0, losses: 0 };
      byStrategy[strategy].count++;
      byStrategy[strategy].pl += t.realizedPL;
      if (t.realizedPL > 0) byStrategy[strategy].wins++;
      else if (t.realizedPL < 0) byStrategy[strategy].losses++;
    });

    return NextResponse.json({
      summary: {
        totalTrades: trades.length,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
        totalRealizedPL,
        winRate: Math.round(winRate * 10) / 10,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0
      },
      trades,
      byTicker: Object.entries(byTicker)
        .map(([ticker, data]) => ({ ticker, ...data }))
        .sort((a, b) => b.pl - a.pl),
      byStrategy: Object.entries(byStrategy)
        .map(([strategy, data]) => ({ strategy, ...data }))
        .sort((a, b) => b.pl - a.pl)
    });

  } catch (error: any) {
    console.error('Trades API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function extractTicker(name: string): string {
  const match = name.match(/([A-Z]{1,5})\d{6}[CP]\d+/);
  if (match) return match[1];
  const words = name.split(' ');
  for (const word of words) {
    if (/^[A-Z]{1,5}$/.test(word)) return word;
  }
  return 'UNKNOWN';
}
