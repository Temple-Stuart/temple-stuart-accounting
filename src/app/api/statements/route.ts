import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ensureBookkeepingInitialized(user);

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build COA filter: user-scoped, optionally entity-scoped
    const coaWhere: any = { userId: user.id, is_archived: false };
    if (entityId) {
      coaWhere.entity_id = entityId;
    }

    const accounts = await prisma.chart_of_accounts.findMany({
      where: coaWhere
    });

    // If date range provided, calculate balances from ledger entries within that period
    // Otherwise use settled_balance (all-time)
    const useDateFilter = !!(startDate && endDate);

    let revenue = BigInt(0);
    let expenses = BigInt(0);
    let assets = BigInt(0);
    let liabilities = BigInt(0);
    let equity = BigInt(0);

    if (useDateFilter) {
      const start = new Date(startDate!);
      const end = new Date(endDate!);

      // For income statement accounts (revenue, expense): sum ledger entries in date range
      // For balance sheet accounts (asset, liability, equity): use settled_balance (point-in-time)
      for (const acc of accounts) {
        const type = acc.account_type.toLowerCase();

        if (type === 'revenue' || type === 'expense') {
          // Calculate from ledger entries within date range
          const entries = await prisma.ledger_entries.findMany({
            where: {
              account_id: acc.id,
              journal_entry: {
                date: { gte: start, lte: end },
                status: 'posted',
              },
            },
            select: { amount: true, entry_type: true },
          });

          let net = BigInt(0);
          for (const e of entries) {
            if (e.entry_type === acc.balance_type) {
              net += e.amount;
            } else {
              net -= e.amount;
            }
          }

          if (type === 'revenue') revenue += net;
          else expenses += net;
        } else {
          // Balance sheet: use settled_balance
          const balance = acc.settled_balance;
          if (type === 'asset') assets += balance;
          else if (type === 'liability') liabilities += balance;
          else if (type === 'equity') equity += balance;
        }
      }
    } else {
      // No date filter: use settled_balance for everything
      for (const acc of accounts) {
        const balance = acc.settled_balance;
        const type = acc.account_type.toLowerCase();

        if (type === 'revenue') revenue += balance;
        else if (type === 'expense') expenses += balance;
        else if (type === 'asset') assets += balance;
        else if (type === 'liability') liabilities += balance;
        else if (type === 'equity') equity += balance;
      }
    }

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
