/**
 * /api/operations/journal/[id] — one of the caller's day journals (JOURNAL-01, 2026-10-13).
 *
 * DELETE → { cleared: true }: the answers are gone from the card; the audit log
 *          keeps them (operations_journal_cleared, before → null), written after.
 *
 * The caller's own row only: the verified cookie, then the user, then the row
 * by { id, user_id } — another user's row, a missing one and an id that is no
 * UUID get the same 404 (the auth shape of src/app/api/operations/stops/[id]/route.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { journalRowOf } from '@/lib/operations/journal';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    // The caller's own row — another user's, a missing one and an id that is no UUID get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await prisma.operations_day_journals.findFirst({ where: { id, user_id: user.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = journalRowOf(row);

    await prisma.operations_day_journals.delete({ where: { id: row.id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_journal_cleared', description: `Cleared the journal for ${before.day}` },
      target: { table: 'operations_day_journals', id: row.id },
      payload: { before, after: null },
    });

    return NextResponse.json({ cleared: true });
  } catch (error) {
    return failClosedResponse('Journal DELETE', 'Failed to clear the journal', error);
  }
}
