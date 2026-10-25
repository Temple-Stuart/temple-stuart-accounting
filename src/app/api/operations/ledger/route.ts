/**
 * /api/operations/ledger — the caller's stop records as a ledger (LEDGER-01, Alex, 2026-10-16).
 *
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → { from, to, as_of, first_record, rows,
 *     said }: every stop record of the caller whose stop falls in [from, to] in
 *     its routine's OWN zone (the stops GET's placing), each as
 *     src/lib/operations/ledger.ts LedgerRow — its day, the covering stay's
 *     city and country, the matched budget line's COA, vendor and cents, the
 *     stop's name, the record's stars, note and actual — and what is said under
 *     the table (said). Both parameters are required real days, in order; a span
 *     past 400 days is refused by name (spanInput — a 400 names the field).
 *     first_record is the caller's earliest record's day, for ALL; null when
 *     nothing was recorded; its reason when its zone cannot be read.
 *
 * THE READS, every one by user_id, every entity of the caller (the COA says
 * which book — the page's entity selector does not filter the ledger):
 *   · the entities → one book each; the chart of those entities, its codes read
 *     by the one reader (reportInputs.ts toReportAccount — an unreadable code is
 *     refused by name, as the report refuses it);
 *   · routines through the ONE loader (loadRoutineBudgetInputs), per entity,
 *     then buildRoutineBudgetLines over the span — the lines as the routines
 *     stand today; their roles, read beside, so an all-day line is not counted
 *     as a stop with no record;
 *   · the plan's vendors: every every-occurrence row and the occurrence rows in
 *     the span's window (planLines.ts decides each line's, by the plan's grain);
 *   · the stays; the records in the any-zone window of the span, with their
 *     routine's words (recordWindow's rule, widened to the span);
 *   · LEDGER-03 (Alex, 2026-10-19): the caller's planned_item_links of kind
 *     routine or routine_line whose target_instant lies in the records' window,
 *     ONE query, each posting's lines for the one amount rule
 *     (src/lib/calendar/postingAmount.ts amountCentsOf — the links route's) — the
 *     rule joins each record to its links by (kind, target_id, occurrence_at).
 *     No per-record query.
 * READ ONLY: this route writes nothing, reads no book data, no travel, no paid
 * service. The clock is read HERE, once (as_of); the pure half takes it.
 *
 * FAIL LOUD. A bad parameter → 400 naming it. The day rules refusing a call
 * (BudgetDaysError) or a row that cannot become an input (BudgetInputError) →
 * 500 with its code and message. Anything else → failClosedResponse.
 *
 * The caller's own rows only: the verified cookie, then the user, then every
 * query by user_id (the auth shape of src/app/api/operations/stops/route.ts).
 * Not public.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetDaysError, buildRoutineBudgetLines } from '@/lib/budget/days';
import { BudgetInputError, toReportAccount, toReportEntity, toRoutinePlanInput } from '@/lib/budget/reportInputs';
import type { RoutineWords } from '@/lib/budget/planLines';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { POSTING_LINES_SELECT } from '@/lib/calendar/postingAmount';
import { ledgerOf, linkInputOf, spanInput, type LedgerRecordInput } from '@/lib/operations/ledger';
import { refusedWords, stopRecordRowOf } from '@/lib/operations/stopRecord';
import { stayRowOf } from '@/lib/operations/stay';
import { instantToZoned } from '@/lib/time';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The plan's words a record is read with: the step's routine for a line, the routine for a stepless one. */
const RECORD_PLAN = {
  routine: { select: { name: true, timezone: true, role: true } },
  step: { select: { activity: true, time_of_day: true, routine_id: true, routine: { select: { name: true, timezone: true, role: true } } } },
} as const;

type RecordRow = Parameters<typeof stopRecordRowOf>[0] & {
  readonly routine: { readonly name: string; readonly timezone: string; readonly role: string } | null;
  readonly step: { readonly activity: string; readonly time_of_day: Date | null; readonly routine_id: string; readonly routine: { readonly name: string; readonly timezone: string; readonly role: string } } | null;
};

