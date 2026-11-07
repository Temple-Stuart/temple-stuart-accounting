import type { PrismaClient } from '@prisma/client';
import { buildRoutineBudgetLines } from '@/lib/budget/days';
import { BudgetInputError, toReportAccount, toReportEntity, toRoutinePlanInput } from '@/lib/budget/reportInputs';
import type { RoutineWords } from '@/lib/budget/planLines';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { LINKED_POSTING_SELECT } from '@/lib/calendar/postingAmount';
import { ledgerOf, linkInputOf, type LedgerRecordInput } from '@/lib/operations/ledger';
import { refusedWords, stopRecordRowOf } from '@/lib/operations/stopRecord';
import { plannedMinutesOf } from '@/lib/operations/supersession';
import { stayRowOf } from '@/lib/operations/stay';
import { instantToZoned } from '@/lib/time';

/**
 * READS-01b (Alex, 2026-11-07, ruling A) — THE TASK LEDGER'S ANSWER, AS A FUNCTION.
 *
 * GET /api/operations/ledger's body after its gate and its span (LEDGER-01, LEDGER-03, TIME-03, WORK-03b — the route's
 * header keeps the story), moved here VERBATIM: the two windows, the caller's entities, the eight reads beside each
 * other (the chart, the ONE loader per entity, the routine roles, the plan's vendors, the stays, the records in the
 * span's window with their plan's words, the first record, the occurrence links with each posting's lines), the words,
 * the accounts, the first record's day, ledgerOf, and the exact answer object the route serializes —
 * `{ from, to, as_of, first_record, rows, said }`. RECORD_PLAN and its helpers (RecordRow, recordInputOf, HOUR_MS,
 * DAY_MS, messageOf) moved with it (SUPERSEDE-00 decision 9); the registry's Time row cites RECORD_PLAN's two lines here.
 *
 * The caller's id is the parameter: every where names it (userId / user_id: userId). THE CLOCK IS NOT READ HERE: `now`
 * is a parameter — the route reads it once and hands it in, and so does /api/home-ledger, which calls this function
 * directly instead of the route (no route calls a route — HOME-LEDGER-01's in-process call retired here, as READS-01a
 * retired the travel ones). No read is reordered, renamed, widened or narrowed; no query is added. READ-ONLY: zero
 * writes, no travel, no paid service. The answer is WIRE-SHAPED as built: the rows (ledger.ts LedgerRow) and what is said
 * carry strings, numbers, booleans and nulls — `day` is 'YYYY-MM-DD', the address's instant and as_of ISO text — so the
 * one reader (travelLedger.ts listOf, in the home ledger) sees exactly what it saw through the JSON wire. A refusal
 * thrown here (BudgetDaysError, BudgetInputError, a row naming no plan) lands in the caller's catch, as it did in the
 * route's.
 */
type Db = Pick<PrismaClient, 'entities' | 'chart_of_accounts' | 'operations_routines' | 'planned_item_vendors' | 'operations_stays' | 'operations_stop_records' | 'planned_item_links'>;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The plan's words a record is read with: the step's routine for a line, the routine for a stepless one. */
const RECORD_PLAN = {
  routine: { select: { name: true, timezone: true, role: true, start_time: true, end_time: true } },
  step: { select: { activity: true, time_of_day: true, duration_minutes: true, routine_id: true, routine: { select: { name: true, timezone: true, role: true } } } },
} as const;

type RecordRow = Parameters<typeof stopRecordRowOf>[0] & {
  readonly routine: { readonly name: string; readonly timezone: string; readonly role: string; readonly start_time: Date | null; readonly end_time: Date | null } | null;
  readonly step: { readonly activity: string; readonly time_of_day: Date | null; readonly duration_minutes: number | null; readonly routine_id: string; readonly routine: { readonly name: string; readonly timezone: string; readonly role: string } } | null;
};

/** A row with its plan's words → the rule's input. A row naming no plan is the database's error (the migration's CHECK holds one). */
function recordInputOf(row: RecordRow): LedgerRecordInput {
  const record = stopRecordRowOf(row);
  if (row.step !== null) {
    return { record, routineId: row.step.routine_id, routineName: row.step.routine.name, zone: row.step.routine.timezone, role: row.step.routine.role, activity: row.step.activity, timeOfDay: row.step.time_of_day === null ? null : row.step.time_of_day.toISOString().slice(11, 16), durationMinutes: plannedMinutesOf({ kind: 'line', duration_minutes: row.step.duration_minutes }) };
  }
  if (row.routine === null || row.routine_id === null) throw new Error(`ledger GET: record ${row.id} names no plan — the migration's CHECK holds one`);
  return { record, routineId: row.routine_id, routineName: row.routine.name, zone: row.routine.timezone, role: row.routine.role, activity: null, timeOfDay: null, durationMinutes: plannedMinutesOf({ kind: 'routine', start_time: row.routine.start_time, end_time: row.routine.end_time }) };
}

/** LEDGER-03: a link as the rule joins it — the three fields a record is addressed by, and the posting's amount by the one rule. A link of a routine kind with no instant is the database's error (the migration's CHECK holds one). */
// ROUTINES-03 (Alex, 2026-10-25): linkInputOf moved to ledger.ts, unchanged — the routines' month route reads a link the same way.

