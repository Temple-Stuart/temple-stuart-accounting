/**
 * /api/operations/routines/[id]/completions/[completionId]
 *
 * PATCH — edit a done's note (WEEK-02, 2026-09-30). Body: { notes: string }.
 *   The note is read by the one note rule (src/lib/operations/completionNote.ts —
 *   trimmed; blank is no note, so saving an empty box removes it). Only the
 *   note changes: never expected_at, completed_at, delta_minutes, the routine or
 *   its streaks. The completions table has no updated_at, so the audit log is
 *   the edit's history: before → after, with the routine and the occurrence.
 *
 *   The caller's own done only: the verified cookie, then the user, then the
 *   routine by { id, user_id } and the completion by { id, routine_id, user_id }
 *   — another user's row and a missing one get the same 404. A note that is not
 *   a string is a 400 naming the field. An unchanged note writes nothing and
 *   audits nothing: { completion, changed: false }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { completionNote } from '@/lib/operations/completionNote';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; completionId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: routineId, completionId } = await params;
    const routine = await prisma.operations_routines.findFirst({
      where: { id: routineId, user_id: user.id },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const completion = await prisma.operations_routine_completions.findFirst({
      where: { id: completionId, routine_id: routine.id, user_id: user.id },
    });
    if (!completion) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    if (typeof body.notes !== 'string') {
      return NextResponse.json(
        { error: 'Validation', field: 'notes', message: 'required (a string — an empty one removes the note)' },
        { status: 400 }
      );
    }
    const notes = completionNote(body.notes);

    // Unchanged: nothing is written, nothing is audited.
    if (notes === completion.notes) {
      return NextResponse.json({ completion, changed: false });
    }

    const updated = await prisma.operations_routine_completions.update({
      where: { id: completion.id },
      data: { notes },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_routine_completion_note_edited',
        description: `Edited the note on "${routine.name}" (${completion.expected_at.toISOString()})`,
      },
      target: {
        table: 'operations_routine_completions',
        id: completion.id,
      },
      payload: {
        before: { notes: completion.notes },
        after: { notes },
        metadata: {
          routine_id: routine.id,
          routine_name: routine.name,
          expected_at: completion.expected_at.toISOString(),
        },
      },
    });

    return NextResponse.json({ completion: updated, changed: true });
  } catch (error) {
    return failClosedResponse('Completion note PATCH', 'Failed to save the note', error);
  }
}
