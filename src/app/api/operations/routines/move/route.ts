/**
 * POST /api/operations/routines/move — "I'M MOVING": THE DATED MOVE (MOVE-01, Alex, 2026-10-19).
 *
 * The body is the control's list: the first day there, the new zone, the
 * stay (a place with its last day, or null) and one entry per current
 * routine { id, carry, start_time, end_time }. The plan is decided by ONE
 * pure rule (src/lib/operations/routineMove.ts planMove — the same the form
 * showed, no drift) over the caller's own rows, then written in ONE
 * $transaction with every old routine held (lockRoutine):
 *   · every listed routine that starts before the date ends at date−1,
 *     renamed "<name> (to <date−1>)" (one name per user); its next_due_at
 *     is recomputed bounded by the new end (nextDueAfter, ROUTINE-02a);
 *   · each carried routine gets its copy — the same rule with the row's
 *     clock, the row's window (it may cross midnight), start_date = the
 *     date, the old end when on/after the date, the new zone, the active
 *     lines copied; NO location, coordinates or vendors (the old city's);
 *   · a routine that starts on/after the date, a one-off included, is
 *     re-zoned — proven to hold no instant-keyed row first (a record,
 *     completion, plan vendor or link), else refused by name: ROUTINE-02b's
 *     rekey would move that history and lives in the routine's own PATCH;
 *   · when a place is given, the stay covering date−1 is shortened to it
 *     when it ran later, and the new stay is created; an overlap refused the
 *     plan before any write (the trigger is the backstop for a race).
 *   · ALLDAY-01 (Alex, 2026-10-19): an all-day routine (role all_day — a
 *     charge on a date) is left as it is: not listed, not ended, not copied,
 *     not re-zoned; the plan's words and the audit row say how many.
 * Any refusal rolls the whole move back and says why (400 / 404 / 409).
 * After the write: the per-row audits the create, update and stay paths
 * already write, then ONE operations_routines_moved naming the date, the
 * zone, every ended routine with its copy or "no copy", the re-zoned ids
 * and the stay ids. The answer lists every pair by name.
 *
 * Security: the stops GET's order — getVerifiedEmail → 401, the user → 404,
 * then the body; every query names the caller (user_id); no paid call.
 * No defaults for the date or the zone — a missing one is refused by name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { BODY_WORDS, ENTRIES_WORDS, MoveRefused, hasHistoryWords, nameTakenWords, planMove, type MoveEntry } from '@/lib/operations/routineMove';
import { lockRoutine, nextDueAfter } from '@/lib/operations/routineCompletion';
import { OVERLAP_TAG, RACE_WORDS, asDate, stayRowOf, type StayRow } from '@/lib/operations/stay';
import { carriesPlanMoney, planMoney, type PlanBook, type PlanMoney } from '@/lib/operations/planMoney';
import { loadPlanBook } from '@/lib/operations/loadPlanBook';

type Tx = Prisma.TransactionClient;
type RoutineRow = Prisma.operations_routinesGetPayload<{ include: { steps: true } }>;

/** 'HH:MM' → the @db.Time value the time parser writes (1970-01-01, UTC; Postgres keeps the time). */
const timeValue = (hhmm: string): Date => new Date(Date.UTC(1970, 0, 1, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)), 0, 0));

/** The entries as sent — each field by name; anything else is refused before the plan reads it. */
function readEntries(raw: unknown): { ok: true; entries: MoveEntry[] } | { ok: false; field: string; message: string } {
  if (!Array.isArray(raw)) return { ok: false, field: 'routines', message: ENTRIES_WORDS };
  const entries: MoveEntry[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const e = raw[i];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return { ok: false, field: `routines[${i}]`, message: ENTRIES_WORDS };
    const o = e as Record<string, unknown>;
    if (typeof o.id !== 'string') return { ok: false, field: `routines[${i}].id`, message: 'id is required (a string)' };
    if (typeof o.carry !== 'boolean') return { ok: false, field: `routines[${i}].carry`, message: 'carry is required (true or false)' };
    if (typeof o.start_time !== 'string') return { ok: false, field: `routines[${i}].start_time`, message: 'start_time is required (HH:MM)' };
    if (typeof o.end_time !== 'string') return { ok: false, field: `routines[${i}].end_time`, message: 'end_time is required (HH:MM)' };
    entries.push({ id: o.id, carry: o.carry, start_time: o.start_time, end_time: o.end_time });
  }
  return { ok: true, entries };
}

