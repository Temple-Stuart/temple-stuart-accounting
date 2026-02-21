import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
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

    // SECURITY: Scoped to user's COA only
    const transactions = await prisma.journal_transactions.findMany({
      where: {
        ledger_entries: {
          some: {
            chart_of_accounts: { userId: user.id }
          }
        }
      },
      include: {
        ledger_entries: {
          include: {
            chart_of_accounts: {
              select: {
                code: true,
                name: true,
                account_type: true
              }
            }
          }
        }
      },
      orderBy: [
        { transaction_date: 'desc' },
        { created_at: 'desc' }
      ]
    });

    const reversalCount = transactions.filter(t => t.is_reversal).length;

    const entries = transactions.map(t => ({
      id: t.id,
      transaction_date: t.transaction_date,
      description: t.description,
      is_reversal: t.is_reversal,
      reverses_journal_id: t.reverses_journal_id,
      reversed_by_transaction_id: t.reversed_by_transaction_id,
      reversal_date: t.reversal_date,
      account_code: t.account_code,
      amount: t.amount,
      strategy: t.strategy,
      trade_num: t.trade_num,
      created_at: t.created_at,
      posted_at: t.posted_at,
      ledger_entries: t.ledger_entries.map(entry => ({
        id: entry.id,
        account_id: entry.account_id,
        amount: Number(entry.amount),
        entry_type: entry.entry_type,
        chart_of_accounts: entry.chart_of_accounts
      }))
    }));

    return NextResponse.json({
      entries,
      totalCount: entries.length,
      reversalCount
    });
  } catch (error) {
    console.error('Journal transactions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal transactions' }, { status: 500 });
  }
}
