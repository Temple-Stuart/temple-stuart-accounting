import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: { accounts: true }
    });

    // Get investment data
    let allTransactions = [];
    let holdings = [];
    
    for (const item of plaidItems) {
      try {
        // Get holdings
        const holdingsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken
        });
        holdings = holdings.concat(holdingsResponse.data.holdings);

        // Get transactions
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactionsResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate
        });
        
        allTransactions = allTransactions.concat(transactionsResponse.data.investment_transactions);
      } catch (error) {
        console.log(`No investment data for ${item.institutionName}`);
      }
    }

    // Analyze spreads (pair buy/sell on same date)
    const byDate = {};
    allTransactions.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = [];
      byDate[t.date].push(t);
    });

    let totalPL = 0;
    let wins = 0;
    let losses = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;

    Object.keys(byDate).forEach(date => {
      const dayTxns = byDate[date].filter(t => t.type !== 'transfer');
      if (dayTxns.length >= 2) {
        const netAmount = dayTxns.reduce((sum, t) => sum + t.amount, 0);
        if (netAmount < 0) { // Credit (we collected money)
          wins++;
          totalWinAmount += Math.abs(netAmount);
        } else { // Debit (we paid money)
          losses++;
          totalLossAmount += netAmount;
        }
        totalPL += netAmount;
      }
    });

    const winRate = wins / (wins + losses) * 100;
    const avgWin = wins > 0 ? totalWinAmount / wins : 0;
    const avgLoss = losses > 0 ? totalLossAmount / losses : 0;
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0;

    return NextResponse.json({
      performance: {
        totalPL: -totalPL, // Negative because credits are negative in Plaid
        winRate: winRate.toFixed(1),
        wins,
        losses,
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        totalTrades: wins + losses
      },
      activePositions: holdings.length,
      recentTrades: allTransactions.slice(0, 10)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
