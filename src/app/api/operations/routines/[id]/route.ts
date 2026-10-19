/**
 * /api/operations/routines/[id]
 *
 * GET    — return one routine.
 * PATCH  — update fields. Audit discriminates:
 *            * is_active true→false → operations_routine_deactivated
 *            * is_active false→true → operations_routine_updated
 *              (no _reactivated enum exists in v0; document and reuse _updated)
 *            * any change to schedule_rrule, timezone, fail_threshold_minutes →
 *              recompute next_due_at via expandForward.
 *            * everything else → operations_routine_updated
 * DELETE — hard delete. Cascades to operations_routine_completions via FK.
 *          Audits operations_routine_deleted with full payload_before.
 *
 * ONEOFF-01: start_date is the ANCHOR every expansion is built on, so patching
 * it recomputes next_due_at; a one-off (COUNT=1) must keep a date and ends on
 * it; the routine's place (location + coordinate pair) is patchable, the pair
 * all-or-nothing.
 *
 * ROUTINE-02a (Alex, 2026-10-18): end_date is the LAST DAY an occurrence may fall
 * on, so patching it recomputes next_due_at too, bounded by it — null once
 * nothing remains before the end (the row then says "ended <date>"). The zone
 * is one of Intl's own names (rruleHelpers.ts TIME_ZONES), matched without case
 * and stored in the list's spelling — anything else is refused by name; a
 * stored name that differed only by case is saved canonical on this edit, and
 * names the same zone to Intl, so no instant moves.
 *
 * ROUTINE-02b (Alex, 2026-10-18): ONE TIME; HISTORY FOLLOWS IT. The start time
 * IS the routine's clock: a body that sends it (blank refused) rewrites the
 * rule's BYHOUR/BYMINUTE from it even when no cadence field is sent — the edit
 * that used to change nothing on the day cards; with cadence fields the compile
 * derives the clock from it and refuses a byhour/byminute or a custom rule that
 * disagrees. The end time is required with the start time when either is sent
 * (a one-off excepted — its window is its day). When the clock or the zone
 * changes, the rows keyed to the old instants — completions, stop records,
 * single-occurrence plan vendors, plan links — move with it, day by day, old
 * instant → the new rule's occurrence on the SAME local day, in ONE transaction
 * with the routine's row (routineRekey.ts, the pure rule): a day the new rule
 * has no occurrence on, or a target already occupied, refuses the whole edit by
 * name before any write (400 / 409). Rows not on the old clock stay and are
 * counted. Audited once as operations_routine_rekeyed (the counts per table,
 * the rule and zone before → after) plus RETRO-01's operations_stop_moved per
 * record; the answer says how many rows moved per table (`rekeyed`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { roleInput } from '@/lib/operations/stopRole';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { EMPTY_WINDOW_WORDS, END_TIME_REQUIRED_WORDS, START_TIME_REQUIRED_WORDS, canonicalZone, clockOfRule, clockOfTime, clockWords, compileFormToRRule, expandForward, isOnceRRule, sameClock, scheduleAnchor, withClock, zoneNotListedWords } from '@/lib/operations/rruleHelpers';
import { RekeyRefused, rekeyPlan, rekeyedWords, occupiedWords, type RekeyCounts, type RekeySchedule } from '@/lib/operations/routineRekey';
import { lockRoutine, moveCompletions } from '@/lib/operations/routineCompletion';
import { movedWords, stopRecordRowOf, type StopRecordRow } from '@/lib/operations/stopRecord';
import { parsePlaceInput } from '@/lib/operations/routineInput';
import { carriesPlanMoney, editedPlanMoney, planMoney, type PlanBook } from '@/lib/operations/planMoney';
import { loadPlanBook } from '@/lib/operations/loadPlanBook';
import type { RoutineForm } from '@/components/workbench/operations/routines/types';
import { parseTimeOrNull } from '@/lib/operations/parseTime';

/**
 * Parse an optional YYYY-MM-DD date-bound value. Empty/null/undefined → null
 * (unset). Returns a 400 NextResponse in `error` on malformed input.
 */
