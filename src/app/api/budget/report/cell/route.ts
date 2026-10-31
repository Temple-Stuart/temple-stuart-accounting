import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetReportError } from '@/lib/budget/report';
import { BudgetDaysError } from '@/lib/budget/days';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { BudgetInputError, budgetCellResponse, cellBookOf, parseCellQuery, utcDay, UNKNOWN_BOOK_WORDS } from '@/lib/budget/reportInputs';
import { daysOf, vendorWindowOf } from '@/lib/budget/planLines';
import { readActuals, readBudgetChart, readCostedTasks, readPlanVendors } from '@/lib/budget/reportReads';

/**
 * BUDGET-02 (2026-10-20) — GET /api/budget/report/cell?book=&account=&from=&to=&asOf=:
 * the lines behind one row's figures on /budget (Alex's ruling G). The plan
 * lines behind the printed Budget figure, and the ledger lines behind the
 * Actual. READ-ONLY: this route writes nothing.
 *
 * THE GATE, exactly as the report route (src/app/api/budget/report/route.ts):
 * no verified cookie → 401, no user → 404, before any other read. The path is
 * not in the middleware's PUBLIC_PATHS.
 *
 * REFUSED BY NAME:
 *   · a bad parameter, or a range that is not inside one calendar year → 400
 *     (reportInputs.ts parseCellQuery);
 *   · a book that is not one of the viewer's → 404, in the same words for a
 *     book of another person and a book that does not exist (CLAUDE.md: a
 *     defensive 404 — never confirm the record exists);
 *   · an account that is not in that book's chart, or is no row (not revenue or
 *     expense) → 404, the model's own refusal (report.ts buildBudgetCell).
 *
 * THE READS, every one scoped to the viewer AND the one book, through the ONE
 * loader the report route calls (src/lib/budget/reportReads.ts): the book's
 * chart, its routines (the routine loader), its costed tasks, its actuals for
 * the year through asOf (the one actuals query — reversal pairs and closing
 * entries left out by name), and the plan's vendors for the days the printed
 * Budget figure covers. The pure half (reportInputs.ts budgetCellResponse)
 * builds the model's input by the report's own builder and selects by the
 * model's own selection, so the lines sum to the cell by construction.
 *
 * FAIL LOUD, as the report: the model refusing its input → 422; the day rules
 * or a row that cannot become an input → 500; anything else →
 * failClosedResponse. Never a blank 200.
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
    const query = parseCellQuery(request.nextUrl.searchParams, utcDay(new Date()));
    if (!query.ok) return NextResponse.json(query.refusal, { status: 400 });

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true },
    });
    const book = cellBookOf(entities, query.book);
    if (book === null) return NextResponse.json({ error: 'unknown-book', message: UNKNOWN_BOOK_WORDS }, { status: 404 });

    // The year's actuals stop at asOf, as the report's; the vendors' window covers every day of the range.
    const yearFrom = `${query.from.slice(0, 4)}-01-01`;
    const yearTo = `${query.from.slice(0, 4)}-12-31`;
    const through = yearTo < query.asOf ? yearTo : query.asOf;
    const vendorsFrom = vendorWindowOf(daysOf(query.from, query.to));
    if (vendorsFrom === null) throw new Error(`BUDGET CELL: [${query.from}, ${query.to}] holds no day — parseCellQuery refuses a backwards range`);

    const [chart, routines, tasks, ledger, planVendors] = await Promise.all([
      readBudgetChart(prisma, user.id, [book.id]),
      loadRoutineBudgetInputs(prisma, user.id, book.id),
      readCostedTasks(prisma, user.id, [book.id]),
      // Actuals: never a reversal pair, never a closing entry — by name, in the one loader.
      readActuals(prisma, user.id, [book.id], yearFrom, through),
      readPlanVendors(prisma, user.id, vendorsFrom),
    ]);

    return NextResponse.json(budgetCellResponse(query, { book, chart, routines, tasks, ledger, planVendors }));
  } catch (error) {
    if (error instanceof BudgetReportError) {
      if (error.code === 'cell-account-not-in-chart' || error.code === 'cell-account-not-a-row') {
        return NextResponse.json({ error: error.code, message: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.code, message: error.message }, { status: 422 });
    }
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('budget-report-cell', 'Could not read the lines behind this figure', error);
  }
}
