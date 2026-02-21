import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
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

    // Optional filter by account code
    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get('accountCode');

    // SECURITY: Scoped to user's COA only
    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: {
        chart_of_accounts: {
          userId: user.id,
          ...(accountCode ? { code: accountCode } : {})
        }
      },
      include: {
        chart_of_accounts: true,
        journal_transactions: true
      },
      orderBy: [
        { account_id: 'asc' },
        { created_at: 'asc' }
      ]
    });

    // Group entries by account
    const accountMap = new Map<string, any>();

    ledgerEntries.forEach(entry => {
      const accountId = entry.account_id;

      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, {
          accountCode: entry.chart_of_accounts.code,
          accountName: entry.chart_of_accounts.name,
          accountType: entry.chart_of_accounts.account_type,
          balanceType: entry.chart_of_accounts.balance_type,
          entries: [],
          runningBalance: 0
        });
      }

      const account = accountMap.get(accountId);

      const isNormalBalance = entry.entry_type === entry.chart_of_accounts.balance_type;
      const change = isNormalBalance ? Number(entry.amount) : -Number(entry.amount);
      account.runningBalance += change;

      account.entries.push({
        id: entry.id,
        date: entry.journal_transactions.transaction_date,
        description: entry.journal_transactions.description || 'No description',
        entryType: entry.entry_type,
        amount: Number(entry.amount) / 100,
        runningBalance: account.runningBalance / 100,
        journal_id: entry.journal_transactions.id,
        is_reversal: entry.journal_transactions.is_reversal ?? false,
        reversed_by_transaction_id: entry.journal_transactions.reversed_by_transaction_id ?? null
      });
    });

    const ledgers = Array.from(accountMap.values()).map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      balanceType: account.balanceType,
      entries: account.entries,
      openingBalance: 0,
      closingBalance: account.runningBalance / 100
    }));

    return NextResponse.json({ ledgers });
  } catch (error) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
