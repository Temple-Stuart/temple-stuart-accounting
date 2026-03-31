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

    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get('accountCode');
    const entityId = searchParams.get('entityId');

    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: {
        account: {
          userId: user.id,
          ...(accountCode ? { code: accountCode } : {}),
          ...(entityId ? { entity_id: entityId } : {}),
        }
      },
      include: {
        account: { include: { entity: { select: { id: true, name: true, entity_type: true } } } },
        journal_entry: true
      },
      orderBy: [
        { account_id: 'asc' },
        { created_at: 'asc' }
      ]
    });

    const accountMap = new Map<string, any>();

    ledgerEntries.forEach(entry => {
      const accountId = entry.account_id;
      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, {
          accountCode: entry.account.code,
          accountName: entry.account.name,
          accountType: entry.account.account_type,
          balanceType: entry.account.balance_type,
          entityId: entry.account.entity?.id || null,
          entityName: entry.account.entity?.name || 'Other',
          entries: [],
          runningBalance: 0
        });
      }

      const account = accountMap.get(accountId);
      const isNormalBalance = entry.entry_type === entry.account.balance_type;
      const change = isNormalBalance ? Number(entry.amount) : -Number(entry.amount);
      account.runningBalance += change;

      account.entries.push({
        id: entry.id,
        date: entry.journal_entry.date,
        description: entry.journal_entry.description || 'No description',
        entryType: entry.entry_type,
        amount: Number(entry.amount) / 100,
        runningBalance: account.runningBalance / 100,
        journal_id: entry.journal_entry.id,
        is_reversal: entry.journal_entry.is_reversal ?? false,
        reversed_by_entry_id: entry.journal_entry.reversed_by_entry_id ?? null
      });
    });

    const ledgers = Array.from(accountMap.values()).map(account => ({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      balanceType: account.balanceType,
      entityId: account.entityId,
      entityName: account.entityName,
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