/** A re-zoned routine must hold no instant-keyed row — proven here, inside the transaction, never assumed (Alex 4 yes). */
async function proveNoHistory(tx: Tx, userId: string, routine: RoutineRow): Promise<void> {
  const lineIds = (await tx.operations_routine_steps.findMany({ where: { routine_id: routine.id, user_id: userId }, select: { id: true } })).map((s) => s.id);
  const planOr = [{ routine_id: routine.id }, ...(lineIds.length > 0 ? [{ step_id: { in: lineIds } }] : [])];
  const linkOr = [{ target_kind: 'routine', target_id: routine.id }, ...(lineIds.length > 0 ? [{ target_kind: 'routine_line', target_id: { in: lineIds } }] : [])];
  const held =
    (await tx.operations_routine_completions.count({ where: { routine_id: routine.id, user_id: userId } })) +
    (await tx.operations_stop_records.count({ where: { user_id: userId, OR: planOr } })) +
    (await tx.planned_item_vendors.count({ where: { user_id: userId, occurrence_at: { not: null }, OR: planOr } })) +
    (await tx.planned_item_links.count({ where: { user_id: userId, target_instant: { not: null }, OR: linkOr } }));
  if (held > 0) throw new MoveRefused(409, 'routines', hasHistoryWords(routine.name));
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
      return NextResponse.json({ error: 'Validation', field: 'date', message: BODY_WORDS }, { status: 400 });
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return NextResponse.json({ error: 'Validation', field: 'date', message: BODY_WORDS }, { status: 400 });
    const body = raw as Record<string, unknown>;
    // No defaults: the date and the zone come from the caller or the plan refuses them by name.
    const date = typeof body.date === 'string' ? body.date : '';
    const timezone = typeof body.timezone === 'string' ? body.timezone : '';
    let stay: { place: string; ends_on: string } | null = null;
    if (body.stay !== null && body.stay !== undefined) {
      if (typeof body.stay !== 'object' || Array.isArray(body.stay)) return NextResponse.json({ error: 'Validation', field: 'stay', message: 'stay is null or { place, ends_on }' }, { status: 400 });
      const s = body.stay as Record<string, unknown>;
      stay = { place: typeof s.place === 'string' ? s.place : '', ends_on: typeof s.ends_on === 'string' ? s.ends_on : '' };
    }
    const read = readEntries(body.routines);
    if (!read.ok) return NextResponse.json({ error: 'Validation', field: read.field, message: read.message }, { status: 400 });

    const now = new Date();
    // The caller's own rows — the plan judges which are current and refuses an entry naming anything else.
    const routines = await prisma.operations_routines.findMany({
      where: { user_id: user.id, is_active: true },
      include: { steps: { where: { is_active: true }, orderBy: { step_order: 'asc' } } },
    });
    const stays: StayRow[] = (await prisma.operations_stays.findMany({ where: { user_id: user.id }, orderBy: { starts_on: 'asc' } })).map(stayRowOf);
    const plan = planMove({ date, timezone, now, stay, routines, entries: read.entries, stays });
    if (!plan.ok) {
      return NextResponse.json({ error: plan.status === 409 ? 'Conflict' : plan.status === 404 ? 'Not found' : 'Validation', field: plan.field, message: plan.message }, { status: plan.status });
    }
    const rowById = new Map(routines.map((r) => [r.id, r]));

    // INTAKE-01: a copy's money — the routine's and every line's — goes through the one rule against the
    // routine's book, as the create route's does; a stored pair the book no longer admits is refused by name.
    const books = new Map<string, PlanBook | null>();
    const moneyOf = new Map<string, { readonly routine: PlanMoney; readonly lines: PlanMoney[] }>();
    for (const c of plan.copies) {
      const from = rowById.get(c.from_id) as RoutineRow;
      const routineSent = { amount: from.budget_amount === null ? null : from.budget_amount.toString(), account: from.coa_code };
      const lineSent = from.steps.map((l) => ({ amount: l.budget_amount === null ? null : l.budget_amount.toString(), account: l.coa_code }));
      let book: PlanBook | null = null;
      if (carriesPlanMoney(routineSent) || lineSent.some(carriesPlanMoney)) {
        if (!books.has(from.entity_id)) books.set(from.entity_id, await loadPlanBook(prisma, user.id, from.entity_id));
        book = books.get(from.entity_id) ?? null;
        if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      const routineMoney = planMoney(routineSent, book, 'routine', { amount: `${from.name}.budget_amount`, account: `${from.name}.coa_code` });
      if ('error' in routineMoney) return NextResponse.json({ error: 'Validation', ...routineMoney.error }, { status: 400 });
      const lines: PlanMoney[] = [];
      for (let i = 0; i < lineSent.length; i += 1) {
        const m = planMoney(lineSent[i], book, 'routine', { amount: `${from.name}.lines[${i}].budget_amount`, account: `${from.name}.lines[${i}].coa_code` });
        if ('error' in m) return NextResponse.json({ error: 'Validation', ...m.error }, { status: 400 });
        lines.push(m.value);
      }
      moneyOf.set(c.from_id, { routine: routineMoney.value, lines });
    }

    let outcome: {
      readonly ended: { readonly before: RoutineRow; readonly after: RoutineRow }[];
      readonly copies: { readonly from: RoutineRow; readonly row: RoutineRow; readonly lines: number }[];
      readonly rezoned: { readonly before: RoutineRow; readonly after: RoutineRow }[];
      readonly shortened: { readonly before: StayRow; readonly after: StayRow } | null;
      readonly opened: StayRow | null;
    };
    try {
      outcome = await prisma.$transaction(async (tx) => {
        for (const e of plan.ends) await lockRoutine(tx, e.id, user.id);
        for (const z of plan.rezoned) await lockRoutine(tx, z.id, user.id);
        for (const z of plan.rezoned) await proveNoHistory(tx, user.id, rowById.get(z.id) as RoutineRow);

        // The ends first — the copy takes the bare name the ended one gives up.
        const ended: { before: RoutineRow; after: RoutineRow }[] = [];
        for (const e of plan.ends) {
          const before = rowById.get(e.id) as RoutineRow;
          const endDate = asDate(e.end_date);
          const row = await tx.operations_routines.update({
            where: { id: e.id, user_id: user.id },
            data: { name: e.renamed, end_date: endDate, next_due_at: nextDueAfter({ schedule_rrule: before.schedule_rrule, timezone: before.timezone, start_date: before.start_date, end_date: endDate }, now) },
            include: { steps: true },
          });
          ended.push({ before, after: row });
        }
        const copies: { from: RoutineRow; row: RoutineRow; lines: number }[] = [];
        for (const c of plan.copies) {
          const from = rowById.get(c.from_id) as RoutineRow;
          const money = moneyOf.get(c.from_id) as { readonly routine: PlanMoney; readonly lines: PlanMoney[] };
          const startDate = asDate(c.start_date);
          const endDate = c.end_date === null ? null : asDate(c.end_date);
          const row = await tx.operations_routines.create({
            data: {
              user_id: user.id,
              entity_id: from.entity_id,
              name: c.name,
              description: from.description,
              schedule_rrule: c.schedule_rrule,
              timezone: plan.timezone,
              ideal_time_label: from.ideal_time_label,
              fail_threshold_minutes: from.fail_threshold_minutes,
              role: from.role,
              start_date: startDate,
              end_date: endDate,
              start_time: timeValue(c.start_time),
              end_time: timeValue(c.end_time),
              is_active: true,
              next_due_at: nextDueAfter({ schedule_rrule: c.schedule_rrule, timezone: plan.timezone, start_date: startDate, end_date: endDate }, now),
              // INTAKE-01: as the rule read them — the account is the chart row's code as saved.
              budget_amount: money.routine.amount,
              coa_code: money.routine.coaCode,
              // The old city's: no place, no coordinates (and no vendor — those rows belong to the old plan).
              location: null,
              latitude: null,
              longitude: null,
              created_by: userEmail,
            },
            include: { steps: true },
          });
          if (from.steps.length > 0) {
            await tx.operations_routine_steps.createMany({
              data: from.steps.map((s, i) => ({
                routine_id: row.id,
                user_id: user.id,
                entity_id: s.entity_id,
                step_order: s.step_order,
                activity: s.activity,
                sub_activity: s.sub_activity,
                budget_amount: money.lines[i].amount,
                coa_code: money.lines[i].coaCode,
                duration_minutes: s.duration_minutes,
                time_of_day: s.time_of_day,
                notes: s.notes,
                created_by: userEmail,
              })),
            });
          }
          copies.push({ from, row, lines: from.steps.length });
        }
        const rezoned: { before: RoutineRow; after: RoutineRow }[] = [];
        for (const z of plan.rezoned) {
          const before = rowById.get(z.id) as RoutineRow;
          const row = await tx.operations_routines.update({
            where: { id: z.id, user_id: user.id },
            data: { timezone: plan.timezone, next_due_at: nextDueAfter({ schedule_rrule: before.schedule_rrule, timezone: plan.timezone, start_date: before.start_date, end_date: before.end_date }, now) },
            include: { steps: true },
          });
          rezoned.push({ before, after: row });
        }
        let shortened: { before: StayRow; after: StayRow } | null = null;
        let opened: StayRow | null = null;
        if (plan.stay !== null) {
          if (plan.stay.shorten !== null) {
            const before = stays.find((s) => s.id === plan.stay?.shorten?.id) as StayRow;
            const after = stayRowOf(await tx.operations_stays.update({ where: { id: plan.stay.shorten.id, user_id: user.id }, data: { ends_on: asDate(plan.stay.shorten.ends_on) } }));
            shortened = { before, after };
          }
          opened = stayRowOf(await tx.operations_stays.create({ data: { user_id: user.id, place: plan.stay.create.place, starts_on: asDate(plan.stay.create.starts_on), ends_on: asDate(plan.stay.create.ends_on) } }));
        }
        return { ended, copies, rezoned, shortened, opened };
      }, { timeout: 60000 });
    } catch (error) {
      if (error instanceof MoveRefused) {
        return NextResponse.json({ error: error.status === 409 ? 'Conflict' : error.status === 404 ? 'Not found' : 'Validation', field: error.field, message: error.message }, { status: error.status });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Conflict', field: 'routines', message: nameTakenWords('a renamed original or a copy') }, { status: 409 });
      }
      if (error instanceof Error && error.message.includes(OVERLAP_TAG) && plan.stay !== null) {
        return NextResponse.json({ error: 'Conflict', field: 'stay', message: RACE_WORDS(plan.stay.create.starts_on, plan.stay.create.ends_on) }, { status: 409 });
      }
      throw error;
    }

    // The per-row audits the create, update and stay paths write, then the move itself, once.
    const actor = { user_id: user.id, email: userEmail, type: 'human_user' as const };
    for (const { before, after } of outcome.ended) {
      await writeAuditLog({
        actor,
        action: { type: 'operations_routine_updated', description: `Ended routine "${before.name}" on ${plan.day_before} — moving to ${plan.timezone} from ${plan.date}` },
        target: { table: 'operations_routines', id: after.id },
        payload: { before, after, metadata: { schedule_changed: true, activation_toggle: null, moved_by: 'operations_routines_moved', renamed_to: after.name } },
      });
    }
    for (const { from, row, lines } of outcome.copies) {
      await writeAuditLog({
        actor,
        action: { type: 'operations_routine_created', description: `Created routine "${row.name}" — the copy of ${from.id} in ${plan.timezone} from ${plan.date}` },
        target: { table: 'operations_routines', id: row.id },
        payload: { after: row, metadata: { entity_id: row.entity_id, schedule_rrule: row.schedule_rrule, timezone: row.timezone, once: false, lines, copied_from: from.id, moved_by: 'operations_routines_moved' } },
      });
    }
    for (const { before, after } of outcome.rezoned) {
      await writeAuditLog({
        actor,
        action: { type: 'operations_routine_updated', description: `Re-zoned routine "${before.name}" to ${plan.timezone} — moving from ${plan.date}` },
        target: { table: 'operations_routines', id: after.id },
        payload: { before, after, metadata: { schedule_changed: true, activation_toggle: null, moved_by: 'operations_routines_moved' } },
      });
    }
    if (outcome.shortened !== null) {
      await writeAuditLog({
        actor,
        action: { type: 'operations_stay_set', description: `Changed a stay: ${outcome.shortened.after.place}, ${outcome.shortened.after.starts_on} to ${outcome.shortened.after.ends_on} (moving)` },
        target: { table: 'operations_stays', id: outcome.shortened.after.id },
        payload: { before: outcome.shortened.before, after: outcome.shortened.after, metadata: { moved_by: 'operations_routines_moved' } },
      });
    }
    if (outcome.opened !== null) {
      await writeAuditLog({
        actor,
        action: { type: 'operations_stay_set', description: `Set a stay: ${outcome.opened.place}, ${outcome.opened.starts_on} to ${outcome.opened.ends_on} (moving)` },
        target: { table: 'operations_stays', id: outcome.opened.id },
        payload: { after: outcome.opened, metadata: { moved_by: 'operations_routines_moved' } },
      });
    }
    const pairs = outcome.ended.map(({ before, after }) => {
      const copy = outcome.copies.find((c) => c.from.id === before.id) ?? null;
      return { from: { id: before.id, name: before.name, renamed: after.name, timezone: before.timezone }, copy: copy === null ? null : { id: copy.row.id, name: copy.row.name, lines: copy.lines } };
    });
    const moved = {
      date: plan.date,
      day_before: plan.day_before,
      timezone: plan.timezone,
      pairs,
      rezoned: outcome.rezoned.map(({ after }) => ({ id: after.id, name: after.name })),
      // ALLDAY-01: the charges left as they are.
      all_day: plan.all_day,
      stay: plan.stay === null ? null : { shortened: outcome.shortened === null ? null : outcome.shortened.after, created: outcome.opened },
      words: plan.words,
    };
    await writeAuditLog({
      actor,
      action: { type: 'operations_routines_moved', description: `Moved to ${plan.timezone} from ${plan.date}: ${plan.words}` },
      target: { table: 'operations_routines', id: null },
      payload: {
        metadata: {
          date: plan.date,
          day_before: plan.day_before,
          timezone: plan.timezone,
          ended: pairs.map((p) => ({ id: p.from.id, from_zone: p.from.timezone, copy_id: p.copy === null ? 'no copy' : p.copy.id })),
          rezoned: moved.rezoned.map((r) => r.id),
          all_day: plan.all_day.map((a) => a.id),
          stay_ids: { shortened: outcome.shortened === null ? null : outcome.shortened.after.id, created: outcome.opened === null ? null : outcome.opened.id },
        },
      },
    });

    return NextResponse.json({ moved });
  } catch (error) {
    return failClosedResponse('Routines move POST', 'Failed to move the routines', error);
  }
}
