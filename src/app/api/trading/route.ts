import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's accounts
    const userAccounts = await prisma.accounts.findMany({
      where: { userId: user.id },
      select: { id: true }
    });
    const accountIds = userAccounts.map(a => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({
        summary: { totalRealizedPL: 0, openPositionsCount: 0, totalContributions: 0, totalWithdrawals: 0 },
        byStrategy: [],
        openPositions: [],
        recentTrades: [],
        recentTransactions: []
      });
    }

    // Get trading COA codes
    const tradingCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'trading' },
      select: { code: true, name: true, account_type: true }
    });

    const codes = tradingCodes.map(c => c.code);

    // Get transactions filtered by user's accounts
    const transactions = await prisma.transactions.findMany({
      where: { 
        accountCode: { in: codes },
        accountId: { in: accountIds }
      },
      orderBy: { date: 'desc' }
    });

    // Get investment transactions filtered by user's accounts
    const investmentTxns = await prisma.investment_transactions.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { date: 'desc' },
      take: 100,
      include: { security: true }
    });

    // Get investment txn IDs for this user to filter positions
    const userInvestmentTxnIds = investmentTxns.map(t => t.id);

    // Get positions - filter by investment txns that belong to user
    const openPositions = await prisma.trading_positions.findMany({
      where: { 
        status: 'OPEN',
        open_investment_txn_id: { in: userInvestmentTxnIds }
      },
      orderBy: { open_date: 'desc' }
    });

    const closedPositions = await prisma.trading_positions.findMany({
      where: { 
        status: 'CLOSED',
        open_investment_txn_id: { in: userInvestmentTxnIds }
      },
      orderBy: { close_date: 'desc' }
    });

    // Get stock lots for this user
    const stockLots = await prisma.stock_lots.findMany({
      where: { user_id: user.id },
      include: { dispositions: true }
    });

    // Calculate stock P&L from dispositions
    const stockRealizedPL = stockLots.reduce((sum, lot) => {
      return sum + lot.dispositions.reduce((dSum, d) => dSum + d.realized_gain_loss, 0);
    }, 0);

    const openStockLots = stockLots.filter(l => l.status === 'OPEN' || l.status === 'PARTIAL');
    const closedStockLots = stockLots.filter(l => l.status === 'CLOSED');

    // Calculate P&L (options + stocks)
    const optionRealizedPL = closedPositions.reduce((sum, p) => sum + (p.realized_pl || 0), 0);
    const totalRealizedPL = optionRealizedPL + stockRealizedPL;

    // Group by strategy
    const byStrategy: Record<string, { total: number; count: number }> = {};
    closedPositions.forEach(p => {
      const strategy = p.strategy || 'Unknown';
      if (!byStrategy[strategy]) byStrategy[strategy] = { total: 0, count: 0 };
      byStrategy[strategy].total += p.realized_pl || 0;
      byStrategy[strategy].count += 1;
    });

    // Contributions/Withdrawals
    const contributions = transactions
      .filter(t => t.accountCode === 'T-3200')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const withdrawals = transactions
      .filter(t => t.accountCode === 'T-3300')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return NextResponse.json({
      summary: {
        totalRealizedPL,
        optionRealizedPL,
        stockRealizedPL,
        openPositionsCount: openPositions.length + openStockLots.length,
        closedTradeCount: closedPositions.length + closedStockLots.length,
        totalContributions: contributions,
        totalWithdrawals: withdrawals
      },
      byStrategy: Object.entries(byStrategy)
        .map(([strategy, data]) => ({ strategy, ...data }))
        .sort((a, b) => b.total - a.total),
      openPositions: openPositions.slice(0, 20).map(p => ({
        id: p.id,
        symbol: p.symbol,
        quantity: p.quantity,
        avgCost: p.open_price,
        strategy: p.strategy,
        openDate: p.open_date
      })),
      recentTrades: investmentTxns.slice(0, 20).map(t => ({
        id: t.id,
        date: t.date,
        symbol: t.security?.ticker_symbol || 'N/A',
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        amount: t.amount
      })),
      recentTransactions: transactions.slice(0, 15).map(t => ({
        id: t.id,
        date: t.date,
        name: t.name,
        amount: t.amount,
        accountCode: t.accountCode
      }))
    });
  } catch (error) {
    console.error('Trading API error:', error);
    return NextResponse.json({ error: 'Failed to fetch trading data' }, { status: 500 });
  }
}