/** The task ledger for a span of days — the route's body after its gate, the clock handed in. */
export async function taskLedgerAnswerOf(db: Db, userId: string, span: { from: string; to: string }, now: Date) {
  const { from, to } = span;
  // The instants that can fall on a day of the span in ANY zone (stopRecord.ts recordWindow's rule, over the span); the rule places each exactly.
  const recordsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - 14 * HOUR_MS);
  const recordsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 36 * HOUR_MS);
  // The occurrence vendors' window (planLines.ts vendorWindow's rule, over the span).
  const vendorsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - DAY_MS);
  const vendorsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 2 * DAY_MS);

  const entities = await db.entities.findMany({ where: { userId: userId }, select: { id: true, name: true, entity_type: true }, orderBy: { name: 'asc' } });
  const entityIds = entities.map((e) => e.id);
  const books = entities.map(toReportEntity);

  const [chart, routineGroups, roles, planVendors, stayRows, recordRows, firstRow, linkRows] = await Promise.all([
    db.chart_of_accounts.findMany({
      where: { entity_id: { in: entityIds }, entity: { userId: userId } },
      select: { entity_id: true, code: true, name: true, account_type: true, balance_type: true },
    }),
    Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(db, userId, e.id) }))),
    db.operations_routines.findMany({ where: { user_id: userId }, select: { id: true, role: true } }),
    db.planned_item_vendors.findMany({
      where: { user_id: userId, OR: [{ occurrence_at: null }, { occurrence_at: { gte: vendorsFrom, lt: vendorsTo } }] },
      select: {
        id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true,
        vendor: { select: { id: true, vendor_name: true, entity_id: true } },
        routine: { select: { name: true, timezone: true } },
        step: { select: { activity: true, routine_id: true, routine: { select: { name: true, timezone: true } } } },
        task: { select: { title: true } },
      },
    }),
    db.operations_stays.findMany({ where: { user_id: userId }, orderBy: { starts_on: 'asc' } }),
    db.operations_stop_records.findMany({
      where: { user_id: userId, occurrence_at: { gte: recordsFrom, lt: recordsTo } },
      include: RECORD_PLAN,
      orderBy: { occurrence_at: 'asc' },
    }),
    db.operations_stop_records.findFirst({ where: { user_id: userId }, include: RECORD_PLAN, orderBy: { occurrence_at: 'asc' } }),
    // LEDGER-03: the caller's links of a routine occurrence or a line, in the records' window, with each posting's lines — one query.
    db.planned_item_links.findMany({
      where: { user_id: userId, target_kind: { in: ['routine', 'routine_line'] }, target_instant: { gte: recordsFrom, lt: recordsTo }, journal_entry: { userId: userId } },
      select: { target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: { select: LINKED_POSTING_SELECT } },
      orderBy: { linked_at: 'asc' },
    }),
  ]);

  const bookOf = (entityId: string, what: string) => {
    const book = books.find((b) => b.id === entityId);
    if (book === undefined) throw new BudgetInputError('unknown-entity', `${what} names entity ${entityId}, which is not one of the caller's entities`);
    return book;
  };
  const routineInputs = routineGroups.flatMap((group) => group.rows.map((row) => toRoutinePlanInput(row, bookOf(group.entityId, `the routines of entity ${group.entityId}`))));
  const built = buildRoutineBudgetLines(routineInputs, from, to);
  const routineWords = new Map<string, RoutineWords>(routineGroups.flatMap((group) => group.rows.map((row): [string, RoutineWords] => [row.id, {
    name: row.name,
    timezone: row.timezone,
    steps: new Map(row.steps.map((s) => [s.id, { activity: s.activity, timeOfDay: s.time_of_day }])),
  }])));
  const accounts = chart.map((row) => toReportAccount(row, bookOf(row.entity_id, `chart row ${JSON.stringify(row.code)}`)));

  // The earliest instant is the earliest local day in every zone (UTC−12 … UTC+14 cannot reorder two instants' days).
  let firstRecord: { readonly day: string } | { readonly words: string } | null = null;
  if (firstRow !== null) {
    const first = recordInputOf(firstRow);
    try {
      firstRecord = { day: instantToZoned(new Date(first.record.occurrence_at), first.zone).date };
    } catch (error) {
      firstRecord = { words: refusedWords('timezone not recognised', `${JSON.stringify(first.zone)}: ${messageOf(error)}`) };
    }
  }

  const ledger = ledgerOf({
    from,
    to,
    now,
    records: recordRows.map(recordInputOf),
    links: linkRows.map(linkInputOf),
    lines: built.lines,
    notPlaced: built.notPlaced,
    routines: routineWords,
    roles: new Map(roles.map((r) => [r.id, r.role])),
    vendors: planVendors,
    stays: stayRows.map(stayRowOf),
    accounts: accounts.map((a) => ({ entityId: a.entityId, code: a.code, name: a.name })),
    books: books.map((b) => ({ id: b.id, entityType: b.entityType })),
  });
  return { from, to, as_of: now.toISOString(), first_record: firstRecord, rows: ledger.rows, said: ledger.said };
}

export type TaskLedgerAnswer = Awaited<ReturnType<typeof taskLedgerAnswerOf>>;
