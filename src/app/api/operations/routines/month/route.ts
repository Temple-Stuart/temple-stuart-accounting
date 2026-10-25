/**
 * GET /api/operations/routines/month?as_of=YYYY-MM-DD — THE MONTH BEHIND ROUTINE
 * EXPENSES (ROUTINES-03, Alex, 2026-10-25, ruling C).
 *
 * Thin: the caller first (a verified cookie or 401, the user or 404 — the ledger
 * GET's pattern), as_of a real ISO day or 400 by name, then the reads, every one
 * scoped to user.id, handed to the pure rule (src/lib/operations/routineMonth.ts):
 *
 *   · the caller's routines, active AND not, through the one loader /budget and
 *     the ledger read (loadRoutineBudgetInputs, includeInactive) and the one mapper
 *     (reportInputs.ts toRoutinePlanInput) — the table shows ended and inactive
 *     routines when its chip clears;
 *   · the stop records in the month's window (stopRecord.ts recordWindow's rule
 *     over the span — the instants that can fall on a day of it in any zone; the
 *     rule places each exactly);
 *   · the links of a routine occurrence or a line in that window, with each
 *     posting's lines for LEDGER-03's one amount rule (ledger.ts linkInputOf);
 *   · every plan-vendor row of the caller's routines and lines, any instant — the
 *     grain rule reads them all (an occurrence row at any instant is "by occurrence").
 *
 * Answers { as_of, from, to, lines: [{ routine_id, step_id, vendor_words,
 * budget_month_cents, budget_to_date_cents, actual_cents, actual_records,
 * match_cents, match_links, match_unreadable, variance_cents }], said: [],
 * calculated: { <figure>: <its rule> } }. No paid service. Not in PUBLIC_PATHS.
 * A rule's named refusal (BudgetDaysError, BudgetInputError, a plan-vendor row the
 * database should not hold) is a 500 with its code and message; anything else fails
 * closed (failClosedResponse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetDaysError, isIsoDay } from '@/lib/budget/days';
import { BudgetInputError, toReportEntity, toRoutinePlanInput } from '@/lib/budget/reportInputs';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { POSTING_LINES_SELECT } from '@/lib/calendar/postingAmount';
import { linkInputOf } from '@/lib/operations/ledger';
import { recordWindow, stopRecordRowOf } from '@/lib/operations/stopRecord';
import { AS_OF_WORDS, ROUTINE_MONTH_CALCULATED, monthRangeOf, routineMonthOf } from '@/lib/operations/routineMonth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const asOf = request.nextUrl.searchParams.get('as_of');
    if (!isIsoDay(asOf)) return NextResponse.json({ error: 'Validation', field: 'as_of', message: AS_OF_WORDS }, { status: 400 });
    const { from, to } = monthRangeOf(asOf);
    // The instants that can fall on a day of the month in ANY zone (stopRecord.ts recordWindow's rule, over the span); the rule places each exactly.
    const window = { gte: recordWindow(from).gte, lt: recordWindow(to).lt };

    const entities = await prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, name: true, entity_type: true }, orderBy: { name: 'asc' } });
    const books = entities.map(toReportEntity);

    const [routineGroups, recordRows, linkRows, vendorRows] = await Promise.all([
      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id, { includeInactive: true }) }))),
      prisma.operations_stop_records.findMany({
        where: { user_id: user.id, occurrence_at: window },
        orderBy: { occurrence_at: 'asc' },
      }),
      prisma.planned_item_links.findMany({
        where: { user_id: user.id, target_kind: { in: ['routine', 'routine_line'] }, target_instant: window, journal_entry: { userId: user.id } },
        select: { target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: { select: POSTING_LINES_SELECT } },
        orderBy: { linked_at: 'asc' },
      }),
      prisma.planned_item_vendors.findMany({
        where: { user_id: user.id, OR: [{ routine_id: { not: null } }, { step_id: { not: null } }] },
        select: {
          id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true,
          vendor: { select: { id: true, vendor_name: true, entity_id: true } },
          routine: { select: { name: true, timezone: true } },
          step: { select: { activity: true, routine_id: true, routine: { select: { name: true, timezone: true } } } },
          task: { select: { title: true } },
        },
      }),
    ]);

    const bookOf = (entityId: string) => {
      const book = books.find((b) => b.id === entityId);
      if (book === undefined) throw new BudgetInputError('unknown-entity', `the routines of entity ${entityId} name an entity that is not one of the caller's`);
      return book;
    };
    const routines = routineGroups.flatMap((group) => group.rows.map((row) => toRoutinePlanInput(row, bookOf(group.entityId))));
    const month = routineMonthOf({ asOf, routines, records: recordRows.map(stopRecordRowOf), links: linkRows.map(linkInputOf), vendors: vendorRows });
    if (!month.ok) return NextResponse.json({ error: month.code, message: month.message }, { status: 500 });
    return NextResponse.json({ as_of: month.as_of, from: month.from, to: month.to, lines: month.lines, said: month.said, calculated: ROUTINE_MONTH_CALCULATED });
  } catch (error) {
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('Routine month GET', 'Failed to load the routines\' month', error);
  }
}
