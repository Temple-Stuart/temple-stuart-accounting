/**
 * PENDING-02 (Alex, 2026-11-11) — /api/journal-entries/no-bank-row: THE POSTINGS WHOSE BANK ROW IS GONE.
 *
 * GET answers the caller's live bank postings that point at a bank row no longer in the caller's accounts — the
 * postings, their count and the sum of their cents (src/lib/books/postingsWithNoBankRow.ts NoBankRowAnswer), through
 * the one read (src/lib/books/postingsWithNoBankRowRead.ts). The General Ledger's panel reads it
 * (src/components/books/PostingsWithNoBankRow.tsx).
 *
 * POST reverses the ones its caller names: body { entryIds } — 1 to 25 distinct entry ids, else 400. Every id is
 * read by { id, userId }; when one of them is not an entry of the caller's the whole request answers 404 and nothing
 * is reversed — a foreign id answers as an unknown one does. Then one entry at a time, through the ONE reversal
 * writer (src/lib/journal-entry-service.ts reversePlaidTransaction) in its bankRowGone mode, handed the entry's own
 * source_id: the writer checks the entry is that bank posting and that the row is gone, inside its transaction. A
 * refusal — the writer's own words, a closed period's — joins `errors` and the loop goes on; a fault is logged and
 * joins `errors` as the fixed line. This file posts nothing and writes nothing itself: no poster is added.
 *
 * THE GATE FIRST, in both handlers, in the house order (src/app/api/journal-transactions/route.ts): the verified
 * cookie or 401 → the user's row or 404 → requireTabAccess(user.id, 'tab:books') or its own answer. Neither handler
 * calls anything outside the database. A fault answers the fixed line; its text stays on the server (HYG-02).
 */
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { ValidationError } from '@/lib/errors/ValidationError';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { summarizeError, userFacingMessage } from '@/lib/http/failClosed';
import { reversePlaidTransaction } from '@/lib/journal-entry-service';
import { PeriodClosedError } from '@/lib/period-close-guard';
import {
  ENTRY_IDS_WORDS, NOT_FOUND_WORDS, NOT_FROM_THAT_BANK_ROW_WORDS, REVERSAL_FAILED_WORDS,
  entryIdsOf, noBankRowAnswerOf, type ReversalAnswer, type ReversalRefusal, type ReversalResult,
} from '@/lib/books/postingsWithNoBankRow';
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

    // The body's bounds: 1 to 25 distinct non-empty strings — a body that is not JSON is not that either.
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: ENTRY_IDS_WORDS }, { status: 400 }); }
    const entryIds = entryIdsOf(body);
    if (entryIds === null) {
      return NextResponse.json({ error: ENTRY_IDS_WORDS }, { status: 400 });
    }

    // SECURITY: every id is the caller's own entry, read by { id, userId } — or the whole request is a 404 and
    // nothing is reversed. A foreign id answers exactly as an unknown one does.
    const owned = await prisma.journal_entries.findMany({
      where: { id: { in: entryIds }, userId: user.id },
      select: { id: true, source_id: true },
    });
    if (owned.length !== entryIds.length) {
      return NextResponse.json({ error: NOT_FOUND_WORDS }, { status: 404 });
    }

    const batchId = randomUUID();
    const results: ReversalResult[] = [];
    const errors: ReversalRefusal[] = [];

    for (const entry of owned) {
      // An entry that points at no bank row was not posted from one: rule (i)'s words, and the writer is not called.
      if (entry.source_id === null) {
        errors.push({ entryId: entry.id, error: NOT_FROM_THAT_BANK_ROW_WORDS });
        continue;
      }
      try {
        const result = await reversePlaidTransaction(prisma, {
          userId: user.id,
          journalEntryId: entry.id,
          transactionId: entry.source_id,
          bankRowGone: true,
          requestId: `${batchId}-${entry.source_id}`,
          createdBy: userEmail,
        });
        results.push({ entryId: entry.id, reversalId: result.reversalId });
      } catch (error: unknown) {
        // A closed period is a refusal in its own words — this entry's, and the loop goes on.
        if (error instanceof PeriodClosedError) {
          errors.push({ entryId: entry.id, error: error.message });
          continue;
        }
        // HYG-02: a ValidationError's guidance reaches the body verbatim; a fault stays on the server.
        if (!(error instanceof ValidationError)) console.error('[No bank row] reversal failed:', entry.id, summarizeError(error));
        errors.push({ entryId: entry.id, error: userFacingMessage(error, REVERSAL_FAILED_WORDS) });
      }
    }

    const answer: ReversalAnswer = { reversed: results.length, errorCount: errors.length, results, errors };
    return NextResponse.json(answer);
  } catch (error: unknown) {
    return failClosedResponse('Postings with no bank row', 'The reversal could not be run', error);
  }
}
