/**
 * PENDING-02 (Alex, 2026-11-11) — /api/journal-entries/no-bank-row: THE POSTINGS WHOSE BANK ROW IS GONE.
 *
 * GET answers the caller's live bank postings that point at a bank row no longer in the caller's accounts — the
 * postings, their count and the sum of their cents (src/lib/books/postingsWithNoBankRow.ts NoBankRowAnswer), through
 * the one read (src/lib/books/postingsWithNoBankRowRead.ts). The General Ledger's panel reads it
 * (src/components/books/PostingsWithNoBankRow.tsx).
 *
 * THE GATE FIRST, in the house order (src/app/api/journal-transactions/route.ts): the verified cookie or 401 → the
 * user's row or 404 → requireTabAccess(user.id, 'tab:books') or its own answer. Only then the read, for user.id.
 * GET writes nothing and calls nothing outside the database. A fault answers the fixed line; its text stays on the
 * server (HYG-02).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { noBankRowAnswerOf } from '@/lib/books/postingsWithNoBankRow';
import { readPostingsWithNoBankRow } from '@/lib/books/postingsWithNoBankRowRead';

export async function GET() {
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

    return NextResponse.json(noBankRowAnswerOf(await readPostingsWithNoBankRow(prisma, user.id)));
  } catch (error: unknown) {
    return failClosedResponse('Postings with no bank row', 'The postings with no bank row could not be read', error);
  }
}
