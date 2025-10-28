import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get current statements
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { is_archived: false }
    });

    let revenue = 0, expenses = 0, assets = 0, liabilities = 0, equity = 0;
    let cashAssets = 0, currentAssets = 0;

    accounts.forEach(acc => {
      const balance = Number(acc.settled_balance) / 100;
      const type = acc.account_type.toLowerCase();
      
      if (type === 'revenue') revenue += balance;
      else if (type === 'expense') expenses += balance;
      else if (type === 'asset') {
        assets += balance;
        if (acc.code.includes('1010') || acc.code.includes('1020') || acc.code.includes('1200')) {
          cashAssets += balance;
        }
        if (acc.code.startsWith('P-1') || acc.code.startsWith('B-1')) {
          currentAssets += balance;
        }
      }
      else if (type === 'liability') liabilities += balance;
      else if (type === 'equity') equity += balance;
    });

    const netIncome = revenue - expenses;

    // Calculate profitability metrics
    const grossProfitMargin = revenue !== 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const netProfitMargin = revenue !== 0 ? (netIncome / revenue) * 100 : 0;
    const returnOnAssets = assets !== 0 ? (netIncome / assets) * 100 : 0;
    const returnOnEquity = equity !== 0 ? (netIncome / equity) * 100 : 0;

    // Calculate liquidity metrics
    const currentRatio = liabilities !== 0 ? Math.abs(currentAssets / liabilities) : 0;
    const quickRatio = liabilities !== 0 ? Math.abs((currentAssets - 0) / liabilities) : 0;
    const cashRatio = liabilities !== 0 ? Math.abs(cashAssets / liabilities) : 0;

    // Calculate efficiency metrics
    const expenseRatio = revenue !== 0 ? (expenses / revenue) * 100 : 0;
    const assetTurnover = assets !== 0 ? revenue / assets : 0;

    // Get historical data for growth calculation
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const oldJournals = await prisma.journalTransaction.findMany({
      where: {
        transactionDate: { lt: threeMonthsAgo }
      },
      include: {
        ledgerEntries: {
          include: { account: true }
        }
      }
    });

    let oldRevenue = 0, oldIncome = 0, oldAssets = 0;
    oldJournals.forEach(je => {
      je.ledgerEntries.forEach(le => {
        const amt = Number(le.amount) / 100;
        const type = le.account.account_type.toLowerCase();
        if (type === 'revenue') oldRevenue += amt;
        else if (type === 'expense') oldIncome -= amt;
        else if (type === 'asset') oldAssets += amt;
      });
    });

    const revenueGrowth = oldRevenue !== 0 ? ((revenue - oldRevenue) / Math.abs(oldRevenue)) * 100 : 0;
    const incomeGrowth = oldIncome !== 0 ? ((netIncome - oldIncome) / Math.abs(oldIncome)) * 100 : 0;
    const assetGrowth = oldAssets !== 0 ? ((assets - oldAssets) / Math.abs(oldAssets)) * 100 : 0;

    // Simple projections (linear trend)
    const revenueMonthlyGrowth = revenueGrowth / 3;
    const incomeMonthlyGrowth = incomeGrowth / 3;

    const projections = [
      {
        metric: 'Revenue',
        current: revenue,
        projected3Month: revenue * (1 + revenueMonthlyGrowth * 3 / 100),
        projected6Month: revenue * (1 + revenueMonthlyGrowth * 6 / 100),
        projected12Month: revenue * (1 + revenueMonthlyGrowth * 12 / 100),
        trend: revenueGrowth > 5 ? 'up' : revenueGrowth < -5 ? 'down' : 'stable'
      },
      {
        metric: 'Net Income',
        current: netIncome,
        projected3Month: netIncome * (1 + incomeMonthlyGrowth * 3 / 100),
        projected6Month: netIncome * (1 + incomeMonthlyGrowth * 6 / 100),
        projected12Month: netIncome * (1 + incomeMonthlyGrowth * 12 / 100),
        trend: incomeGrowth > 5 ? 'up' : incomeGrowth < -5 ? 'down' : 'stable'
      },
      {
        metric: 'Total Assets',
        current: assets,
        projected3Month: assets * 1.02,
        projected6Month: assets * 1.04,
        projected12Month: assets * 1.08,
        trend: assetGrowth > 0 ? 'up' : 'stable'
      }
    ];

    const metrics = {
      profitability: {
        grossProfitMargin,
        netProfitMargin,
        returnOnAssets,
        returnOnEquity
      },
      liquidity: {
        currentRatio,
        quickRatio,
        cashRatio
      },
      efficiency: {
        expenseRatio,
        assetTurnover
      },
      growth: {
        revenueGrowth,
        incomeGrowth,
        assetGrowth
      }
    };

    return NextResponse.json({ metrics, projections });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
