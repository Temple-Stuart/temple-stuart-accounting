/**
 * /api/operations/journal — the caller's journal for a day (JOURNAL-01, 2026-10-13).
 *
 * GET ?day=YYYY-MM-DD → { day, journal }: the caller's row for the day as
 *     src/lib/operations/journal.ts JournalRow, or null when nothing was typed.
 *     A missing day, or one that is not a day, is a 400 naming the field.
 * PUT { day, ...answers } → 201 { journal, changed: true } (new) · 200 (changed)
 *     · 200 { journal, changed: false } (the same answers again — nothing
 *     written, nothing audited). Read by the one rule (journalInput — a 400
 *     names the first bad field; a body that is not JSON is a 400). An existing
 *     row is written in ONE statement guarded by { id, user_id, updated_at } as
 *     read: a row that moved or was cleared under the writer matches nothing
 *     (P2025) and is answered 409, so the audited `before` is always the true
 *     pre-image and `after` is this write's own answer; a new row that races a
 *     second create meets the UNIQUE (user_id, day) and is answered 409 too.
 *     Audited operations_journal_set (before → after) after the write.
 *
 * The caller's own rows only: the verified cookie, then the user, then every
 * query by user_id (the auth shape of src/app/api/operations/stops/route.ts).
 * Not public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isIsoDay } from '@/lib/budget/days';
import { RACE_WORDS, asJournalDate, journalInput, journalRowOf, journalUnchanged, type JournalRow } from '@/lib/operations/journal';
import { BODY_NOT_JSON_WORDS } from '@/lib/operations/stopRecord';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const day = request.nextUrl.searchParams.get('day');
    if (!isIsoDay(day)) {
      return NextResponse.json({ error: 'Validation', field: 'day', message: `day ${JSON.stringify(day)} is not a 'YYYY-MM-DD' day` }, { status: 400 });
    }
    const row = await prisma.operations_day_journals.findFirst({ where: { user_id: user.id, day: asJournalDate(day) } });
    return NextResponse.json({ day, journal: row === null ? null : journalRowOf(row) });
  } catch (error) {
    return failClosedResponse('Journal GET', 'Failed to load the journal', error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Validation', field: 'day', message: BODY_NOT_JSON_WORDS }, { status: 400 });
    }
    const read = journalInput(raw);
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });
    const { day, answers } = read.value;

    const existing = await prisma.operations_day_journals.findFirst({ where: { user_id: user.id, day: asJournalDate(day) } });
    const before = existing === null ? null : journalRowOf(existing);
    if (before !== null && journalUnchanged(before, answers)) return NextResponse.json({ journal: before, changed: false });

    let after: JournalRow;
    if (existing !== null) {
      // The guard: the row as it was read, the caller's own — ONE statement that answers the row it wrote. A row written or
      // cleared since matches nothing (P2025) and is answered 409, so `before` stays the true pre-image and `after` is this write's.
      try {
        after = journalRowOf(await prisma.operations_day_journals.update({ where: { id: existing.id, user_id: user.id, updated_at: existing.updated_at }, data: answers }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return NextResponse.json({ error: 'Conflict', message: RACE_WORDS(day) }, { status: 409 });
        }
        throw error;
      }
    } else {
      try {
        after = journalRowOf(await prisma.operations_day_journals.create({ data: { user_id: user.id, day: asJournalDate(day), ...answers } }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return NextResponse.json({ error: 'Conflict', message: RACE_WORDS(day) }, { status: 409 });
        }
        throw error;
      }
    }

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_journal_set', description: `${before === null ? 'Set' : 'Changed'} the journal for ${day}` },
      target: { table: 'operations_day_journals', id: after.id },
      payload: { before, after },
    });

    return NextResponse.json({ journal: after, changed: true }, { status: before === null ? 201 : 200 });
  } catch (error) {
    return failClosedResponse('Journal PUT', 'Failed to save the journal', error);
  }
}