/** A row with its plan's words → the rule's input. A row naming no plan is the database's error (the migration's CHECK holds one). */
function recordInputOf(row: RecordRow): LedgerRecordInput {
  const record = stopRecordRowOf(row);
  if (row.step !== null) {
    return { record, routineId: row.step.routine_id, routineName: row.step.routine.name, zone: row.step.routine.timezone, role: row.step.routine.role, activity: row.step.activity, timeOfDay: row.step.time_of_day === null ? null : row.step.time_of_day.toISOString().slice(11, 16) };
  }
  if (row.routine === null || row.routine_id === null) throw new Error(`ledger GET: record ${row.id} names no plan — the migration's CHECK holds one`);
  return { record, routineId: row.routine_id, routineName: row.routine.name, zone: row.routine.timezone, role: row.routine.role, activity: null, timeOfDay: null };
}

/** LEDGER-03: a link as the rule joins it — the three fields a record is addressed by, and the posting's amount by the one rule. A link of a routine kind with no instant is the database's error (the migration's CHECK holds one). */
// ROUTINES-03 (Alex, 2026-10-25): linkInputOf moved to ledger.ts, unchanged — the routines' month route reads a link the same way.

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));
    if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });
    const { from, to } = span;
    // The server's clock, once; the pure half takes it.
    const now = new Date();
    // The instants that can fall on a day of the span in ANY zone (stopRecord.ts recordWindow's rule, over the span); the rule places each exactly.
    const recordsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - 14 * HOUR_MS);
    const recordsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 36 * HOUR_MS);
    // The occurrence vendors' window (planLines.ts vendorWindow's rule, over the span).
    const vendorsFrom = new Date(Date.parse(`${from}T00:00:00.000Z`) - DAY_MS);
    const vendorsTo = new Date(Date.parse(`${to}T00:00:00.000Z`) + 2 * DAY_MS);

    const entities = await prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, name: true, entity_type: true }, orderBy: { name: 'asc' } });
    const entityIds = entities.map((e) => e.id);
    const books = entities.map(toReportEntity);

    const [chart, routineGroups, roles, planVendors, stayRows, recordRows, firstRow, linkRows] = await Promise.all([
      prisma.chart_of_accounts.findMany({
        where: { entity_id: { in: entityIds }, entity: { userId: user.id } },
        select: { entity_id: true, code: true, name: true, account_type: true, balance_type: true },
      }),
      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),
      prisma.operations_routines.findMany({ where: { user_id: user.id }, select: { id: true, role: true } }),
      prisma.planned_item_vendors.findMany({
        where: { user_id: user.id, OR: [{ occurrence_at: null }, { occurrence_at: { gte: vendorsFrom, lt: vendorsTo } }] },
        select: {
          id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true,
          vendor: { select: { id: true, vendor_name: true, entity_id: true } },
          routine: { select: { name: true, timezone: true } },
          step: { select: { activity: true, routine_id: true, routine: { select: { name: true, timezone: true } } } },
          task: { select: { title: true } },
        },
      }),
      prisma.operations_stays.findMany({ where: { user_id: user.id }, orderBy: { starts_on: 'asc' } }),
      prisma.operations_stop_records.findMany({
        where: { user_id: user.id, occurrence_at: { gte: recordsFrom, lt: recordsTo } },
        include: RECORD_PLAN,
        orderBy: { occurrence_at: 'asc' },
      }),
      prisma.operations_stop_records.findFirst({ where: { user_id: user.id }, include: RECORD_PLAN, orderBy: { occurrence_at: 'asc' } }),
      // LEDGER-03: the caller's links of a routine occurrence or a line, in the records' window, with each posting's lines — one query.
      prisma.planned_item_links.findMany({
        where: { user_id: user.id, target_kind: { in: ['routine', 'routine_line'] }, target_instant: { gte: recordsFrom, lt: recordsTo }, journal_entry: { userId: user.id } },
        select: { target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: { select: POSTING_LINES_SELECT } },
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
    return NextResponse.json({ from, to, as_of: now.toISOString(), first_record: firstRecord, rows: ledger.rows, said: ledger.said });
  } catch (error) {
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('Ledger GET', 'Failed to load the ledger', error);
  }
}
