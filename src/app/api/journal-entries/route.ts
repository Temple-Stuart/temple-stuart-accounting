import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await ensureBookkeepingInitialized(user);

    const entries = await prisma.journal_entries.findMany({
      where: { userId: user.id },
      include: { ledger_entries: { include: { account: true } } },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { date, description, entityId, lines, status: entryStatus } = body;

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    // Validate debits = credits
    const totalDebits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.credit) || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({ error: 'Entry must be balanced (debits must equal credits)' }, { status: 400 });
    }

    // Verify entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id }
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // SEC-1: verify every target account belongs to the authenticated user
    // BEFORE writing any ledger entry. Previously each line's client-supplied
    // accountId went straight into ledger_entries.create — an authed user could
    // post debits/credits onto another user's chart_of_accounts rows. Mirror the
    // manual sibling's ownership scope (accounts by userId + entity_id).
    const accountIds: string[] = lines.map((l: any) => l.accountId);
    if (accountIds.some((id) => !id || typeof id !== 'string')) {
      return NextResponse.json({ error: 'Each line requires an accountId' }, { status: 400 });
    }
    const uniqueAccountIds = [...new Set(accountIds)];
    const ownedAccounts = await prisma.chart_of_accounts.findMany({
      where: { id: { in: uniqueAccountIds }, userId: user.id, entity_id: entityId },
      select: { id: true },
    });
    if (ownedAccounts.length !== uniqueAccountIds.length) {
      // Defensive 404 — do not confirm which accounts exist for another user.
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Period close enforcement
    await assertPeriodOpen(prisma, user.id, entityId, new Date(date));

    const entry = await prisma.journal_entries.create({
      data: {
        userId: user.id,
        entity_id: entityId,
        date: new Date(date),
        description: description || 'Manual journal entry',
        source_type: 'manual',
        status: entryStatus || 'posted',
        request_id: randomUUID(),
        created_by: userEmail,
        ledger_entries: {
          create: lines.map((l: any) => {
            const debitAmt = parseFloat(l.debit) || 0;
            const creditAmt = parseFloat(l.credit) || 0;
            const isDebit = debitAmt > 0;
            const amountCents = Math.round((isDebit ? debitAmt : creditAmt) * 100);
            return {
              account_id: l.accountId,
              entry_type: isDebit ? 'D' : 'C',
              amount: BigInt(amountCents),
              created_by: userEmail,
            };
          })
        }
      },
      include: { ledger_entries: { include: { account: true } } }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof PeriodClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
