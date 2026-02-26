import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ensureBookkeepingInitialized(user);

    const { date, description, entityId, lines } = await request.json();

    if (!date || !description || !entityId || !lines || lines.length < 2) {
      return NextResponse.json({ error: 'Missing required fields: date, description, entityId, lines (min 2)' }, { status: 400 });
    }

    const totalDebits = lines
      .filter((l: { entryType: string }) => l.entryType === 'D')
      .reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);
    const totalCredits = lines
      .filter((l: { entryType: string }) => l.entryType === 'C')
      .reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 1) {
      return NextResponse.json({ error: 'Debits must equal credits' }, { status: 400 });
    }

    // Verify entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found or does not belong to user' }, { status: 404 });
    }

    // Look up all account codes
    const accountCodes = lines.map((l: { accountCode: string }) => l.accountCode);
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { code: { in: accountCodes }, userId: user.id, entity_id: entityId },
    });

    if (accounts.length !== new Set(accountCodes).size) {
      const found = new Set(accounts.map(a => a.code));
      const missing = accountCodes.filter((c: string) => !found.has(c));
      return NextResponse.json({ error: `Account codes not found: ${missing.join(', ')}` }, { status: 400 });
    }

    // Create journal entry in transaction
    const requestId = randomUUID();
    const result = await prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journal_entries.create({
        data: {
          userId: user.id,
          entity_id: entityId,
          date: new Date(date),
          description,
          source_type: 'manual',
          status: 'posted',
          request_id: requestId,
        },
      });

      for (const line of lines) {
        const account = accounts.find((a) => a.code === line.accountCode)!;
        const amountCents = BigInt(Math.round(line.amount));

        await tx.ledger_entries.create({
          data: {
            journal_entry_id: journalEntry.id,
            account_id: account.id,
            entry_type: line.entryType,
            amount: amountCents,
          },
        });

        const balanceChange = line.entryType === account.balance_type
          ? amountCents
          : -amountCents;

        await tx.chart_of_accounts.update({
          where: { id: account.id },
          data: {
            settled_balance: { increment: balanceChange },
            version: { increment: 1 },
          },
        });
      }

      return journalEntry;
    });

    return NextResponse.json({ success: true, journalEntryId: result.id });
  } catch (error) {
    console.error('Manual journal entry error:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