function parseDateOrNull(
  v: unknown,
  field: string
): { value: Date | null; error: NextResponse | null } {
  if (v === null || v === undefined || v === '') return { value: null, error: null };
  if (typeof v !== 'string') {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must be string YYYY-MM-DD or null' },
        { status: 400 }
      ),
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must match YYYY-MM-DD' },
        { status: 400 }
      ),
    };
  }
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'invalid date' },
        { status: 400 }
      ),
    };
  }
  return { value: d, error: null };
}

async function loadAuthorizedRoutine(routineId: string, userId: string) {
  return prisma.operations_routines.findFirst({
    where: { id: routineId, user_id: userId },
    include: {
      steps: {
        // OPS-CE-1: only active steps; archived (soft-deleted) steps are hidden
        // from the routine view while their scene-row + takes stay in the DB.
        where: { is_active: true },
        orderBy: { step_order: 'asc' },
        include: { content_scene: true },
      },
      content_scene_group: true,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const routine = await loadAuthorizedRoutine(id, user.id);
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ routine });
  } catch (error) {
    return failClosedResponse('Routine GET', 'Failed to load routine', error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedRoutine(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Partial<RoutineForm>;
    const now = new Date();

    const data: Prisma.operations_routinesUpdateInput = {};
    let scheduleChanged = false;

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'name', message: 'required, max 200 chars' },
          { status: 400 }
        );
      }
      const trimmed = body.name.trim();
      if (trimmed !== existing.name) {
        // Pre-emptive uniqueness check.
        const dup = await prisma.operations_routines.findFirst({
          where: { user_id: user.id, name: trimmed, NOT: { id } },
        });
        if (dup) {
          return NextResponse.json(
            { error: 'Duplicate', field: 'name', message: 'a routine with this name already exists' },
            { status: 409 }
          );
        }
      }
      data.name = trimmed;
    }

    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    }

    if (body.ideal_time_label !== undefined) {
      data.ideal_time_label = typeof body.ideal_time_label === 'string' && body.ideal_time_label.trim().length > 0
        ? body.ideal_time_label.trim()
        : null;
    }

    if (body.fail_threshold_minutes !== undefined) {
      const n = parseInt(String(body.fail_threshold_minutes), 10);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'fail_threshold_minutes', message: 'must be a non-negative integer' },
          { status: 400 }
        );
      }
      data.fail_threshold_minutes = n;
    }

    // ROLE-01: the role, by name; not sent → untouched.
    if (body.role !== undefined) {
      const role = roleInput(body.role);
      if (!role.ok) return NextResponse.json({ error: 'Validation', field: role.field, message: role.message }, { status: 400 });
      data.role = role.role;
    }

    // INTAKE-01: the per-occurrence budget and its account. Neither key sent → both
    // untouched. Either sent → the EFFECTIVE pair (the body's value, else the stored
    // one) is checked whole by the one rule (planMoney.ts) against the routine's book,
    // and both columns are written — the rule the place follows below.
    const sent = editedPlanMoney(body.budget_amount, body.coa_code, { amount: existing.budget_amount, account: existing.coa_code });
    if (sent !== null) {
      let book: PlanBook | null = null;
      if (carriesPlanMoney(sent)) {
        book = await loadPlanBook(prisma, user.id, existing.entity_id);
        if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const money = planMoney(sent, book, 'routine', { amount: 'budget_amount', account: 'coa_code' });
      if ('error' in money) return NextResponse.json({ error: 'Validation', ...money.error }, { status: 400 });
      data.budget_amount = money.value.amount;
      data.coa_code = money.value.coaCode;
    }

    if (body.timezone !== undefined) {
      // ROUTINE-02a: one of Intl's zone names, matched without case, stored as the list spells it; else refused by name.
      const timezone = canonicalZone(body.timezone);
      if (timezone === null) {
        return NextResponse.json(
          { error: 'Validation', field: 'timezone', message: zoneNotListedWords(body.timezone) },
          { status: 400 }
        );
      }
      data.timezone = timezone;
      scheduleChanged = true;
    }

    let activationToggle: 'deactivated' | 'reactivated' | null = null;
    if (body.is_active !== undefined) {
      const incoming = Boolean(body.is_active);
      if (incoming !== existing.is_active) {
        activationToggle = incoming ? 'reactivated' : 'deactivated';
      }
      data.is_active = incoming;
    }

    // Date bounds: validate against the effective (post-patch) values so a
    // single-sided patch is checked against the stored counterpart.
    // ONEOFF-01: read BEFORE the cadence compile, because start_date is the
    // anchor every expansion is built on and the date a one-off is counted from.
    let effectiveStart = existing.start_date;
    let effectiveEnd = existing.end_date;
    if ('start_date' in body) {
      const r = parseDateOrNull(body.start_date, 'start_date');
      if (r.error) return r.error;
      effectiveStart = r.value;
      data.start_date = r.value;
      // The anchor moved, so every occurrence may have — recompute next_due_at.
      scheduleChanged = true;
    }
    if ('end_date' in body) {
      const r = parseDateOrNull(body.end_date, 'end_date');
      if (r.error) return r.error;
      effectiveEnd = r.value;
      data.end_date = r.value;
      // ROUTINE-02a: the end moved, so the next occurrence may have — or may no longer exist. Recompute.
      scheduleChanged = true;
    }
    if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_date', message: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }
    const effectiveStartStr = effectiveStart ? effectiveStart.toISOString().slice(0, 10) : '';

    // Time window: validate against effective (post-patch) values. ROUTINE-02b:
    // read BEFORE the cadence compile — the start time is the clock it derives.
    let effectiveStartTime = existing.start_time;
    let effectiveEndTime = existing.end_time;
    if ('start_time' in body) {
      const r = parseTimeOrNull(body.start_time, 'start_time');
      if (r.error) return r.error;
      if (r.value === null) return NextResponse.json({ error: 'Validation', field: 'start_time', message: START_TIME_REQUIRED_WORDS }, { status: 400 });
      effectiveStartTime = r.value;
      data.start_time = r.value;
    }
    if ('end_time' in body) {
      const r = parseTimeOrNull(body.end_time, 'end_time');
      if (r.error) return r.error;
      effectiveEndTime = r.value;
      data.end_time = r.value;
    }
    // MOVE-01 (Alex, 2026-10-19): an end before the start ends the next day; only an empty window is refused.
    if (effectiveStartTime && effectiveEndTime && effectiveStartTime.getTime() === effectiveEndTime.getTime()) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_time', message: EMPTY_WINDOW_WORDS },
        { status: 400 }
      );
    }
    const effectiveStartTimeStr = effectiveStartTime ? effectiveStartTime.toISOString().slice(11, 16) : '';
    const effectiveClock = clockOfTime(effectiveStartTimeStr);

    // Recompile RRULE if any cadence-related field is supplied.
    const cadenceFieldsPresent =
      body.cadence_mode !== undefined ||
      body.weekly_byday !== undefined ||
      body.monthly_day_of_month !== undefined ||
      body.monthly_nth !== undefined ||
      body.monthly_weekday !== undefined ||
      body.custom_rrule !== undefined ||
      body.byhour !== undefined ||
      body.byminute !== undefined;

    if (cadenceFieldsPresent) {
      try {
        // ONEOFF-01: the compile sees the EFFECTIVE start_date, so a one-off
        // patched without re-sending its date still has one. ROUTINE-02b: and
        // the EFFECTIVE start time — the clock it derives.
        const compiled = compileFormToRRule({ ...body, start_date: effectiveStartStr, start_time: effectiveStartTimeStr } as RoutineForm);
        data.schedule_rrule = compiled;
        scheduleChanged = true;
      } catch (e) {
        return NextResponse.json(
          {
            error: 'Validation',
            field: 'schedule_rrule',
            message: e instanceof Error ? e.message : 'invalid cadence configuration',
          },
          { status: 400 }
        );
      }
    } else if (effectiveClock !== null && !sameClock(clockOfRule(existing.schedule_rrule), effectiveClock)) {
      // ROUTINE-02b: no cadence field sent, but the start time names a clock the rule does not — the rule follows the start time.
      data.schedule_rrule = withClock(existing.schedule_rrule, effectiveClock);
      scheduleChanged = true;
    }

    // ONEOFF-01: a one-off (COUNT=1) — whether it just became one or already was —
    // needs its date and ends on it. The window IS the day.
    const nextRrule = (data.schedule_rrule as string | undefined) ?? existing.schedule_rrule;
    if (isOnceRRule(nextRrule)) {
      if (!effectiveStart) {
        return NextResponse.json(
          { error: 'Validation', field: 'start_date', message: 'a one-off needs its date — it cannot be cleared while the cadence is once' },
          { status: 400 }
        );
      }
      if (effectiveEnd && effectiveEnd.getTime() !== effectiveStart.getTime()) {
        return NextResponse.json(
          { error: 'Validation', field: 'end_date', message: 'a one-off ends on the day it happens — leave end_date empty or equal to start_date' },
          { status: 400 }
        );
      }
      data.end_date = effectiveStart;
      effectiveEnd = effectiveStart;
    }
    // ROUTINE-02b: the end time is the window — required with the start time when either is sent; a one-off's window is its day.
    if (('start_time' in body || 'end_time' in body) && effectiveStartTime !== null && effectiveEndTime === null && !isOnceRRule(nextRrule)) {
      return NextResponse.json({ error: 'Validation', field: 'end_time', message: END_TIME_REQUIRED_WORDS }, { status: 400 });
    }

    // ONEOFF-01: the place. Any of the three sent → the effective triple is
    // validated whole (the pair is all-or-nothing) and all three are written.
    if ('location' in body || 'latitude' in body || 'longitude' in body) {
      const place = parsePlaceInput({
        location: 'location' in body ? body.location : existing.location,
        latitude: 'latitude' in body ? body.latitude : existing.latitude != null ? Number(existing.latitude) : null,
        longitude: 'longitude' in body ? body.longitude : existing.longitude != null ? Number(existing.longitude) : null,
      });
      if ('error' in place) return NextResponse.json({ error: 'Validation', ...place.error }, { status: 400 });
      data.location = place.value.location;
      data.latitude = place.value.latitude;
      data.longitude = place.value.longitude;
    }

    // If cadence/timezone/anchor/end changed, recompute next_due_at — anchored on
    // the effective start_date (ONEOFF-01: the one mechanism) and bounded by the
    // effective end_date (ROUTINE-02a): null once nothing remains before the end.
    if (scheduleChanged) {
      const nextTz = (data.timezone as string | undefined) ?? existing.timezone;
      try {
        const upcoming = expandForward(nextRrule, nextTz, new Date(), 1, scheduleAnchor(effectiveStart), effectiveEnd);
        data.next_due_at = upcoming[0] ?? null;
      } catch (e) {
        console.error('[Routine PATCH] next_due_at recompute failed', e);
      }
    }

    // ROUTINE-02b: HISTORY FOLLOWS THE TIME. When the clock or the zone changes, the rows keyed to the old
    // instants move with it, in ONE transaction with the routine's row — or the whole edit is refused by name.
    const nextTz = (data.timezone as string | undefined) ?? existing.timezone;
    const clockMoved = !sameClock(clockOfRule(existing.schedule_rrule), clockOfRule(nextRrule)) && clockOfRule(nextRrule) !== null;
    // A stored name that differs only by case names the same zone (ROUTINE-02a): no move.
    const zoneMoved = canonicalZone(existing.timezone) !== canonicalZone(nextTz);
    let routine: Prisma.operations_routinesGetPayload<Record<string, never>>;
    let rekeyed: RekeyCounts | null = null;
    let movedRecords: { readonly before: StopRecordRow; readonly after: StopRecordRow }[] = [];
    if (clockMoved || zoneMoved) {
      const before: RekeySchedule = { timezone: existing.timezone, schedule_rrule: existing.schedule_rrule, start_date: existing.start_date, end_date: existing.end_date };
      const after: RekeySchedule = { timezone: nextTz, schedule_rrule: nextRrule, start_date: effectiveStart, end_date: effectiveEnd };
      try {
        const outcome = await prisma.$transaction(async (tx) => {
          await lockRoutine(tx, id, user.id);
          // The routine's plans: itself and every line it has had — archived lines' rows are history too.
          const lineIds = (await tx.operations_routine_steps.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true } })).map((s) => s.id);
          const planOr = [{ routine_id: id }, ...(lineIds.length > 0 ? [{ step_id: { in: lineIds } }] : [])];
          const linkOr = [{ target_kind: 'routine', target_id: id }, ...(lineIds.length > 0 ? [{ target_kind: 'routine_line', target_id: { in: lineIds } }] : [])];
          const completions = await tx.operations_routine_completions.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true, expected_at: true } });
          const records = await tx.operations_stop_records.findMany({ where: { user_id: user.id, OR: planOr } });
          const vendors = await tx.planned_item_vendors.findMany({ where: { user_id: user.id, occurrence_at: { not: null }, OR: planOr }, select: { id: true, routine_id: true, step_id: true, occurrence_at: true } });
          const links = await tx.planned_item_links.findMany({ where: { user_id: user.id, target_instant: { not: null }, OR: linkOr }, select: { id: true, target_instant: true } });
          const instants = [
            ...completions.map((c) => c.expected_at),
            ...records.map((r) => r.occurrence_at),
            ...vendors.map((v) => v.occurrence_at as Date),
            ...links.map((l) => l.target_instant as Date),
          ];
          const plan = rekeyPlan(before, after, instants, now);
          if (!plan.ok) throw new RekeyRefused(plan.status, plan.message);
          const toOf = new Map(plan.moves.map((m) => [m.from.getTime(), m.to]));
          const targets = plan.moves.map((m) => m.to);
          const planKey = (r: { routine_id: string | null; step_id: string | null }, at: Date) => `${r.routine_id ?? ''}|${r.step_id ?? ''}|${at.getTime()}`;
          if (targets.length > 0) {
            // Every target proven empty, per table and per plan, BEFORE any write; the partial unique indexes are the backstop for a race.
            const takenCompletions = new Set((await tx.operations_routine_completions.findMany({ where: { routine_id: id, expected_at: { in: targets } }, select: { expected_at: true } })).map((c) => c.expected_at.getTime()));
            for (const c of completions) { const to = toOf.get(c.expected_at.getTime()); if (to && takenCompletions.has(to.getTime())) throw new RekeyRefused(409, occupiedWords('completions', to, nextTz)); }
            const takenRecords = new Set((await tx.operations_stop_records.findMany({ where: { user_id: user.id, OR: planOr, occurrence_at: { in: targets } }, select: { routine_id: true, step_id: true, occurrence_at: true } })).map((r) => planKey(r, r.occurrence_at)));
            for (const r of records) { const to = toOf.get(r.occurrence_at.getTime()); if (to && takenRecords.has(planKey(r, to))) throw new RekeyRefused(409, occupiedWords('stop_records', to, nextTz)); }
            const takenVendors = new Set((await tx.planned_item_vendors.findMany({ where: { user_id: user.id, OR: planOr, occurrence_at: { in: targets } }, select: { routine_id: true, step_id: true, occurrence_at: true } })).map((v) => planKey(v, v.occurrence_at as Date)));
            for (const v of vendors) { const to = toOf.get((v.occurrence_at as Date).getTime()); if (to && takenVendors.has(planKey(v, to))) throw new RekeyRefused(409, occupiedWords('plan_vendors', to, nextTz)); }
            // A plan link is keyed by its posting (journal_entry_id unique), never by the instant — many postings may link one occurrence; nothing to prove.
          }
          const counts = { completions: 0, stop_records: 0, plan_vendors: 0, plan_links: 0 };
          const moved: { readonly before: StopRecordRow; readonly after: StopRecordRow }[] = [];
          // The completions through their one writer (TASKS-ONE-02: routineCompletion.ts).
          counts.completions = await moveCompletions(tx, { userId: user.id, routineId: id, to: toOf });
          for (const r of records) { const to = toOf.get(r.occurrence_at.getTime()); if (to) { const afterRow = await tx.operations_stop_records.update({ where: { id: r.id }, data: { occurrence_at: to } }); moved.push({ before: stopRecordRowOf(r), after: stopRecordRowOf(afterRow) }); counts.stop_records += 1; } }
          for (const v of vendors) { const to = toOf.get((v.occurrence_at as Date).getTime()); if (to) { await tx.planned_item_vendors.update({ where: { id: v.id }, data: { occurrence_at: to } }); counts.plan_vendors += 1; } }
          for (const l of links) { const to = toOf.get((l.target_instant as Date).getTime()); if (to) { await tx.planned_item_links.update({ where: { id: l.id }, data: { target_instant: to } }); counts.plan_links += 1; } }
          const row = await tx.operations_routines.update({ where: { id }, data });
          return { routine: row, counts: { days: plan.moves.length, ...counts, not_on_old_clock: plan.notOnOldClock.length } satisfies RekeyCounts, moved };
        }, { timeout: 60000 });
        routine = outcome.routine;
        rekeyed = outcome.counts;
        movedRecords = outcome.moved;
      } catch (error) {
        if (error instanceof RekeyRefused) {
          return NextResponse.json({ error: error.status === 409 ? 'Conflict' : 'Validation', field: 'start_time', message: error.message }, { status: error.status });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return NextResponse.json({ error: 'Conflict', field: 'start_time', message: "cannot move the routine's history: a row already sits at a target instant (written while this edit ran) — try again" }, { status: 409 });
        }
        throw error;
      }
    } else {
      routine = await prisma.operations_routines.update({
        where: { id },
        data,
      });
    }

    let actionType: 'operations_routine_deactivated' | 'operations_routine_updated';
    let description: string;
    if (activationToggle === 'deactivated') {
      actionType = 'operations_routine_deactivated';
      description = `Deactivated routine "${existing.name}"`;
    } else {
      // activationToggle === 'reactivated' OR no toggle: both audit as _updated
      // in v0 (no _reactivated enum exists; future PR can add one for the
      // priority engine to discriminate).
      actionType = 'operations_routine_updated';
      description = activationToggle === 'reactivated'
        ? `Reactivated routine "${existing.name}"`
        : `Updated routine "${existing.name}"`;
    }

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: { type: actionType, description },
      target: {
        table: 'operations_routines',
        id: routine.id,
      },
      payload: {
        before: existing,
        after: routine,
        metadata: {
          schedule_changed: scheduleChanged,
          activation_toggle: activationToggle,
        },
      },
    });

    // ROUTINE-02b: the move, once — the counts per table, the rule and zone before → after — then each record's own precedent.
    if (rekeyed !== null) {
      const fromClock = clockOfRule(existing.schedule_rrule);
      const toClock = clockOfRule(routine.schedule_rrule);
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'operations_routine_rekeyed',
          description: rekeyedWords(existing.name, fromClock === null ? 'no clock' : clockWords(fromClock), toClock === null ? 'no clock' : clockWords(toClock), existing.timezone, routine.timezone, rekeyed),
        },
        target: { table: 'operations_routines', id: routine.id },
        payload: {
          before: { schedule_rrule: existing.schedule_rrule, timezone: existing.timezone },
          after: { schedule_rrule: routine.schedule_rrule, timezone: routine.timezone },
          metadata: { ...rekeyed },
        },
      });
      for (const m of movedRecords) {
        await writeAuditLog({
          actor: { user_id: user.id, email: userEmail, type: 'human_user' },
          action: { type: 'operations_stop_moved', description: movedWords(m.before, m.before.occurrence_at, m.after.occurrence_at) },
          target: { table: 'operations_stop_records', id: m.before.id },
          payload: { before: m.before, after: m.after, metadata: { from: m.before.occurrence_at, to: m.after.occurrence_at, routine_id: routine.id, moved_with: 'operations_routine_rekeyed' } },
        });
      }
    }

    return NextResponse.json({ routine, rekeyed });
  } catch (error) {
    return failClosedResponse('Routine PATCH', 'Failed to update routine', error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedRoutine(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_routines.delete({ where: { id } });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_routine_deleted',
        description: `Deleted routine "${existing.name}"`,
      },
      target: {
        table: 'operations_routines',
        id: existing.id,
      },
      payload: {
        before: existing,
        metadata: {
          cascade_note: 'operations_routine_completions cascade-deleted via FK',
        },
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id });
  } catch (error) {
    return failClosedResponse('Routine DELETE', 'Failed to delete routine', error);
  }
}
