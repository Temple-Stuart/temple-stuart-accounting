/**
 * /api/operations/stops/[id] — one of the caller's stop records (STOP-01, 2026-10-12).
 *
 * DELETE → { cleared: true }: the record is gone from the card; the audit log
 *          keeps it (operations_stop_cleared, before → null), written after.
 *
 * The caller's own row only: the verified cookie, then the user, then the
 * record by { id, user_id } — another user's row, a missing one and an id that
 * is no UUID get the same 404.
 *
 * TASKS-ONE-02 (2026-10-14) — ONE DONE: the clear and the routine's completion
 * move in ONE transaction, the routine's row held first; when the occurrence is
 * no longer done its completion is deleted (routineCompletion.ts
 * syncCompletion), audited after the commit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { stopRecordRowOf } from '@/lib/operations/stopRecord';
import { auditCompletionChange, lockRoutine, syncCompletion } from '@/lib/operations/routineCompletion';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    // The caller's own row — another user's, a missing one and an id that is no UUID get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const row = await prisma.operations_stop_records.findFirst({ where: { id, user_id: user.id }, include: { step: { select: { routine_id: true } } } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = stopRecordRowOf(row);
    // The routine the record's occurrence belongs to — the line's routine, or the routine itself.
    const routineId = row.step !== null ? row.step.routine_id : row.routine_id;
    if (routineId === null) throw new Error(`stops DELETE: record ${row.id} names no plan — the migration's CHECK holds one`);

    // TASKS-ONE-02: the clear and the routine's completion in ONE transaction, the routine's row held first.
    const change = await prisma.$transaction(async (tx) => {
      await lockRoutine(tx, routineId, user.id);
      await tx.operations_stop_records.delete({ where: { id: row.id } });
      return syncCompletion(tx, { userId: user.id, routineId, expectedAt: row.occurrence_at, now: new Date() });
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stop_cleared', description: `Cleared the record of a stop: ${before.kind} ${before.target_id} at ${before.occurrence_at} — was ${before.outcome}` },
      target: { table: 'operations_stop_records', id: row.id },
      payload: { before, after: null },
    });
    if (change !== null) await auditCompletionChange(change, { user_id: user.id, email: userEmail });

    return NextResponse.json({ cleared: true });
  } catch (error) {
    return failClosedResponse('Stop DELETE', 'Failed to clear the stop record', error);
  }
}
