/**
 * /api/operations/stops/[id] — one of the caller's stop records (STOP-01, 2026-10-12).
 *
 * DELETE → { cleared: true }: the record is gone from the card; the audit log
 *          keeps it (operations_stop_cleared, before → null), written after.
 * PATCH  { instant } → { record, moved } — RETRO-01 (Alex, 2026-10-16): a record
 *          typed before its routine's time or start date changed matches no stop
 *          any more; the card offers "attach to <stop>". The record's
 *          occurrence_at becomes the instant of THAT plan's stop on the
 *          instant's own day in the routine's zone — routineDay, the stops
 *          POST's own check (an archived line and an inactive routine refused by
 *          the same names) — else 400 naming the instant the day's stop is at;
 *          a record of the plan already at the target is refused by name, 409,
 *          nothing written (the partial unique index is the backstop for a
 *          race, answered 409 too). The same instant again → { moved: false },
 *          nothing written, nothing audited. Nothing else on the record changes.
 *          Audited operations_stop_moved (before → after) after the commit.
 *
 * The caller's own row only: the verified cookie, then the user, then the
 * record by { id, user_id } — another user's row, a missing one and an id that
 * is no UUID get the same 404.
 *
 * TASKS-ONE-02 (2026-10-14) — ONE DONE: the clear and the routine's completion
 * move in ONE transaction, the routine's row held first; when the occurrence is
 * no longer done its completion is deleted (routineCompletion.ts
 * syncCompletion), audited after the commit. RETRO-01: the move too — the
 * mirror is kept in step at BOTH instants (the one left, the one arrived at),
 * each change audited after the commit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { routineDay } from '@/lib/operations/routineDay';
import { ARCHIVED_LINE_WORDS, BODY_NOT_JSON_WORDS, INACTIVE_ROUTINE_WORDS, moveInput, movedWords, noStopWords, recordThereWords, refusedWords, stopRecordRowOf, type StopRecordRow } from '@/lib/operations/stopRecord';
import { auditCompletionChange, lockRoutine, syncCompletion, type CompletionChange } from '@/lib/operations/routineCompletion';
import { instantToZoned } from '@/lib/time';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { id } = await params;
    if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Validation', field: 'instant', message: BODY_NOT_JSON_WORDS }, { status: 400 });
    }
    const read = moveInput(raw);
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });

    // The caller's own row, with its plan: the line (its routine) or the routine.
    const row = await prisma.operations_stop_records.findFirst({ where: { id, user_id: user.id }, include: { step: { select: { routine_id: true, is_active: true } } } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const before = stopRecordRowOf(row);
    const routineId = row.step !== null ? row.step.routine_id : row.routine_id;
    if (routineId === null) throw new Error(`stops PATCH: record ${row.id} names no plan — the migration's CHECK holds one`);
    const routine = await prisma.operations_routines.findFirst({ where: { id: routineId, user_id: user.id }, select: { id: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true, is_active: true } });
    if (!routine) throw new Error(`stops PATCH: record ${row.id} names routine ${routineId}, which is not one of the caller's`);
    // The target is a stop the card shows: an archived line and an inactive routine are refused by the POST's names.
    if (row.step !== null && !row.step.is_active) return NextResponse.json({ error: 'Validation', field: 'instant', message: ARCHIVED_LINE_WORDS }, { status: 400 });
    if (!routine.is_active) return NextResponse.json({ error: 'Validation', field: 'instant', message: INACTIVE_ROUTINE_WORDS }, { status: 400 });

    const now = new Date();
    const instant = read.instant.toISOString();
    if (read.instant.getTime() === row.occurrence_at.getTime()) return NextResponse.json({ record: before, moved: false });

    // The target is THE stop of this plan's routine on the instant's own local day — the stops POST's rule, nothing nearer.
    let localDay: string;
    try {
      localDay = instantToZoned(read.instant, routine.timezone).date;
    } catch (error) {
      return NextResponse.json({ error: 'Validation', field: 'instant', message: refusedWords('timezone not recognised', `${JSON.stringify(routine.timezone)}: ${messageOf(error)}`) }, { status: 400 });
    }
    const that = routineDay(routine, localDay, now);
    if (that.kind === 'refused') return NextResponse.json({ error: 'Validation', field: 'instant', message: refusedWords(that.reason, that.detail) }, { status: 400 });
    if (that.kind === 'none') return NextResponse.json({ error: 'Validation', field: 'instant', message: noStopWords(instant, localDay, null) }, { status: 400 });
    if (that.expectedAt.getTime() !== read.instant.getTime()) {
      return NextResponse.json({ error: 'Validation', field: 'instant', message: noStopWords(instant, localDay, that.expectedAt.toISOString()) }, { status: 400 });
    }

    // ONE transaction: the routine's row held first, the target proven empty, the move, the mirror at both instants.
    let moved: { readonly after: StopRecordRow; readonly changes: readonly CompletionChange[] } | { readonly there: string };
    try {
      moved = await prisma.$transaction(async (tx) => {
        await lockRoutine(tx, routine.id, user.id);
        const there = await tx.operations_stop_records.findFirst({ where: { user_id: user.id, routine_id: row.routine_id, step_id: row.step_id, occurrence_at: read.instant } });
        if (there !== null) return { there: instant };
        const after = stopRecordRowOf(await tx.operations_stop_records.update({ where: { id: row.id }, data: { occurrence_at: read.instant } }));
        const left = await syncCompletion(tx, { userId: user.id, routineId: routine.id, expectedAt: row.occurrence_at, now });
        const arrived = await syncCompletion(tx, { userId: user.id, routineId: routine.id, expectedAt: read.instant, now });
        return { after, changes: [left, arrived].filter((c): c is CompletionChange => c !== null) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Conflict', message: recordThereWords(instant) }, { status: 409 });
      }
      throw error;
    }
    if ('there' in moved) return NextResponse.json({ error: 'Conflict', message: recordThereWords(moved.there) }, { status: 409 });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stop_moved', description: movedWords(before, before.occurrence_at, moved.after.occurrence_at) },
      target: { table: 'operations_stop_records', id: row.id },
      payload: { before, after: moved.after, metadata: { from: before.occurrence_at, to: moved.after.occurrence_at, routine_id: routine.id } },
    });
    for (const change of moved.changes) await auditCompletionChange(change, { user_id: user.id, email: userEmail });

    return NextResponse.json({ record: moved.after, moved: true });
  } catch (error) {
    return failClosedResponse('Stop PATCH', 'Failed to move the stop record', error);
  }
}
