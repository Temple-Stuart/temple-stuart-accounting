import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { readActuals, readBankNotInBooks, readBudgetChart } from '@/lib/budget/reportReads';
import { utcDay } from '@/lib/budget/reportInputs';
import { REVERSED_POSTING_WHERE } from '@/lib/calendar/postingAmount';
import { HomeLedgerError, homeLedgerOf, homeLedgerQuery, type HomeBankRow, type HomeBooksLine } from '@/lib/home/homeLedger';
import { spanInput, type LedgerRow } from '@/lib/operations/ledger';
import { TravelLedgerError, listOf, travelLedgerReadsOf } from '@/lib/reservations/travelLedger';
import { taskLedgerAnswerOf } from '@/lib/operations/ledgerAnswer';
import { reservationsAnswerOf } from '@/lib/reservations/reservationsAnswer';
import { travelExpensesAnswerOf } from '@/lib/travel/travelExpensesAnswer';

/**
 * HOME-LEDGER-01 (Alex, 2026-11-06, rulings A, B, F) — GET /api/home-ledger?date=YYYY-MM-DD&zone=<IANA>: the home's DAY
 * table, every account with activity on the day card's day, from REAL rows only. READ-ONLY: this route writes nothing.
 *
 * THE GATE (ruling F): the cart-plan order — a verified cookie or 401, the user or 404 — before any other read. GET is the
 * only method; the path is not public (src/middleware.ts PUBLIC_PATHS: an unsigned call is sent to '/'). Not under
 * /api/home, which is the legacy category API.
 *
 * THE DAY (ruling A): ?date= is the day the day card shows — the same `date` the card reads from the URL (dayCard.ts
 * DAY_CARD_PATH, DayCard.tsx) — and ?zone= the browser's zone; each required and valid, or 400 by name
 * (homeLedger.ts homeLedgerQuery); nothing is defaulted.
 *
 * THE READS (ruling B), every one the caller's own, each the source's EXISTING read — never a second query that answers
 * the same question:
 *   · the viewer's entities and their chart as /api/budget/report reads them (reportReads.ts readBudgetChart);
 *   · BOOKS: the one actuals query (reportReads.ts readActuals) for [date, date] — the journal date is the day — with its
 *     own exclusions (reversal pairs by is_reversal / reversed_by_entry_id, year-end closing entries); then the one
 *     reversal rule (postingAmount.ts REVERSED_POSTING_WHERE) asked of the day's entries, so a line whose entry it catches
 *     by its third column (status) leaves the rows, counted — readActuals is a Budget file and is not changed here;
 *   · TASK LEDGER: the task ledger route's answer function (ledgerAnswer.ts taskLedgerAnswerOf — READS-01b, Alex,
 *     2026-11-07, ruling C) for from = to = date through the route's own span parser (ledger.ts spanInput, refused by
 *     name), the clock read once here and handed in — the same reads and the same leaf (ledger.ts ledgerOf) place each
 *     record on its routine's own day; no route calls a route;
 *   · TRAVEL LEDGER: the reservations answer (its `ledger` facts) and the travel-expenses answer (its `expenses`) — the
 *     facts the Travel tab's ledger builds its rows from (travelLedger.ts ledgerRowsOf, in the leaf). READS-01a (Alex,
 *     2026-11-07, ruling D): the two answers are the functions the two routes return (reservationsAnswer.ts
 *     reservationsAnswerOf, travelExpensesAnswer.ts travelExpensesAnswerOf), called directly with this caller's id — no
 *     route calls a route; the answer objects are wire-shaped as built, so the one reader (travelLedgerReadsOf) sees
 *     exactly what it saw through the JSON wire; READS-01b retired the task ledger's in-process call the same way;
 *   · BANK, NOT YET IN THE BOOKS: the report's own read — HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the ONE loader
 *     function both pages call (reportReads.ts readBankNotInBooks — the caller's accounts, review_status not
 *     'committed', dated in the window), here for the one day, each row with its ACCOUNT's isoCurrencyCode.
 * An answer without a list it promises (travelLedger.ts listOf — missingListWords, the one reader) fails this route by
 * name; a refusal thrown by an answer function (the task ledger's BudgetDaysError / BudgetInputError among them) reaches
 * this route's catch and is answered by failClosedResponse by name. No paid call, no travel vendor, no trading route
 * (TRADING_ENTITY_ID is never read — trading is 'not connected').
 *
 * FAIL LOUD. A bad parameter → 400 naming it. The leaf refusing a fact (HomeLedgerError) or a malformed sub-answer
 * (TravelLedgerError) → 500 with the words. Anything else → failClosedResponse. Never a blank 200: the answer always
 * carries its rows, its groups and what is said.
 */
