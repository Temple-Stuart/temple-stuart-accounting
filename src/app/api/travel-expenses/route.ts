import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { JSON_BODY_WORDS, chartAccountRule, travelExpenseBodyRule, tripNotYoursWords } from '@/lib/travel/travelExpense';
// READS-01a (Alex, 2026-11-07, ruling C): the GET's body — its reads, EXPENSE_SELECT, CHART_SELECT, wireOf and chartRowsOf —
// lives in travelExpensesAnswer.ts as travelExpensesAnswerOf; this route is the gate and the answer, and the POST reads
// the select, the chart rows and wireOf from there. /api/home-ledger calls the function directly — no route calls a route.
import { CHART_SELECT, EXPENSE_SELECT, chartRowsOf, travelExpensesAnswerOf, wireOf } from '@/lib/travel/travelExpensesAnswer';

/**
 * TRAVEL-02b (Alex, 2026-11-03, rulings C and D) — /api/travel-expenses: the caller's typed travel expenses.
 *
 * GET  → { expenses, trips, accounts } — every travel expense of the caller, voided included (voided_at and
 *        void_reason say so), newest day first; each with the postings linked to it by hand (planned_item_links kind
 *        'travel_expense' — the one link rule, LINK-LAW-01's one writer, src/app/api/calendar/links/route.ts), each
 *        posting read with its state (postingAmount.ts LINKED_POSTING_SELECT — a reversed posting pays nothing, and the
 *        travel ledger leaves it out and counts it), its day, the bank row it names (a bank posting's source_id is its
 *        transaction's transactionId — journal-entry-service.ts commitPlaidTransaction :248-249) and the current
 *        receipts on it (source_documents kind 'receipt', not superseded — the documents route's own read). `trips`
 *        and `accounts` are the form's two lists — the caller's trips, and the chart accounts the POST accepts
 *        (travelExpense.ts chartChoicesOf over the same chart the POST reads): what the form offers is what the route
 *        takes.
 * POST { kind, paid_on, amount_minor, currency, vendor, note?, trip_id?, coa_code? } → 201 { expense }. The body rule
 *        (travelExpense.ts travelExpenseBodyRule) refuses every field by name, an unknown one too (400); a trip_id that
 *        is not the caller's trip → 404 by name (the defensive 404 — it does not say whether the trip exists); a
 *        coa_code that is not one row of the caller's chart → 409 naming the code. Nothing is defaulted: no currency,
 *        no trip, no account.
 *
 * THE GATE (the /api/reservations pattern): getVerifiedEmail → 401; the users row → 404; the middleware's 307 for a
 * guest comes first. Every query names the caller (user_id / userId = user.id). No paid call, no vendor call. No PUT,
 * no DELETE: a typed expense is frozen once kept and voided, never deleted (the migration's two triggers) — the void is
 * POST /api/travel-expenses/[id]/void.
 */
async function caller() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
}

export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json(await travelExpensesAnswerOf(prisma, user.id));
}

export async function POST(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: JSON_BODY_WORDS }, { status: 400 }); }
  const read = travelExpenseBodyRule(body);
  if (!read.ok) return NextResponse.json({ error: read.words, field: read.field }, { status: 400 });
  const v = read.value;

  // The trip must be the caller's — another user's, or none, is the defensive 404, named.
  if (v.trip_id !== null) {
    const trip = await prisma.trips.findFirst({ where: { id: v.trip_id, userId: user.id }, select: { id: true } });
    if (!trip) return NextResponse.json({ error: tripNotYoursWords(v.trip_id), field: 'trip_id' }, { status: 404 });
  }

  // The account must be ONE row of the caller's chart, read through the one scheme; it is stored as that row's account string.
  let account: string | null = null;
  if (v.coa_code !== null) {
    const chart = await prisma.chart_of_accounts.findMany({ where: { userId: user.id }, select: CHART_SELECT });
    const named = chartAccountRule(v.coa_code, chartRowsOf(chart));
    if (!named.ok) return NextResponse.json({ error: named.words, field: 'coa_code' }, { status: 409 });
    account = named.account;
  }

  const row = await prisma.travel_expenses.create({
    data: {
      user_id: user.id,
      kind: v.kind,
      paid_on: new Date(`${v.paid_on}T00:00:00.000Z`),
      amount_minor: v.amount_minor,
      currency: v.currency,
      vendor: v.vendor,
      note: v.note,
      trip_id: v.trip_id,
      coa_code: account,
      created_by: user.email,
    },
    select: EXPENSE_SELECT,
  });
  return NextResponse.json({ expense: wireOf(row, []) }, { status: 201 });
}
