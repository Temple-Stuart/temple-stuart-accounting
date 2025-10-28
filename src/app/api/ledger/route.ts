import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ledgerEntries = await prisma.ledger_entries.findMany({
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
      
      // Calculate running balance
      const isNormalBalance = entry.entry_type === entry.chart_of_accounts.balance_type;
      const change = isNormalBalance ? Number(entry.amount) : -Number(entry.amount);
      account.runningBalance += change;

      account.entries.push({
        id: entry.id,
        date: entry.journal_transactions.transaction_date,
        description: entry.journal_transactions.description || 'No description',
        entryType: entry.entry_type,
        amount: Number(entry.amount) / 100,
        runningBalance: account.runningBalance / 100
      });
    });

    // Convert map to array
    const ledgers = Array.from(accountMap.values()).map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.account_type.toLowerCase(),
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