export const dynamic = 'force-dynamic';

const MAX = BigInt(Number.MAX_SAFE_INTEGER);

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

    const query = homeLedgerQuery(request.nextUrl.searchParams.get('date'), request.nextUrl.searchParams.get('zone'));
    if (!query.ok) return NextResponse.json({ error: 'Validation', field: query.field, message: query.message }, { status: 400 });
    const { date, zone } = query;

    const entities = await prisma.entities.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, entity_type: true },
      orderBy: { name: 'asc' },
    });
    const entityIds = entities.map((e) => e.id);

    // READS-01b (Alex, 2026-11-07, ruling C): the task ledger's span is the one day, through the route's own parser —
    // refused by name if it is ever not ok (a validated date cannot fail it; the refusal is written, never a `!`) — and
    // the server's clock, read once here and handed to the answer function.
    const span = spanInput(date, date);
    if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });
    const now = new Date();

    const [chart, lineRows, bankRows, taskAnswer, reservationsAnswer, expensesAnswer] = await Promise.all([
      readBudgetChart(prisma, user.id, entityIds),
      readActuals(prisma, user.id, entityIds, date, date),
      // HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the bank rows not yet in the books through the ONE read both pages
      // call (reportReads.ts readBankNotInBooks — the report's own read), for the one day, each with its ACCOUNT's currency.
      readBankNotInBooks(prisma, user.id, date, date),
      // READS-01b (Alex, 2026-11-07, ruling C): the task ledger's answer function for the one day — no route calls a route.
      taskLedgerAnswerOf(prisma, user.id, { from: span.from, to: span.to }, now),
      // READS-01a (Alex, 2026-11-07, ruling D): the travel ledger's facts and the typed expenses — the two routes' answer
      // functions, called directly with this caller's id; a thrown error reaches this route's catch, as a non-200 did.
      reservationsAnswerOf(prisma, user.id),
      travelExpensesAnswerOf(prisma, user.id),
    ]);

    // The one reversal rule, asked of the day's entries: a line whose entry it catches leaves the rows, counted by the leaf.
    const entryIds = [...new Set(lineRows.map((l) => l.journal_entry_id))];
    const reversedEntries = entryIds.length === 0
      ? []
      : await prisma.journal_entries.findMany({ where: { id: { in: entryIds }, userId: user.id, ...REVERSED_POSTING_WHERE }, select: { id: true } });

    const lines: HomeBooksLine[] = lineRows.map((l) => {
      if (!(l.amount <= MAX && l.amount >= -MAX)) throw new HomeLedgerError(`journal entry ${l.journal_entry_id} carries a ledger amount of ${l.amount} cents, past the safe integer range`);
      return {
        id: l.id,
        journalEntryId: l.journal_entry_id,
        entityId: l.account.entity_id,
        code: l.account.code,
        entryType: l.entry_type,
        cents: Number(l.amount),
        day: utcDay(l.journal_entry.date),
        description: l.journal_entry.description,
      };
    });
    const bank: HomeBankRow[] = bankRows.map((t) => ({
      id: t.id,
      day: utcDay(t.date),
      amount: t.amount,
      currency: t.accounts.isoCurrencyCode,
      name: t.name,
      merchantName: t.merchantName,
      reviewStatus: t.review_status,
    }));

    const travel = travelLedgerReadsOf(reservationsAnswer, expensesAnswer);

    return NextResponse.json(homeLedgerOf({
      date,
      zone,
      books: entities.map((e) => ({ id: e.id, name: e.name, entityType: e.entity_type })),
      chart: chart.map((a) => ({ entityId: a.entity_id, code: a.code, name: a.name, accountType: a.account_type, balanceType: a.balance_type })),
      lines,
      reversedEntryIds: reversedEntries.map((e) => e.id),
      taskRows: listOf<LedgerRow>(taskAnswer, '/api/operations/ledger', 'rows'),
      bookings: travel.ledger,
      expenses: travel.expenses,
      bank,
    }));
  } catch (error) {
    if (error instanceof HomeLedgerError) {
      return NextResponse.json({ error: 'home-ledger', message: error.message }, { status: 500 });
    }
    if (error instanceof TravelLedgerError) {
      return NextResponse.json({ error: 'home-ledger', message: error.message }, { status: 500 });
    }
    return failClosedResponse('home-ledger', 'Could not build the home ledger', error);
  }
}
