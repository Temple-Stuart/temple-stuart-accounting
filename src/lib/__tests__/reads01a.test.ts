/**
 * READS-01a (Alex, 2026-11-07) — THE TRAVEL READS LEAVE THEIR ROUTES: the travel-day route's four source reads are range
 * functions (travelDayReads.ts — ruling A); the reservations and travel-expenses GET bodies are answer functions their
 * routes return (reservationsAnswer.ts, travelExpensesAnswer.ts — rulings B, C) and /api/home-ledger calls directly — no
 * route calls a route (ruling D); every wire byte-identical. Every pin here finds its line by content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { reservationsAnswerOf } from '../reservations/reservationsAnswer';
import { travelExpensesAnswerOf } from '../travel/travelExpensesAnswer';
import { readBookingsOn, readOwnReservationIds, readPlannedTravel, readSegments } from '../operations/travelDayReads';
import { travelLedgerReadsOf } from '../reservations/travelLedger';

const READS = 'src/lib/operations/travelDayReads.ts';
const RES_ANSWER = 'src/lib/reservations/reservationsAnswer.ts';
const EXP_ANSWER = 'src/lib/travel/travelExpensesAnswer.ts';
const TRAVEL_DAY_ROUTE = 'src/app/api/operations/travel-day/route.ts';
const RES_ROUTE = 'src/app/api/reservations/route.ts';
const EXP_ROUTE = 'src/app/api/travel-expenses/route.ts';
const HOME_LEDGER_ROUTE = 'src/app/api/home-ledger/route.ts';
const THIS = 'src/lib/__tests__/reads01a.test.ts';

// ── A fake database: every read answers its fixture rows (Dates as Prisma hands them) and records its where ──────────

type Call = { readonly table: string; readonly where: unknown };
function fakeDb(rows: Readonly<Record<string, readonly unknown[]>>, calls: Call[]) {
  const db: Record<string, { findMany: (args: { where?: unknown }) => Promise<unknown[]> }> = {};
  for (const table of Object.keys(rows)) {
    db[table] = { findMany: async (args) => { calls.push({ table, where: args.where }); return [...rows[table]]; } };
  }
  return db;
}
const at = (iso: string): Date => new Date(iso);

const RESERVATION_ROWS = {
  reservations: [{
    id: 'r1', lane: 'hotel', provider: 'liteapi', displayName: 'READS-01a Manila hotel', providerConfirmationCode: 'ABC123', providerBookingId: 'PB-1',
    status: 'confirmed', tripId: 'trip1', checkinDate: at('2026-11-20T00:00:00.000Z'), checkoutDate: at('2026-11-22T00:00:00.000Z'),
    ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: at('2026-11-19T10:00:00.000Z'),
    finalPriceCents: 150000, currency: 'PHP', createdAt: at('2026-11-20T01:00:00.000Z'), trip: { id: 'trip1', name: 'Manila' },
  }],
  transaction_reservation_links: [{ reservationId: 'r1', transaction: { amount: 26.5, date: at('2026-11-20T00:00:00.000Z'), accounts: { isoCurrencyCode: 'USD' } } }],
  journal_entries: [{ id: 'je1', date: at('2026-11-20T00:00:00.000Z'), document_reservation_id: 'r1' }],
  reservation_budget_links: [{ reservationId: 'r1', budgetLineItem: { description: 'Hotel nights', coaCode: 'P-9200' } }],
  calendar_events: [{ source_id: 'r1', start_date: at('2026-11-20T00:00:00.000Z') }],
  money_events: [{
    id: 'me1', reservationId: 'r1', kind: 'refund', amountCents: 5000, currency: 'PHP', status: 'settled',
    statedAt: at('2026-11-21T00:00:00.000Z'), settledAt: at('2026-11-22T00:00:00.000Z'),
    settledTransaction: { amount: -0.9, date: at('2026-11-22T00:00:00.000Z'), accounts: { isoCurrencyCode: 'USD' } },
  }],
  source_documents: [{ journal_entry_id: 'je1' }],
} as const;

const EXPENSE_ROWS = {
  travel_expenses: [{
    id: 'e1', kind: 'visa', paid_on: at('2026-11-20T00:00:00.000Z'), amount_minor: 35000, currency: 'PHP', vendor: 'READS-01a BI Manila', note: null,
    // CASH-02a (2026-11-08): EXPENSE_SELECT reads paid_with — the row as the database answers it now (typed before CASH-02a: NULL).
    coa_code: null, paid_with: null, voided_at: null, void_reason: null, created_at: at('2026-11-20T03:00:00.000Z'), trip: null,
  }],
  planned_item_links: [{ target_id: 'e1', journal_entry: { id: 'je2', date: at('2026-11-20T00:00:00.000Z'), source_type: 'plaid_txn', source_id: 'tx1', status: 'posted', is_reversal: false, reversed_by_entry_id: null } }],
  trips: [{ id: 'trip1', name: 'Manila' }],
  chart_of_accounts: [{ code: '6150', name: 'Coffee', entity: { entity_type: 'personal', name: 'Personal' } }],
  transactions: [{ transactionId: 'tx1', amount: 12.5, date: at('2026-11-20T00:00:00.000Z'), accounts: { isoCurrencyCode: 'USD' } }],
  source_documents: [{ journal_entry_id: 'je2' }],
} as const;

type ResDb = Parameters<typeof reservationsAnswerOf>[0];
type ExpDb = Parameters<typeof travelExpensesAnswerOf>[0];
type ReadsDb = Parameters<typeof readPlannedTravel>[0];

// ── A · THE FOUR RANGE FUNCTIONS ─────────────────────────────────────────────

test('A travelDayReads.ts holds the route\'s four source reads, verbatim, as range functions; the route calls them and keeps its gate, dayRangeOf, its per-id reads and travelDayOf', async () => {
  const r = code(READS);
  // SUPERSEDE-01b (Alex, 2026-11-08, ruling A): the four take InstantRange (travelDay.ts — Pick<DayRange, 'from' | 'to'>) — the
  // travel-day route still passes its DayRange, structurally one; the bodies are unchanged.
  assert.match(r, /import \{ bookingsSelectionOf, plannedSelectionOf, segmentsSelectionOf, type InstantRange \} from '@\/lib\/operations\/travelDay';/);
  assert.match(r, /export function readPlannedTravel\(db: Db, userId: string, range: InstantRange\) \{\n\s*return db\.trip_itinerary\.findMany\(\{ where: \{ trip: \{ userId: userId \}, \.\.\.plannedSelectionOf\(range\) \}, select: PLANNED_SELECT \}\);/);
  assert.match(r, /export function readBookingsOn\(db: Db, userId: string, range: InstantRange\) \{\n\s*return db\.reservations\.findMany\(\{ where: \{ userId: userId, \.\.\.bookingsSelectionOf\(range\) \}, select: RESERVATION_SELECT \}\);/);
  assert.match(r, /export function readOwnReservationIds\(db: Db, userId: string\) \{\n\s*return db\.reservations\.findMany\(\{ where: \{ userId: userId \}, select: \{ id: true \} \}\);/);
  assert.match(r, /export function readSegments\(db: Db, userId: string, ids: readonly string\[\], range: InstantRange\) \{\n\s*return db\.calendar_events\.findMany\(\{\n\s*where: \{ user_id: userId, \.\.\.bookingCalendarRowsWhere\(ids\), \.\.\.segmentsSelectionOf\(range\) \},\n\s*select: SEGMENT_SELECT,/);
  // The three selects, exported, exactly the route's.
  assert.match(r, /export const RESERVATION_SELECT = \{\n\s*id: true, lane: true, displayName: true, provider: true, providerConfirmationCode: true, providerBookingId: true,\n\s*status: true, tripId: true, checkinDate: true, checkoutDate: true,\n\s*ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, lastVendorReadAt: true,\n\s*finalPriceCents: true, currency: true, createdAt: true,\n\} as const;/);
  assert.match(r, /export const PLANNED_SELECT = \{\n\s*id: true, tripId: true, category: true, vendor: true, vendor_name: true, cost: true, coa_code: true, recurrence: true,\n\s*homeDate: true, homeTime: true, destDate: true, destTime: true, duration_minutes: true,\n\s*start_zone: true, end_zone: true, start_at: true, end_at: true, block_start_time: true, block_end_time: true,\n\s*vendorOptionId: true, vendorOptionType: true, note: true,\n\} as const;/);
  assert.match(r, /export const SEGMENT_SELECT = \{\n\s*source_id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true,\n\s*start_at: true, end_at: true, start_zone: true, end_zone: true,\n\} as const;/);
  assert.match(r, /type Db = Pick<PrismaClient, 'trip_itinerary' \| 'reservations' \| 'calendar_events'>;/);
  assert.doesNotMatch(r, /getVerifiedEmail|NextResponse|cookie/, 'no gate here — the client is handed in');
  const route = code(TRAVEL_DAY_ROUTE);
  assert.match(route, /import \{ RESERVATION_SELECT, readBookingsOn, readOwnReservationIds, readPlannedTravel, readSegments \} from '@\/lib\/operations\/travelDayReads';/);
  // code() strips the comments between the three calls — the pin reads the calls in their order.
  assert.match(route, /readPlannedTravel\(prisma, user\.id, range\),\s*readBookingsOn\(prisma, user\.id, range\),\s*readOwnReservationIds\(prisma, user\.id\),/);
  assert.match(route, /: await readSegments\(prisma, user\.id, ownIds, range\);/);
  assert.doesNotMatch(route, /PLANNED_SELECT|SEGMENT_SELECT|plannedSelectionOf|bookingsSelectionOf|segmentsSelectionOf/, 'the selects and the selections left with the reads');
  for (const kept of ['const read = dayRangeOf(request.nextUrl.searchParams.get(\'day\'));', 'where: { userId: user.id, id: { in: missing } }', 'prisma.transaction_reservation_links.findMany({', 'prisma.journal_entries.findMany({', 'prisma.reservation_budget_links.findMany({', 'prisma.calendar_events.findMany({', 'return NextResponse.json(travelDayOf({ range, planned: plannedIn, bookings, segments }));']) {
    assert.ok(route.includes(kept), `the route keeps ${kept.slice(0, 50)}`);
  }
  // A year is a range too: the four take any DayRange and pass it to the leaf's selections unchanged.
  const calls: Call[] = [];
  const db = fakeDb({ trip_itinerary: [], reservations: [{ id: 'r1' }], calendar_events: [] }, calls) as unknown as ReadsDb;
  const year = { day: '2026-01-01', from: '2026-01-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' };
  await readPlannedTravel(db, 'alex', year);
  await readBookingsOn(db, 'alex', year);
  const ids = (await readOwnReservationIds(db, 'alex')).map((x) => x.id);
  await readSegments(db, 'alex', ids, year);
  assert.deepEqual(calls.map((c) => c.table), ['trip_itinerary', 'reservations', 'reservations', 'calendar_events']);
  assert.deepEqual(calls[0].where, { trip: { userId: 'alex' }, OR: [{ recurrence: 'once', homeDate: { gte: at(year.from), lt: at(year.to) } }, { recurrence: 'daily', homeDate: { lt: at(year.to) }, destDate: { gte: at(year.from) } }] });
  assert.deepEqual(calls[1].where, { userId: 'alex', OR: [{ checkinDate: { gte: at(year.from), lt: at(year.to) } }, { checkoutDate: { gte: at(year.from), lt: at(year.to) } }] });
  assert.deepEqual(calls[2].where, { userId: 'alex' });
  assert.deepEqual(calls[3].where, { user_id: 'alex', source: 'reservation', OR: [{ source_id: { in: ['r1'] } }, { source_id: { startsWith: 'r1:seg:' } }], start_date: { gte: at(year.from), lt: at(year.to) } });
});

// ── B, C · THE TWO ANSWER FUNCTIONS AND THEIR ROUTES ─────────────────────────

test('B GET /api/reservations is the gate and reservationsAnswerOf(prisma, user.id); the body lives in reservationsAnswer.ts with every read scoped to the parameter', () => {
  const route = code(RES_ROUTE);
  assert.match(route, /export async function GET\(\) \{\n\s*const userEmail = await getVerifiedEmail\(\);\n\s*if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\n\s*const user = await prisma\.users\.findFirst\(\{\n\s*where: \{ email: \{ equals: userEmail, mode: 'insensitive' \} \},\n\s*select: \{ id: true \},\n\s*\}\);\n\s*if \(!user\) return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\);\n\s*return NextResponse\.json\(await reservationsAnswerOf\(prisma, user\.id\)\);\n\}/);
  assert.doesNotMatch(route, /findMany|bookingRowOf|isoDayOf/, 'the route reads no list and words nothing');
  const a = code(RES_ANSWER);
  assert.match(a, /export async function reservationsAnswerOf\(db: Db, userId: string\) \{/);
  assert.match(a, /return \{ bookings, ledger \};/);
  assert.match(a, /const isoDayOf = \(d: Date\): string => d\.toISOString\(\)\.slice\(0, 10\);/);
  assert.doesNotMatch(a, /\bprisma\.|user\.id|getVerifiedEmail|NextResponse/, 'the client and the caller are handed in — only the PrismaClient type is named');
  const reads = [...a.matchAll(/db\.(\w+)\.findMany\(\{\s*where: \{([^\n]*)\}/g)];
  assert.deepEqual(reads.map((m) => m[1]), ['reservations', 'transaction_reservation_links', 'journal_entries', 'reservation_budget_links', 'calendar_events', 'money_events', 'source_documents']);
  for (const m of reads) assert.match(m[2], /\b(userId|user_id): userId\b/, `${m[1]} names the caller`);
});

test('C GET /api/travel-expenses is the gate and travelExpensesAnswerOf(prisma, user.id); the body, the select, wireOf and the chart rows live in travelExpensesAnswer.ts; the POST stays', () => {
  const route = code(EXP_ROUTE);
  assert.match(route, /export async function GET\(\) \{\n\s*const userEmail = await getVerifiedEmail\(\);\n\s*if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\n\s*const user = await prisma\.users\.findFirst\(\{\n\s*where: \{ email: \{ equals: userEmail, mode: 'insensitive' \} \},\n\s*select: \{ id: true \},\n\s*\}\);\n\s*if \(!user\) return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\);\n\s*return NextResponse\.json\(await travelExpensesAnswerOf\(prisma, user\.id\)\);\n\}/);
  assert.match(route, /import \{ CHART_SELECT, EXPENSE_SELECT, chartRowsOf, travelExpensesAnswerOf, wireOf \} from '@\/lib\/travel\/travelExpensesAnswer';/);
  assert.match(route, /export async function POST\(request: NextRequest\) \{/);
  assert.match(route, /return NextResponse\.json\(\{ expense: wireOf\(row, \[\]\) \}, \{ status: 201 \}\);/);
  assert.doesNotMatch(route, /travel_expenses\.findMany|planned_item_links|isReversedPosting|LINKED_POSTING_SELECT|chartChoicesOf/, 'the GET\'s reads left the route');
  const a = code(EXP_ANSWER);
  assert.match(a, /export async function travelExpensesAnswerOf\(db: Db, userId: string\) \{/);
  assert.match(a, /return \{\n\s*expenses: rows\.map\(\(r\) => wireOf\(r, postingsOf\.has\(r\.id\) \? postingsOf\.get\(r\.id\)! : \[\]\)\),\n\s*trips,\n\s*accounts: chartChoicesOf\(chartRowsOf\(chart\)\),\n\s*\};/);
  for (const exported of ['export const EXPENSE_SELECT = {', 'export const CHART_SELECT = {', 'export function wireOf(row: ExpenseRow, postings: TravelExpenseIn[\'postings\']): TravelExpenseIn {', 'export const chartRowsOf = (']) {
    assert.ok(a.includes(exported), `${exported.slice(0, 40)} is exported for the POST`);
  }
  assert.doesNotMatch(a, /\bprisma\.|user\.id|getVerifiedEmail|NextResponse/, 'the client and the caller are handed in — only the PrismaClient type is named');
  const reads = [...a.matchAll(/db\.(\w+)\.findMany\(\{\s*where: \{([^\n]*)\}/g)];
  assert.deepEqual(reads.map((m) => m[1]), ['travel_expenses', 'planned_item_links', 'trips', 'chart_of_accounts', 'transactions', 'source_documents']);
  for (const m of reads) assert.match(m[2], /\b(userId|user_id): userId\b/, `${m[1]} names the caller`);
});

// ── D · /api/home-ledger CALLS THE TWO FUNCTIONS ─────────────────────────────

test('D /api/home-ledger imports the two answer functions and no GET of the two routes; calls them with the caller\'s id; the task ledger\'s answer function beside them (READS-01b); the one reader parses both', () => {
  const h = code(HOME_LEDGER_ROUTE);
  // READS-01b (Alex, 2026-11-07): the task ledger's in-process call retired the same way — its function import sits where the route import was.
  assert.match(h, /import \{ taskLedgerAnswerOf \} from '@\/lib\/operations\/ledgerAnswer';\nimport \{ reservationsAnswerOf \} from '@\/lib\/reservations\/reservationsAnswer';\nimport \{ travelExpensesAnswerOf \} from '@\/lib\/travel\/travelExpensesAnswer';/);
  assert.doesNotMatch(h, /GET as reservationsGet|GET as travelExpensesGet|reservationsGet\(|travelExpensesGet\(|answerOf\(reservationsRes|answerOf\(expensesRes/, 'no route calls a route');
  assert.match(h, /const \[chart, lineRows, bankRows, taskAnswer, reservationsAnswer, expensesAnswer\] = await Promise\.all\(\[/); // READS-01b: the answer itself
  assert.match(h, /taskLedgerAnswerOf\(prisma, user\.id, \{ from: span\.from, to: span\.to \}, now\),/); // READS-01b
  assert.match(h, /reservationsAnswerOf\(prisma, user\.id\),\n\s*travelExpensesAnswerOf\(prisma, user\.id\),\n\s*\]\);/);
  assert.match(h, /const travel = travelLedgerReadsOf\(reservationsAnswer, expensesAnswer\);/); // READS-01b: no answerOf parse — the task ledger's answer is the function's
  assert.doesNotMatch(h, /wireShapeOf|JSON\.parse\(JSON\.stringify/, 'the answers are used as they are — proved wire-shaped, no helper');
});

// ── D · THE WIRE SHAPE: the answer objects round-trip JSON unchanged ─────────

test('D the two answer objects are wire-shaped as built — fixture rows with Dates in, an answer with no Date, BigInt, undefined or Decimal out; JSON round-trips it unchanged; every read scoped to the caller; the one reader accepts both', async () => {
  const resCalls: Call[] = [];
  const res = await reservationsAnswerOf(fakeDb(RESERVATION_ROWS, resCalls) as unknown as ResDb, 'alex');
  assert.deepEqual(JSON.parse(JSON.stringify(res)), res, 'the reservations answer round-trips');
  assert.equal(res.ledger.length, 1);
  assert.equal(res.ledger[0].createdAt, '2026-11-20T01:00:00.000Z');
  assert.deepEqual([res.ledger[0].checkinDate, res.ledger[0].checkoutDate, res.ledger[0].calendarDay], ['2026-11-20', '2026-11-22', '2026-11-20']);
  assert.deepEqual(res.ledger[0].charge, { matched: true, posted: true, bank: { amount: 26.5, currency: 'USD', date: '2026-11-20' }, postedDay: '2026-11-20', postedEntryId: 'je1' });
  assert.equal(res.ledger[0].receipts, 1);
  assert.deepEqual(res.ledger[0].moneyEvents, [{ id: 'me1', kind: 'refund', amountCents: 5000, currency: 'PHP', status: 'settled', statedAt: '2026-11-21T00:00:00.000Z', settledAt: '2026-11-22T00:00:00.000Z', settledBank: { amount: -0.9, currency: 'USD', date: '2026-11-22' } }]);
  assert.equal(res.bookings.length, 1);
  assert.equal(res.bookings[0].id, 'r1');
  assert.deepEqual(resCalls.map((c) => c.table), ['reservations', 'transaction_reservation_links', 'journal_entries', 'reservation_budget_links', 'calendar_events', 'money_events', 'source_documents']);
  for (const c of resCalls) assert.ok(JSON.stringify(c.where).includes('"alex"'), `${c.table} read with the caller's id`);

  const expCalls: Call[] = [];
  const exp = await travelExpensesAnswerOf(fakeDb(EXPENSE_ROWS, expCalls) as unknown as ExpDb, 'alex');
  assert.deepEqual(JSON.parse(JSON.stringify(exp)), exp, 'the travel-expenses answer round-trips');
  assert.equal(exp.expenses.length, 1);
  assert.deepEqual([exp.expenses[0].paid_on, exp.expenses[0].created_at, exp.expenses[0].voided_at], ['2026-11-20', '2026-11-20T03:00:00.000Z', null]);
  assert.deepEqual(exp.expenses[0].postings, [{ journal_entry_id: 'je2', posted_on: '2026-11-20', reversed: false, bank: { amount: 12.5, currency: 'USD', date: '2026-11-20' }, receipts: 1 }]);
  assert.deepEqual(exp.trips, [{ id: 'trip1', name: 'Manila' }]);
  assert.deepEqual(expCalls.map((c) => c.table), ['travel_expenses', 'planned_item_links', 'trips', 'chart_of_accounts', 'transactions', 'source_documents']);
  for (const c of expCalls) assert.ok(JSON.stringify(c.where).includes('"alex"'), `${c.table} read with the caller's id`);

  // The one reader (missingListWords) takes both answers as they are, as it took them through the JSON wire.
  const reads = travelLedgerReadsOf(res, exp);
  assert.deepEqual([reads.ledger.length, reads.expenses.length, reads.trips.length, reads.accounts.length], [1, 1, 1, exp.accounts.length]);
});

// ── THE DOES-NOTS ────────────────────────────────────────────────────────────

test('no `||`, no `?? <default>`, no write and no vendor client in the three new files; this test pins no line number', () => {
  for (const f of [READS, RES_ANSWER, EXP_ANSWER]) {
    const src = code(f);
    assert.doesNotMatch(src, /\|\|/, `${f} holds no ||`);
    assert.doesNotMatch(src, /\?\? /, `${f} holds no ?? default`);
    assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, `${f} writes nothing`);
    assert.doesNotMatch(src, /liteapiClient|liteapiFlightsClient|viatorClient|\bfetch\s*\(|reserveTravelSearch|getFlightBooking|getHotelBooking/, `${f} calls no vendor`);
  }
  assert.doesNotMatch(code(THIS), /\.ts:\d+|\.tsx:\d+/, 'no line-number pin');
});
