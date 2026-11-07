import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { readActuals, readBankNotInBooks, readBudgetChart } from '@/lib/budget/reportReads';
import { utcDay } from '@/lib/budget/reportInputs';
import { REVERSED_POSTING_WHERE } from '@/lib/calendar/postingAmount';
import { HomeLedgerError, homeLedgerOf, homeLedgerQuery, type HomeBankRow, type HomeBooksLine } from '@/lib/home/homeLedger';
import type { LedgerRow } from '@/lib/operations/ledger';
import { TravelLedgerError, listOf, travelLedgerReadsOf } from '@/lib/reservations/travelLedger';
import { GET as taskLedgerGet } from '@/app/api/operations/ledger/route';
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
 *   · TASK LEDGER: GET /api/operations/ledger for from = to = date, called in-process — the same reads and the same leaf
 *     (ledger.ts ledgerOf) place each record on its routine's own day;
 *   · TRAVEL LEDGER: the reservations answer (its `ledger` facts) and the travel-expenses answer (its `expenses`) — the
 *     facts the Travel tab's ledger builds its rows from (travelLedger.ts ledgerRowsOf, in the leaf). READS-01a (Alex,
 *     2026-11-07, ruling D): the two answers are the functions the two routes return (reservationsAnswer.ts
 *     reservationsAnswerOf, travelExpensesAnswer.ts travelExpensesAnswerOf), called directly with this caller's id — no
 *     route calls a route; the answer objects are wire-shaped as built, so the one reader (travelLedgerReadsOf) sees
 *     exactly what it saw through the JSON wire. The task ledger's in-process call stays until READS-01b;
 *   · BANK, NOT YET IN THE BOOKS: the report's own read — HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the ONE loader
 *     function both pages call (reportReads.ts readBankNotInBooks — the caller's accounts, review_status not
 *     'committed', dated in the window), here for the one day, each row with its ACCOUNT's isoCurrencyCode.
 * A sub-read that does not answer 200, or answers without a list it promises (travelLedger.ts listOf — missingListWords,
 * the one reader), fails this route by name. No paid call, no travel vendor, no trading route (TRADING_ENTITY_ID is never
 * read — trading is 'not connected').
 *
 * FAIL LOUD. A bad parameter → 400 naming it. The leaf refusing a fact (HomeLedgerError) or a malformed sub-answer
 * (TravelLedgerError) → 500 with the words. Anything else → failClosedResponse. Never a blank 200: the answer always
 * carries its rows, its groups and what is said.
 */
export const dynamic = 'force-dynamic';

const MAX = BigInt(Number.MAX_SAFE_INTEGER);

/** A sub-route's answer as JSON — a status other than 200 or a body that is not JSON fails by name, never read as empty. */
async function answerOf(res: Response, route: string): Promise<unknown> {
  let body: unknown;
  try {
    body = await res.json();
  } catch (error) {
    throw new HomeLedgerError(`${route} answered ${res.status} with a body that is not JSON — ${error instanceof Error ? error.message : String(error)}`);
  }
  if (res.status !== 200) {
    const words = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : 'no words';
    throw new HomeLedgerError(`${route} answered ${res.status} — ${words}`);
  }
  return body;
}

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

    const [chart, lineRows, bankRows, taskRes, reservationsAnswer, expensesAnswer] = await Promise.all([
      readBudgetChart(prisma, user.id, entityIds),
      readActuals(prisma, user.id, entityIds, date, date),
      // HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the bank rows not yet in the books through the ONE read both pages
      // call (reportReads.ts readBankNotInBooks — the report's own read), for the one day, each with its ACCOUNT's currency.
      readBankNotInBooks(prisma, user.id, date, date),
      // The task ledger — the route itself, in-process, under this request's cookie (READS-01b moves it).
      taskLedgerGet(new NextRequest(new URL(`/api/operations/ledger?from=${date}&to=${date}`, request.url))),
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

    const taskAnswer = await answerOf(taskRes, '/api/operations/ledger');
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
