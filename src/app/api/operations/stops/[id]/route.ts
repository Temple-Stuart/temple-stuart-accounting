/**
 * /api/operations/stops/[id] — one of the caller's stop records (STOP-01, 2026-10-12).
 *
 * DELETE → { cleared: true }: the record is gone from the card; the audit log
 *          keeps it (operations_stop_cleared, before → null), written after.
 *
 * The caller's own row only: the verified cookie, then the user, then the
 * record by { id, user_id } — another user's row, a missing one and an id that
 * is no UUID get the same 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { stopRecordRowOf } from '@/lib/operations/stopRecord';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    // The caller's own row — another user's, a missing one and an id that is no UUID get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await prisma.operations_stop_records.findFirst({ where: { id, user_id: user.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = stopRecordRowOf(row);

    await prisma.operations_stop_records.delete({ where: { id: row.id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stop_cleared', description: `Cleared the record of a stop: ${before.kind} ${before.target_id} at ${before.occurrence_at} — was ${before.outcome}` },
      target: { table: 'operations_stop_records', id: row.id },
      payload: { before, after: null },
    });

    return NextResponse.json({ cleared: true });
  } catch (error) {
    return failClosedResponse('Stop DELETE', 'Failed to clear the stop record', error);
  }
}
