import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetReportError, viewRange } from '@/lib/budget/report';
import { BudgetDaysError } from '@/lib/budget/days';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { BudgetInputError, budgetReportResponse, parseReportQuery, utcDay } from '@/lib/budget/reportInputs';
import { vendorWindow } from '@/lib/budget/planLines';

/**
 * TAB13-02b — GET /api/budget/report: what you planned, what posted, and the
 * difference, by book and account. READ-ONLY: this route writes nothing.
 *
 * THE GATE. Auth first, exactly as cart-plan (src/app/api/ai/cart-plan/route.ts
 * :80-89): no verified cookie → 401, no user → 404, before any other read. No
 * tab gate — Budget is free with an account (src/lib/offer.ts TOOL_GATE,
 * Budget: null). The path is not in the middleware's PUBLIC_PATHS.
 *
 * THE READS, every one scoped to the viewer and to the viewer's entities:
 *   · entities → one book each;
 *   · the chart: every chart_of_accounts row of those entities, archived included;
 *   · routines through the ONE loader (loadRoutineBudgetInputs), per entity;
 *   · costed tasks (estimated_cost_usd not null, every status), each with EVERY
 *     daily-plan item and its blocks' statuses — the earliest day decides;
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
 *   · NOT IN THE BOOKS YET: bank rows of the viewer's accounts (accounts.userId)
 *     whose review_status is not 'committed', in range and not after asOf —
 *     counted per column and summed as a BANK figure (Plaid signs outflows
 *     positive), never mixed into an actual; a row whose amount is not whole
 *     cents is listed as not totalled and left out of the sums, never fatal.
 * No travel table is read: travel budgets are not connected yet, and the
 * response says so.
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
    const fromDay = new Date(`${rangeFrom}T00:00:00.000Z`);
    const throughDay = new Date(`${through}T00:00:00.000Z`);
    const asOfDay = new Date(`${asOf}T00:00:00.000Z`);
    const toDay = new Date(`${rangeTo}T00:00:00.000Z`);
    const vendorsFrom = vendorWindow(view);

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true },
      orderBy: { name: 'asc' },
    });
    const entityIds = entities.map((e) => e.id);

    // A ledger line on one of the viewer's revenue or expense accounts, in one of the viewer's journal entries.
    const plLine = (journal: Prisma.journal_entriesWhereInput): Prisma.ledger_entriesWhereInput => ({
      account: { entity_id: { in: entityIds }, entity: { userId: user.id }, account_type: { in: ['revenue', 'expense'] } },
      journal_entry: { userId: user.id, entity_id: { in: entityIds }, ...journal },
    });

    const [chart, routineGroups, tasks, ledger, reversalPairLines, closingEntryLines, linesAfterAsOf, bank, planVendors] = await Promise.all([
      prisma.chart_of_accounts.findMany({
        where: { entity_id: { in: entityIds }, entity: { userId: user.id } },
        select: { entity_id: true, code: true, name: true, account_type: true, balance_type: true },
      }),
      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),
      prisma.operations_project_tasks.findMany({
        where: { user_id: user.id, entity_id: { in: entityIds }, estimated_cost_usd: { not: null } },
        select: {
          id: true, title: true, entity_id: true, status: true, estimated_cost_usd: true, coa_code: true,
          daily_plan_items: {
            where: { user_id: user.id },
            select: { plan_date: true, calendar_blocks: { where: { user_id: user.id }, select: { status: true } } },
          },
        },
      }),
      prisma.ledger_entries.findMany({
        // Actuals: never a reversal pair, never a closing entry — by name.
        where: plLine({ date: { gte: fromDay, lte: throughDay }, is_reversal: false, reversed_by_entry_id: null, source_type: { not: 'year_end_close' } }),
        select: { journal_entry_id: true, entry_type: true, amount: true, account: { select: { entity_id: true, code: true } }, journal_entry: { select: { date: true } } },
      }),
      prisma.ledger_entries.count({
        where: plLine({ date: { gte: fromDay, lte: throughDay }, OR: [{ is_reversal: true }, { reversed_by_entry_id: { not: null } }] }),
      }),
      prisma.ledger_entries.count({
        where: plLine({ date: { gte: fromDay, lte: throughDay }, is_reversal: false, reversed_by_entry_id: null, source_type: 'year_end_close' }),
      }),
      prisma.ledger_entries.count({
        where: plLine({ date: { gt: asOfDay, gte: fromDay, lte: toDay } }),
      }),
      prisma.transactions.findMany({
        where: { accounts: { userId: user.id }, review_status: { not: 'committed' }, date: { gte: fromDay, lte: new Date(`${through}T23:59:59.999Z`) } },
        select: { id: true, date: true, amount: true },
      }),
      // TAB13-04: the plan's vendors — a DAY or WEEK only; a YEAR reads none.
      vendorsFrom === null ? null : prisma.planned_item_vendors.findMany({
        where: { user_id: user.id, OR: [{ occurrence_at: null }, { occurrence_at: { gte: vendorsFrom.from, lt: vendorsFrom.to } }] },
        select: {
          id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true,
          vendor: { select: { id: true, vendor_name: true, entity_id: true } },
          routine: { select: { name: true, timezone: true } },
          step: { select: { activity: true, routine_id: true, routine: { select: { name: true, timezone: true } } } },
          task: { select: { title: true } },
        },
      }),
    ]);

    return NextResponse.json(budgetReportResponse({ view, asOf }, {
      entities,
      chart,
      routines: routineGroups,
      tasks,
      ledger,
      excludedLines: { reversalPairLines, closingEntryLines, linesAfterAsOf },
      bank,
      planVendors,
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
