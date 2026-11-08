import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetReportError, viewRange } from '@/lib/budget/report';
import { BudgetDaysError } from '@/lib/budget/days';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { BudgetInputError, budgetReportResponse, parseReportQuery, utcDay } from '@/lib/budget/reportInputs';
import { vendorWindow } from '@/lib/budget/planLines';
import { countLeftOut, readActuals, readBankNotInBooks, readBudgetChart, readCostedTasks, readPlanVendors } from '@/lib/budget/reportReads';
// SUPERSEDE-01b (Alex, 2026-11-08, ruling D): the range's travel BLOCKS through the one read (READS-01a's functions, the card's
// selections — instants only, no money column: travel budgets stay not connected), the range as the travel leaf writes it,
// and the range's stop records by the one widened window (stopRecord.ts recordsWindowOf).
import { readTravelBlocks } from '@/lib/operations/travelBlocksReads';
import { daysRangeOf } from '@/lib/operations/travelDay';
import { recordsWindowOf } from '@/lib/operations/stopRecord';

/**
 * TAB13-02b — GET /api/budget/report: what you planned, what posted, and the
 * difference, by book and account. READ-ONLY: this route writes nothing.
 *
 * THE GATE. Auth first, exactly as cart-plan (src/app/api/ai/cart-plan/route.ts
 * :80-89): no verified cookie → 401, no user → 404, before any other read. No
 * tab gate — Budget is free with an account (src/lib/offer.ts TOOL_GATE,
 * Budget: null). The path is not in the middleware's PUBLIC_PATHS.
 *
 * THE READS, every one scoped to the viewer and to the viewer's entities —
 * BUDGET-02 (2026-10-20): the chart, the tasks, the actuals, their counts and the
 * plan's vendors through the ONE loader both budget routes call
 * (src/lib/budget/reportReads.ts, ruling G); the bank rows here:
 *   · entities → one book each;
 *   · the chart: every chart_of_accounts row of those entities, archived included
 *     (BUDGET-02: with is_archived — an archived account is a row only with a figure);
 *   · routines through the ONE loader (loadRoutineBudgetInputs), per entity;
 *   · costed tasks (estimated_cost_usd not null, every status), each with its
 *     project and EVERY daily-plan item and its blocks' statuses — the earliest
 *     day decides;
 *   · ACTUALS: ledger lines on revenue and expense accounts only, journal date
 *     in [rangeFrom, min(rangeTo, asOf)]. Left out BY NAME, and counted:
 *     reversal pairs (an entry with is_reversal, or one reversed_by another —
 *     the ledger pattern, src/app/api/hub/year-calendar/route.ts:121-122) and
 *     year-end closing entries (source_type 'year_end_close', which zero the
 *     P&L into retained earnings, src/app/api/ledger/year-end-close/route.ts).
 *     Lines after asOf are counted too — actuals stop at asOf;
 *   · TAB13-04 — THE DAY'S PLAN'S VENDORS, for a DAY or WEEK view only: every
 *     every-occurrence plan-vendor row of the viewer, and the occurrence rows whose
 *     instant is in planLines.ts vendorWindow — each with its vendor (id, name,
 *     book) and, through its relations, its plan's name, its routine's zone and its
 *     line's activity. planLines.ts decides which belong to the view. A YEAR reads
 *     none (null);
 *   · NOT IN THE BOOKS YET: bank rows of the viewer's accounts (accounts.userId), review_status not 'committed', in
 *     range and not after asOf — HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): through the ONE loader function both
 *     pages call (reportReads.ts readBankNotInBooks; the DAY table on /home reads the same), each with its ACCOUNT's
 *     currency; counted per column, summed PER CURRENCY CODE as a BANK figure (Plaid signs outflows positive), never
 *     across codes, never mixed into an actual; a row whose amount is not whole cents is listed, left out, never fatal.
 * No travel BUDGET is read: travel budgets are not connected yet, and the
 * response says so. SUPERSEDE-01b (Alex, 2026-11-08): the range's travel BLOCKS
 * — a planned once row or a flight segment with both instants, instants only —
 * are read through src/lib/operations/travelBlocksReads.ts (READS-01a's
 * functions, the card's selections), and the range's stop records through
 * stopRecord.ts recordsWindowOf, so the model marks every routine occurrence a
 * block supersedes by the one rule (supersession.ts) and sums without them.
 *
 * FAIL LOUD. A bad parameter → 400 naming it. The model refusing its input
 * (BudgetReportError) → 422 with its code and message. The day rules refusing a
 * call (BudgetDaysError) or a row that cannot become an input (BudgetInputError)
 * → 500 with its code and message. Anything else → failClosedResponse. Never a
 * blank 200.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // The server's clock is read HERE, once; the pure half takes the day.
    const query = parseReportQuery(request.nextUrl.searchParams, utcDay(new Date()));
    if (!query.ok) return NextResponse.json(query.refusal, { status: 400 });
    const { view, asOf } = query;
    const { rangeFrom, rangeTo } = viewRange(view);
    const through = rangeTo < asOf ? rangeTo : asOf;
    // HOME-LEDGER-02a: the bank window's UTC midnight is built in the one loader (readBankNotInBooks), not here.
    const vendorsFrom = vendorWindow(view);

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true },
      orderBy: { name: 'asc' },
    });
    const entityIds = entities.map((e) => e.id);

    const [chart, routineGroups, tasks, ledger, excludedLines, bankRows, planVendors, travelBlocks, stopRecords] = await Promise.all([
      readBudgetChart(prisma, user.id, entityIds),
      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),
      readCostedTasks(prisma, user.id, entityIds),
      // Actuals: never a reversal pair, never a closing entry — by name, in the one loader.
      readActuals(prisma, user.id, entityIds, rangeFrom, through),
      countLeftOut(prisma, user.id, entityIds, { from: rangeFrom, through, to: rangeTo, asOf }),
      // HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the bank rows not yet in the books through the ONE read both pages
      // call (reportReads.ts readBankNotInBooks) — [rangeFrom, through], the window as this report builds it, each row
      // with its ACCOUNT's stated currency; the model sums per code, never across codes.
      readBankNotInBooks(prisma, user.id, rangeFrom, through),
      // TAB13-04: the plan's vendors — a DAY or WEEK only; a YEAR reads none.
      vendorsFrom === null ? null : readPlanVendors(prisma, user.id, vendorsFrom),
      // SUPERSEDE-01b (ruling D): the range's travel blocks, by the card's selections, through the one read; bookings are never a block.
      readTravelBlocks(prisma, user.id, daysRangeOf(rangeFrom, rangeTo)),
      // SUPERSEDE-01b (ruling D): the range's stop records — the three columns the one key is built from (a record wins, in the leaf).
      prisma.operations_stop_records.findMany({ where: { user_id: user.id, occurrence_at: recordsWindowOf(rangeFrom, rangeTo) }, select: { routine_id: true, step_id: true, occurrence_at: true } }),
    ]);
    // Ruling C: the account's stated currency rides beside the amount into the model (BankRow.currency).
    const bank = bankRows.map((t) => ({ id: t.id, date: t.date, amount: t.amount, currency: t.accounts.isoCurrencyCode }));

    return NextResponse.json(budgetReportResponse({ view, asOf }, {
      entities,
      chart,
      routines: routineGroups,
      tasks,
      ledger,
      excludedLines,
      bank,
      planVendors,
      supersession: { blocks: travelBlocks.blocks, leftOut: travelBlocks.leftOut, records: stopRecords },
    }));
  } catch (error) {
    if (error instanceof BudgetReportError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 422 });
    }
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('budget-report', 'Could not build the budget report', error);
  }
}
