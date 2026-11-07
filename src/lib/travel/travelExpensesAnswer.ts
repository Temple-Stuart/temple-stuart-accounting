import type { PrismaClient } from '@prisma/client';
import { LINKED_POSTING_SELECT, isReversedPosting } from '@/lib/calendar/postingAmount';
import type { TravelExpenseIn } from '@/lib/reservations/travelLedger';
import { chartChoicesOf, type ChartRowIn } from '@/lib/travel/travelExpense';

/**
 * READS-01a (Alex, 2026-11-07, ruling C) — THE TRAVEL-EXPENSES ANSWER, AS A FUNCTION.
 *
 * GET /api/travel-expenses' body after its gate (TRAVEL-02b — the route's header keeps the story), moved here VERBATIM:
 * every travel expense of the caller newest day first, voided included, each with its linked postings (the one link rule),
 * their bank rows through the caller's accounts and their current receipts; the form's two lists (`trips`, `accounts`)
 * from the same chart the POST reads — returning the exact `{ expenses, trips, accounts }` object the route serializes.
 * The route is the gate and `NextResponse.json(await travelExpensesAnswerOf(prisma, user.id))`; /api/home-ledger calls
 * this function directly instead of the route (no route calls a route). The POST stays in the route and imports the
 * select, the chart rows and wireOf from here.
 *
 * The caller's id is the parameter: every where names it (user_id / userId: userId). READ-ONLY: zero writes, no vendor
 * client, no clock. The answer is WIRE-SHAPED as built — wireOf turns the DAY into 'YYYY-MM-DD' and the instants into
 * ISO text, the bank amounts are Float columns, the figures Int, no Decimal, no BigInt, no undefined — so the leaf that
 * reads it in-process (travelLedger.ts travelLedgerReadsOf) sees exactly what it saw through the JSON wire.
 */

type Db = Pick<PrismaClient, 'travel_expenses' | 'planned_item_links' | 'trips' | 'chart_of_accounts' | 'transactions' | 'source_documents'>;

const isoDayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** The row's own columns, as both verbs answer them — the trip with its name. */
export const EXPENSE_SELECT = {
  id: true, kind: true, paid_on: true, amount_minor: true, currency: true, vendor: true, note: true, coa_code: true,
  voided_at: true, void_reason: true, created_at: true, trip: { select: { id: true, name: true } },
} as const;

/** The chart rows the coa_code is read against — the caller's, each with its book's type and name (the one scheme's letter). */
export const CHART_SELECT = { code: true, name: true, entity: { select: { entity_type: true, name: true } } } as const;

type ExpenseRow = {
  id: string; kind: string; paid_on: Date; amount_minor: number; currency: string; vendor: string; note: string | null; coa_code: string | null;
  voided_at: Date | null; void_reason: string | null; created_at: Date; trip: { id: string; name: string } | null;
};

/** One row on the wire: the DAY as 'YYYY-MM-DD', the instants as ISO, its postings as read. */
export function wireOf(row: ExpenseRow, postings: TravelExpenseIn['postings']): TravelExpenseIn {
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

export const chartRowsOf = (rows: readonly { code: string; name: string; entity: { entity_type: string; name: string } }[]): ChartRowIn[] =>
  rows.map((r) => ({ code: r.code, name: r.name, entityType: r.entity.entity_type, bookName: r.entity.name }));

/** The answer GET /api/travel-expenses serializes — { expenses, trips, accounts } — for the caller userId. */
export async function travelExpensesAnswerOf(db: Db, userId: string) {
  const rows = await db.travel_expenses.findMany({
    where: { user_id: userId },
    orderBy: [{ paid_on: 'desc' }, { created_at: 'desc' }],
    select: EXPENSE_SELECT,
  });
  const ids = rows.map((r) => r.id);

  const [links, trips, chart] = await Promise.all([
    db.planned_item_links.findMany({
      where: { user_id: userId, target_kind: 'travel_expense', target_id: { in: ids }, journal_entry: { userId: userId } },
      orderBy: { linked_at: 'asc' },
      select: { target_id: true, journal_entry: { select: { id: true, date: true, source_type: true, source_id: true, ...LINKED_POSTING_SELECT } } },
    }),
    db.trips.findMany({ where: { userId: userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.chart_of_accounts.findMany({ where: { userId: userId }, select: CHART_SELECT }),
  ]);

  // The bank rows the linked postings name — a bank posting carries its transaction's transactionId as source_id; the
  // account must be the caller's. Each transactionId is unique, so one row per posting, or none.
  const sourceIds = links
    .filter((l) => l.journal_entry.source_type === 'plaid_txn' && l.journal_entry.source_id !== null)
    .map((l) => l.journal_entry.source_id as string);
  const entryIds = links.map((l) => l.journal_entry.id);
  const [banks, receipts] = await Promise.all([
    db.transactions.findMany({
      where: { transactionId: { in: sourceIds }, accounts: { userId: userId } },
      select: { transactionId: true, amount: true, date: true, accounts: { select: { isoCurrencyCode: true } } },
    }),
    db.source_documents.findMany({
      where: { user_id: userId, kind: 'receipt', superseded_by: null, journal_entry_id: { in: entryIds } },
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

  return {
    expenses: rows.map((r) => wireOf(r, postingsOf.has(r.id) ? postingsOf.get(r.id)! : [])),
    trips,
    accounts: chartChoicesOf(chartRowsOf(chart)),
  };
}

export type TravelExpensesAnswer = Awaited<ReturnType<typeof travelExpensesAnswerOf>>;
