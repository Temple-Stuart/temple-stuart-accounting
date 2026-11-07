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
 *   · TIME-03 (Alex, 2026-10-26): the line's duration_minutes, read WITH the
 *     record's plan words (RECORD_PLAN's step select — additive, no new query)
 *     — the ledger's PLANNED MIN; the record's own actual_minutes was always in
 *     the row (stopRecordRowOf) — its LOGGED MIN.
 *   · WORK-03b (Alex, 2026-10-26): the routine's start_time and end_time, read
 *     WITH a stepless record's plan words (RECORD_PLAN's routine select —
 *     additive, no new query): a stepless routine with a window is as long as
 *     its window — the one planned-minutes rule (dayCard.ts plannedMinutesOf,
 *     recordInputOf applies it for both kinds); one without has none.
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
 *
 * READS-01b (Alex, 2026-11-07, ruling B): the body after the gate and the span — the windows, the reads, the rules and
 * the answer object, with RECORD_PLAN and its helpers — moved VERBATIM to src/lib/operations/ledgerAnswer.ts
 * (taskLedgerAnswerOf(db, userId, span, now)); this route is the gate, the span, one return that reads the clock once
 * and hands it in, and the same catch. /api/home-ledger calls the function directly — no route calls a route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { BudgetDaysError } from '@/lib/budget/days';
import { BudgetInputError } from '@/lib/budget/reportInputs';
import { spanInput } from '@/lib/operations/ledger';
import { taskLedgerAnswerOf } from '@/lib/operations/ledgerAnswer';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));
    if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });
    const { from, to } = span;
    // The server's clock, once, handed to the answer function (READS-01b); the pure half takes it.
    return NextResponse.json(await taskLedgerAnswerOf(prisma, user.id, { from, to }, new Date()));
  } catch (error) {
    if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
    }
    return failClosedResponse('Ledger GET', 'Failed to load the ledger', error);
  }
}
