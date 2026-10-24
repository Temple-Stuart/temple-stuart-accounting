/**
 * /api/operations/journal/range — the caller's journals for a span of days, READ-ONLY (JOURNAL-07, Alex, 2026-10-24).
 *
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → { from, to, first_day, journals }:
 *   · journals — every row of the caller's whose day is in [from, to], in day order, each as
 *     src/lib/operations/journal.ts JournalRow (journalRowOf: the eleven answers; the retired ones ride under
 *     `retired`, never shown). A day with no row is no row (ruling D).
 *   · first_day — the caller's earliest journal day ('YYYY-MM-DD'), or null when they have none; the tables' ALL
 *     starts from it (ruling 1(b), 2026-10-24 — the ledger's first_record idiom). One user-scoped findFirst.
 * The span is read by the ledger's one rule (ledger.ts spanInput: real days, in order, at most
 * LEDGER_SPAN_MAX_DAYS — the first bad one named; a 400 naming the field), as src/app/api/operations/ledger/route.ts
 * reads its own.
 *
 * A SIBLING of the day route (../route.ts — GET ?day and PUT), which is untouched: journal06 T11 holds it, and
 * journal07 pins its code byte for byte. No PUT, no POST, no DELETE here — the tables on /time are read-only; the
 * card writes.
 *
 * The caller's own rows only: the verified cookie, then the user, then every query by user_id (the auth shape of
 * ../route.ts and the ledger route). Not public (src/middleware.ts PUBLIC_PATHS names no /api/operations path).
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { spanInput } from '@/lib/operations/ledger';
import { asJournalDate, journalRowOf } from '@/lib/operations/journal';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));
    if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });
    const { from, to } = span;
    const [rows, first] = await Promise.all([
      prisma.operations_day_journals.findMany({ where: { user_id: user.id, day: { gte: asJournalDate(from), lte: asJournalDate(to) } }, orderBy: { day: 'asc' } }),
      prisma.operations_day_journals.findFirst({ where: { user_id: user.id }, orderBy: { day: 'asc' }, select: { day: true } }),
    ]);
    return NextResponse.json({ from, to, first_day: first === null ? null : first.day.toISOString().slice(0, 10), journals: rows.map(journalRowOf) });
  } catch (error) {
    return failClosedResponse('Journal range GET', 'Failed to load the journals', error);
  }
}
