/**
 * /api/operations/stops — the caller's stop records (STOP-01, 2026-10-12).
 *
 * GET  ?day=YYYY-MM-DD → { records, unplaced }: every record of the caller
 *      whose stop falls on `day` in its routine's OWN zone (instantToZoned —
 *      the today read's placing), each as src/lib/operations/stopRecord.ts
 *      StopRecordRow; a record whose routine's zone cannot be read is listed
 *      under `unplaced` with the reason, never dropped and never placed in UTC.
 *      A missing day, or one that is not a day, is a 400 naming the field.
 * POST { kind, id, instant, outcome, done_at?, actual_cents?, rating?, note?,
 *      actual_minutes? } → 201 { record, changed: true } (new) · 200 (changed)
 *      · 200 { record, changed: false } (the same values again — nothing
 *      written, nothing audited). Read by the one rule (stopInput — a 400 names
 *      the first bad field). The plan is the caller's own — a line by its
 *      routine's user, a routine by its user; an id that is no UUID, another
 *      user's plan and a missing one get the same 404. An archived line, an
 *      inactive routine and a routine that has lines are refused by name (400):
 *      none is a stop the card shows (the today read lists active routines
 *      only). A body that is not JSON is a 400. The instant must be THE stop of that routine on its local
 *      day — routineDay, the today read's own rule — else 400 naming the
 *      instant the day's stop is at (or that there is none). The partial unique
 *      index is the backstop for a race between two creates, answered 409.
 *      Audited operations_stop_set (before → after) after the write.
 *
 * The caller's own rows only: the verified cookie, then the user, then every
 * query by user_id. Not public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isIsoDay } from '@/lib/budget/days';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { routineDay } from '@/lib/operations/routineDay';
import {
  ARCHIVED_LINE_WORDS, BODY_NOT_JSON_WORDS, INACTIVE_ROUTINE_WORDS, LINES_WORDS, RACE_WORDS, noStopWords, planOf, recordWindow, refusedWords, stopInput, stopRecordRowOf, unchanged,
  type StopRecordRow,
} from '@/lib/operations/stopRecord';
import { instantToZoned } from '@/lib/time';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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

    // Every record that could fall on the day in any zone; then each placed by its own routine's zone.
    const rows = await prisma.operations_stop_records.findMany({
      where: { user_id: user.id, occurrence_at: recordWindow(day) },
      include: { routine: { select: { timezone: true } }, step: { select: { routine: { select: { timezone: true } } } } },
      orderBy: { occurrence_at: 'asc' },
    });
    const records: StopRecordRow[] = [];
    const unplaced: { record: StopRecordRow; detail: string }[] = [];
    for (const row of rows) {
      const record = stopRecordRowOf(row);
      const zone = row.step !== null ? row.step.routine.timezone : row.routine !== null ? row.routine.timezone : null;
      if (zone === null) throw new Error(`stops GET: record ${row.id} names no plan — the migration's CHECK holds one`);
      let localDay: string;
      try {
        localDay = instantToZoned(row.occurrence_at, zone).date;
      } catch (error) {
        unplaced.push({ record, detail: refusedWords('timezone not recognised', `${JSON.stringify(zone)}: ${messageOf(error)}`) });
        continue;
      }
      if (localDay === day) records.push(record);
    }
    return NextResponse.json({ day, records, unplaced });
  } catch (error) {
    return failClosedResponse('Stops GET', 'Failed to load the stop records', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Validation', field: 'kind', message: BODY_NOT_JSON_WORDS }, { status: 400 });
    }
    const now = new Date();
    const read = stopInput(raw, now);
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });
    const v = read.value;
    // The plan is the caller's own — an id that is no UUID, another user's plan and a missing one get the same 404 (nothing reaches Prisma malformed).
    if (!isValidUuid(v.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let routine: { id: string; name: string; timezone: string; schedule_rrule: string; start_date: Date | null; end_date: Date | null; is_active: boolean };
    if (v.kind === 'routine_line') {
      const step = await prisma.operations_routine_steps.findFirst({
        where: { id: v.id, routine: { user_id: user.id } },
        select: { id: true, is_active: true, routine: { select: { id: true, name: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true, is_active: true } } },
      });
      if (!step) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!step.is_active) return NextResponse.json({ error: 'Validation', field: 'id', message: ARCHIVED_LINE_WORDS }, { status: 400 });
      routine = step.routine;
    } else {
      const r = await prisma.operations_routines.findFirst({
        where: { id: v.id, user_id: user.id },
        select: { id: true, name: true, timezone: true, schedule_rrule: true, start_date: true, end_date: true, is_active: true, steps: { where: { is_active: true }, select: { id: true }, take: 1 } },
      });
      if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (r.steps.length > 0) return NextResponse.json({ error: 'Validation', field: 'id', message: LINES_WORDS }, { status: 400 });
      routine = r;
    }
    // The today read lists active routines only — an inactive one has no stop on the card, so no record either.
    if (!routine.is_active) return NextResponse.json({ error: 'Validation', field: 'id', message: INACTIVE_ROUTINE_WORDS }, { status: 400 });

    // The instant is THE stop of this routine on its local day — the today read's rule, nothing nearer.
    const instant = v.instant.toISOString();
    let localDay: string;
    try {
      localDay = instantToZoned(v.instant, routine.timezone).date;
    } catch (error) {
      return NextResponse.json({ error: 'Validation', field: 'instant', message: refusedWords('timezone not recognised', `${JSON.stringify(routine.timezone)}: ${messageOf(error)}`) }, { status: 400 });
    }
    const that = routineDay(routine, localDay, now);
    if (that.kind === 'refused') return NextResponse.json({ error: 'Validation', field: 'instant', message: refusedWords(that.reason, that.detail) }, { status: 400 });
    if (that.kind === 'none') return NextResponse.json({ error: 'Validation', field: 'instant', message: noStopWords(instant, localDay, null) }, { status: 400 });
    if (that.expectedAt.getTime() !== v.instant.getTime()) {
      return NextResponse.json({ error: 'Validation', field: 'instant', message: noStopWords(instant, localDay, that.expectedAt.toISOString()) }, { status: 400 });
    }

    const plan = planOf(v.kind, v.id);
    const existing = await prisma.operations_stop_records.findFirst({ where: { user_id: user.id, routine_id: plan.routine_id, step_id: plan.step_id, occurrence_at: v.instant } });
    const before = existing === null ? null : stopRecordRowOf(existing);
    if (before !== null && unchanged(before, v)) return NextResponse.json({ record: before, changed: false });

    const data = { outcome: v.outcome, done_at: v.doneAt, actual_cents: v.actualCents, rating: v.rating, note: v.note, actual_minutes: v.actualMinutes };
    let after: StopRecordRow;
    if (existing !== null) {
      after = stopRecordRowOf(await prisma.operations_stop_records.update({ where: { id: existing.id }, data }));
    } else {
      try {
        after = stopRecordRowOf(await prisma.operations_stop_records.create({ data: { user_id: user.id, routine_id: plan.routine_id, step_id: plan.step_id, occurrence_at: v.instant, ...data } }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return NextResponse.json({ error: 'Conflict', message: RACE_WORDS(instant) }, { status: 409 });
        }
        throw error;
      }
    }

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_stop_set', description: `${before === null ? 'Recorded' : 'Changed the record of'} a stop: ${routine.name}, ${v.kind} ${v.id} at ${instant} — ${v.outcome}` },
      target: { table: 'operations_stop_records', id: after.id },
      payload: { before, after },
    });

    return NextResponse.json({ record: after, changed: true }, { status: before === null ? 201 : 200 });
  } catch (error) {
    return failClosedResponse('Stops POST', 'Failed to save the stop record', error);
  }
}
