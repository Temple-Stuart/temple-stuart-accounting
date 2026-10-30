import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';

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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

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
        // POST-01 (2026-09-26): the entry with the booking it documents (and the money
        // event, a refund, when set) — the reservation's own stated fields.
        journal_entry: {
          include: {
            document_reservation: { select: { displayName: true, providerBookingId: true, providerConfirmationCode: true } },
            document_money_event: { select: { kind: true, amountCents: true, currency: true } },
          },
        },
      },
      orderBy: [
        { account_id: 'asc' },
        { created_at: 'asc' }
      ]
    });

    // DOCUMENTS-01 (2026-10-28): the accumulator is typed (it was Map<string, any>) — this file
    // changed, and the lint holds a changed file to 0 errors. The shape is unchanged.
    interface AccountAccumulator {
      accountCode: string;
      accountName: string;
      accountType: string;
      balanceType: string;
      entityId: string | null;
      entityName: string;
      entries: Record<string, unknown>[];
      runningBalance: number;
    }
    const accountMap = new Map<string, AccountAccumulator>();

    ledgerEntries.forEach(entry => {
      const accountId = entry.account_id;
      let account = accountMap.get(accountId);
      if (!account) {
        account = {
          accountCode: entry.account.code,
          accountName: entry.account.name,
          accountType: entry.account.account_type,
          balanceType: entry.account.balance_type,
          entityId: entry.account.entity?.id || null,
          entityName: entry.account.entity?.name || 'Other',
          entries: [],
          runningBalance: 0
        };
        accountMap.set(accountId, account);
      }

      const isNormalBalance = entry.entry_type === entry.account.balance_type;
      const change = isNormalBalance ? Number(entry.amount) : -Number(entry.amount);
      account.runningBalance += change;

      account.entries.push({
        id: entry.id,
        date: entry.journal_entry.date,
        description: entry.journal_entry.description || 'No description',
        entryType: entry.entry_type,
        // FX-01 (2026-10-30, ruling B): integer CENTS on the wire — the screen writes them through the
        // books' one formatter (src/lib/books/functionalCurrency.ts); nothing is divided into float dollars.
        amount: Number(entry.amount),
        runningBalance: account.runningBalance,
        journal_id: entry.journal_entry.id,
        is_reversal: entry.journal_entry.is_reversal ?? false,
        reversed_by_entry_id: entry.journal_entry.reversed_by_entry_id ?? null,
        // DOCUMENTS-01 (2026-10-28): the entry's status rides with its reversal fields, so the
        // ledger reads "can this posting carry a receipt" by the one rule (isReversedPosting).
        status: entry.journal_entry.status,
        // DRILL-01 (2026-09-23): the three columns the ledger dropped. The include
        // at :37 already pulled the whole journal_entry — this map simply never
        // carried where the entry came from, so the ledger could not say it.
        // Passed through verbatim: source_type is NOT NULL (schema.prisma:192) and
        // source_id is nullable (:193), and neither is defaulted here.
        source_type: entry.journal_entry.source_type,
        source_id: entry.journal_entry.source_id ?? null,
        reverses_entry_id: entry.journal_entry.reverses_entry_id ?? null,
        // POST-01: the document on the wire — NULL rides as null and renders nothing.
        document_reservation_id: entry.journal_entry.document_reservation_id,
        document_money_event_id: entry.journal_entry.document_money_event_id,
        document_reservation: entry.journal_entry.document_reservation,
        document_money_event: entry.journal_entry.document_money_event
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
      closingBalance: account.runningBalance
    }));

    return NextResponse.json({ ledgers });
  } catch (error) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}
