import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { MISSING_ROW_WORDS, entrySourceOf, type SourceAnswer } from '@/lib/books/entrySource';

/**
 * DRILL-01 (2026-09-23) — GET /api/journal-entries/<id>/source.
 *
 * The one read behind "open the bank transaction this entry was posted from".
 * The entry's own pointer decides what is fetched — the browser names an ENTRY,
 * never a transaction, so a caller cannot ask for a row the entry does not point
 * at. Only `plaid_txn` opens: src/lib/books/entrySource.ts marks it the one kind
 * whose target this ruling reads, and the route refuses any other kind by name
 * rather than guessing a table.
 *
 * GUARDS, in the house order (src/app/api/journal-transactions/route.ts:6-21):
 * getVerifiedEmail → the user row → requireTabAccess('tab:books'). Every read is
 * user-scoped: the entry by `{ id, userId: user.id }` and the transaction through
 * its account's `userId`. A cross-user id therefore returns the same 404 an
 * unknown id does — a defensive 404 that confirms nothing.
 *
 * Zero external calls, zero writes, zero cost.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const tabGate = await requireTabAccess(user.id, 'tab:books');
  if (tabGate) return tabGate;

  // The entry, scoped to its owner. Another account's entry is a 404, not a 403.
  const entry = await prisma.journal_entries.findFirst({
    where: { id, userId: user.id },
    select: { id: true, source_type: true, source_id: true, reverses_entry_id: true },
  });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const source = entrySourceOf(entry);
  if (source.kind !== 'opens') {
    // Said, not guessed: this kind names its source on the row itself and has no
    // table this ruling reads.
    const answer: SourceAnswer = { found: false, reason: `this entry's source is ${source.words} — it opens nothing here` };
    return NextResponse.json(answer);
  }

  const txn = await prisma.transactions.findFirst({
    where: { transactionId: source.id, accounts: { userId: user.id } },
    select: {
      transactionId: true, date: true, name: true, merchantName: true, amount: true,
      category: true, pending: true, payment_channel: true, transaction_type: true,
      authorized_date: true, website: true,
      accounts: { select: { name: true, mask: true } },
    },
  });
  if (!txn) {
    const answer: SourceAnswer = { found: false, reason: MISSING_ROW_WORDS(source.id) };
    return NextResponse.json(answer);
  }

  // Only what the row carries. A null column stays null and the surface drops it —
  // nothing is defaulted to 0, to "" or to "Unknown".
  const answer: SourceAnswer = {
    found: true,
    transaction: {
      transactionId: txn.transactionId,
      date: txn.date ? txn.date.toISOString().slice(0, 10) : null,
      name: txn.name ?? null,
      merchantName: txn.merchantName ?? null,
      amount: txn.amount ?? null,
      accountName: txn.accounts?.name ?? null,
      accountMask: txn.accounts?.mask ?? null,
      category: txn.category ?? null,
      pending: txn.pending ?? null,
      paymentChannel: txn.payment_channel ?? null,
      transactionType: txn.transaction_type ?? null,
      authorizedDate: txn.authorized_date ? txn.authorized_date.toISOString().slice(0, 10) : null,
      website: txn.website ?? null,
    },
  };
  return NextResponse.json(answer);
}
