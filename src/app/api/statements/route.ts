import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { is_archived: false }
    });

    let revenue = BigInt(0);
    let expenses = BigInt(0);
    let assets = BigInt(0);
    let liabilities = BigInt(0);
    let equity = BigInt(0);

    accounts.forEach(acc => {
      const balance = acc.settled_balance;
      const type = acc.account_type.toLowerCase();
      
      if (type === 'revenue') {
        revenue += balance;
      } else if (type === 'expense') {
        expenses += balance;
      } else if (type === 'asset') {
        assets += balance;
      } else if (type === 'liability') {
        liabilities += balance;
      } else if (type === 'equity') {
        equity += balance;
      }
    });

    const netIncome = revenue - expenses;

    return NextResponse.json({
      incomeStatement: {
        revenue: Number(revenue) / 100,
        expenses: Number(expenses) / 100,
        netIncome: Number(netIncome) / 100
      },
      balanceSheet: {
        assets: Number(assets) / 100,
        liabilities: Number(liabilities) / 100,
        equity: Number(equity) / 100
      }
    });
  } catch (error) {
    console.error('Statements error:', error);
    return NextResponse.json({ error: 'Failed to generate statements' }, { status: 500 });
  }
}
