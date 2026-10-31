/**
 * GET /api/bill-pay?from=YYYY-MM-DD&to=YYYY-MM-DD — BILL PAY: EVERY BILL, EVERY DUE DAY, PAID OR NOT
 * (BILLPAY-01, Alex, 2026-10-28, ruling C).
 *
 * Thin: the caller first (a verified cookie or 401, the user or 404 — the ledger GET's pattern), the window
 * validated and capped by the ledger's own rule (ledger.ts spanInput — real days, in order, at most
 * LEDGER_SPAN_MAX_DAYS; the first bad one refused by name, 400), then the reads, every one scoped to user.id,
 * handed to the pure rule (src/lib/operations/billPay.ts):
 *
 *   · the caller's books and their charts — BOOK, ACCOUNT, ACCOUNT NAME and PAID FROM's letter;
 *   · the caller's active routines with their role, through the one loader /budget reads
 *     (routineBudgetInputs.ts loadRoutineBudgetInputs) and the one mapper (reportInputs.ts toRoutinePlanInput);
 *   · the plan-vendor rows (reportReads.ts readPlanVendors — every-occurrence rows, and occurrence rows in the
 *     instants that can fall on a day of the window in any zone, stopRecord.ts recordWindow's rule);
 *   · ONE planned_item_links read of a routine kind over the same instants, each posting with its state and its
 *     lines' accounts (postingAmount.ts BILL_POSTING_SELECT) — never one query per occurrence.
 *
 * Answers { from, to, rows, said }. It pays, schedules and writes nothing (ruling D). No paid service. Not in
 * PUBLIC_PATHS. A rule's named refusal (BudgetDaysError, BudgetInputError, a plan-vendor row the database should not
 * hold) is a 500 with its code and message; anything else fails closed (failClosedResponse).
 */
import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetDaysError } from '@/lib/budget/days';
import { BudgetInputError, toReportEntity, toRoutinePlanInput } from '@/lib/budget/reportInputs';
import { readPlanVendors } from '@/lib/budget/reportReads';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { BILL_POSTING_SELECT } from '@/lib/calendar/postingAmount';
import { spanInput } from '@/lib/operations/ledger';
import { recordWindow } from '@/lib/operations/stopRecord';
import { billPayOf, type BillRoutine } from '@/lib/operations/billPay';
import type { WorkBook, WorkCharts } from '@/lib/operations/work';
import type { CoaAccountSummary } from '@/components/workbench/operations/projects/types';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));
    if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });
    const { from, to } = span;
    const now = new Date();
    // The instants that can fall on a day of the window in ANY zone (stopRecord.ts recordWindow's rule, over the span); the rule places each exactly.
    const window = { gte: recordWindow(from).gte, lt: recordWindow(to).lt };

    const entities = await prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, name: true, entity_type: true }, orderBy: { name: 'asc' } });
    const entityIds = entities.map((e) => e.id);
    const books: WorkBook[] = entities.map((e) => ({ id: e.id, name: e.name, entity_type: e.entity_type }));

    const [chartRows, routineGroups, vendorRows, linkRows] = await Promise.all([
      prisma.chart_of_accounts.findMany({
        where: { entity_id: { in: entityIds }, entity: { userId: user.id } },
        select: { entity_id: true, code: true, name: true, account_type: true },
      }),
      Promise.all(entities.map(async (e) => ({ entity: e, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),
      readPlanVendors(prisma, user.id, { from: window.gte, to: window.lt }),
      // BILLPAY-01 (ruling C): the ONE links read — the caller's links of a routine kind over the window's instants, scoped to the caller twice.
      prisma.planned_item_links.findMany({
        where: { user_id: user.id, target_kind: { in: ['routine', 'routine_line'] }, target_instant: window, journal_entry: { userId: user.id } },
        select: { target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: { select: BILL_POSTING_SELECT } },
        orderBy: { linked_at: 'asc' },
      }),
    ]);

    const charts: Record<string, CoaAccountSummary[]> = {};
    for (const row of chartRows) (charts[row.entity_id] ??= []).push(row);
    const routines: BillRoutine[] = routineGroups.flatMap(({ entity, rows }) => rows.map((row) => ({
      plan: toRoutinePlanInput(row, toReportEntity(entity)),
      role: row.role,
      lineNames: Object.fromEntries(row.steps.map((s) => [s.id, s.activity])),
    })));

    const bills = billPayOf({ from, to, now, books, charts: charts as WorkCharts, routines, vendors: vendorRows, links: linkRows });
    if (!bills.ok) return NextResponse.json({ error: bills.code, message: bills.message }, { status: 500 });
    return NextResponse.json({ from: bills.from, to: bills.to, rows: bills.rows, said: bills.said });
  } catch (error) {
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('Bill Pay GET', 'Failed to load the bills', error);
  }
}
