import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { LINKED_POSTING_SELECT, isReversedPosting } from '@/lib/calendar/postingAmount';
import type { TravelExpenseIn } from '@/lib/reservations/travelLedger';
import {
  JSON_BODY_WORDS, chartAccountRule, chartChoicesOf, travelExpenseBodyRule, tripNotYoursWords, type ChartRowIn,
} from '@/lib/travel/travelExpense';

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
const isoDayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** The row's own columns, as both verbs answer them — the trip with its name. */
const EXPENSE_SELECT = {
  id: true, kind: true, paid_on: true, amount_minor: true, currency: true, vendor: true, note: true, coa_code: true,
  voided_at: true, void_reason: true, created_at: true, trip: { select: { id: true, name: true } },
} as const;

/** The chart rows the coa_code is read against — the caller's, each with its book's type and name (the one scheme's letter). */
const CHART_SELECT = { code: true, name: true, entity: { select: { entity_type: true, name: true } } } as const;

type ExpenseRow = {
  id: string; kind: string; paid_on: Date; amount_minor: number; currency: string; vendor: string; note: string | null; coa_code: string | null;
  voided_at: Date | null; void_reason: string | null; created_at: Date; trip: { id: string; name: string } | null;
};

/** One row on the wire: the DAY as 'YYYY-MM-DD', the instants as ISO, its postings as read. */
function wireOf(row: ExpenseRow, postings: TravelExpenseIn['postings']): TravelExpenseIn {
  return {
    id: row.id,
    kind: row.kind,
    paid_on: isoDayOf(row.paid_on),
    amount_minor: row.amount_minor,
    currency: row.currency,
    vendor: row.vendor,
    note: row.note,
    trip: row.trip === null ? null : { id: row.trip.id, name: row.trip.name },
    coa_code: row.coa_code,
    voided_at: row.voided_at === null ? null : row.voided_at.toISOString(),
    void_reason: row.void_reason,
    created_at: row.created_at.toISOString(),
    postings,
  };
}

const chartRowsOf = (rows: readonly { code: string; name: string; entity: { entity_type: string; name: string } }[]): ChartRowIn[] =>
  rows.map((r) => ({ code: r.code, name: r.name, entityType: r.entity.entity_type, bookName: r.entity.name }));

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

  const rows = await prisma.travel_expenses.findMany({
    where: { user_id: user.id },
    orderBy: [{ paid_on: 'desc' }, { created_at: 'desc' }],
    select: EXPENSE_SELECT,
  });
  const ids = rows.map((r) => r.id);

  const [links, trips, chart] = await Promise.all([
    prisma.planned_item_links.findMany({
      where: { user_id: user.id, target_kind: 'travel_expense', target_id: { in: ids }, journal_entry: { userId: user.id } },
      orderBy: { linked_at: 'asc' },
      select: { target_id: true, journal_entry: { select: { id: true, date: true, source_type: true, source_id: true, ...LINKED_POSTING_SELECT } } },
    }),
    prisma.trips.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.chart_of_accounts.findMany({ where: { userId: user.id }, select: CHART_SELECT }),
  ]);

  // The bank rows the linked postings name — a bank posting carries its transaction's transactionId as source_id; the
  // account must be the caller's. Each transactionId is unique, so one row per posting, or none.
  const sourceIds = links
    .filter((l) => l.journal_entry.source_type === 'plaid_txn' && l.journal_entry.source_id !== null)
    .map((l) => l.journal_entry.source_id as string);
  const entryIds = links.map((l) => l.journal_entry.id);
  const [banks, receipts] = await Promise.all([
    prisma.transactions.findMany({
      where: { transactionId: { in: sourceIds }, accounts: { userId: user.id } },
      select: { transactionId: true, amount: true, date: true, accounts: { select: { isoCurrencyCode: true } } },
    }),
    prisma.source_documents.findMany({
      where: { user_id: user.id, kind: 'receipt', superseded_by: null, journal_entry_id: { in: entryIds } },
      select: { journal_entry_id: true },
    }),
  ]);
  const bankOf = new Map(banks.map((b) => [b.transactionId, { amount: b.amount, currency: b.accounts.isoCurrencyCode, date: isoDayOf(b.date) }]));
  const receiptsOf = new Map<string, number>();
  for (const d of receipts) {
    if (d.journal_entry_id === null) continue;
    receiptsOf.set(d.journal_entry_id, (receiptsOf.has(d.journal_entry_id) ? receiptsOf.get(d.journal_entry_id)! : 0) + 1);
  }
  const postingsOf = new Map<string, TravelExpenseIn['postings'][number][]>();
  for (const l of links) {
    const e = l.journal_entry;
    const names = e.source_type === 'plaid_txn' && e.source_id !== null && bankOf.has(e.source_id);
    const posting = {
      journal_entry_id: e.id,
      posted_on: isoDayOf(e.date),
      reversed: isReversedPosting(e),
      bank: names ? bankOf.get(e.source_id as string)! : null,
      receipts: receiptsOf.has(e.id) ? receiptsOf.get(e.id)! : 0,
    };
    const list = postingsOf.get(l.target_id);
    if (list === undefined) postingsOf.set(l.target_id, [posting]);
    else list.push(posting);
  }

  return NextResponse.json({
    expenses: rows.map((r) => wireOf(r, postingsOf.has(r.id) ? postingsOf.get(r.id)! : [])),
    trips,
    accounts: chartChoicesOf(chartRowsOf(chart)),
  });
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
