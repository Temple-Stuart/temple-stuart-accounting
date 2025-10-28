import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      include: {
        account: true,
        transaction: true
      },
      orderBy: [
        { accountId: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Group entries by account
    const accountMap = new Map<string, any>();

    ledgerEntries.forEach(entry => {
      const accountId = entry.accountId;
      
      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, {
          accountCode: entry.account.code,
          accountName: entry.account.name,
          accountType: entry.account.account_type,
          balanceType: entry.account.balance_type,
          entries: [],
          runningBalance: 0
        });
      }

      const account = accountMap.get(accountId);
      
      // Calculate running balance
      const isNormalBalance = entry.entryType === entry.account.balance_type;
      const change = isNormalBalance ? Number(entry.amount) : -Number(entry.amount);
      account.runningBalance += change;

      account.entries.push({
        id: entry.id,
        date: entry.transaction.transactionDate,
        description: entry.transaction.description || 'No description',
        entryType: entry.entryType,
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
