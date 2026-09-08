import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';
import { assertPeriodOpen, PeriodClosedError } from '@/lib/period-close-guard';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { balanceDeltaOf, postJournal } from '@/lib/posting/postJournal';

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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

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

    // Period close enforcement
    await assertPeriodOpen(prisma, user.id, entityId, new Date(date));

    // HYG-04: ONE posting discipline — postJournal: SET CONSTRAINTS ALL
    // IMMEDIATE first, every line in one statement, the entry read back after
    // commit. An unbalanced entry the DB refuses throws inside the transaction.
    const requestId = randomUUID();
    const { result } = await postJournal(prisma, async (_tx, post) =>
      post({
        entry: {
          userId: user.id,
          entity_id: entityId,
          date: new Date(date),
          description,
          source_type: 'manual',
          status: 'posted',
          request_id: requestId,
          created_by: userEmail,
        },
        lines: lines.map((line: { accountCode: string; entryType: 'D' | 'C'; amount: number }) => {
          const account = accounts.find((a) => a.code === line.accountCode)!;
          const amountCents = BigInt(Math.round(line.amount));
          return {
            account_id: account.id,
            entry_type: line.entryType,
            amount: amountCents,
            balanceDelta: balanceDeltaOf(line.entryType, account.balance_type, amountCents),
            created_by: userEmail,
          };
        }),
      }),
    );

    return NextResponse.json({ success: true, journalEntryId: result.id });
  } catch (error) {
    if (error instanceof PeriodClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return failClosedResponse('Manual journal entry', 'Failed to create journal entry', error);
  }
}
