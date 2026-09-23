/**
 * CAL-01 (2026-09-23) — a booking lands on the calendar.
 *
 * One test per branch the ruling names. The leaf is driven through a fake port,
 * so every row here is decided by the real code and nothing touches a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  BOOKING_CALENDAR_SOURCE,
  bookingCalendarSourceId,
  flightCalendarDecision,
  stayCalendarDecision,
  writeBookingCalendarEvent,
  type BookingCalendarPort,
} from '../calendar/bookingEvent';
import { CALENDAR_SOURCES, isRenderedCalendarSource } from '../calendar/sources';
import { SOURCE_RULES } from '../books/entrySource';

type Row = Parameters<BookingCalendarPort['insert']>[0];

/** The two calls the leaf makes of a database, remembered. */
function fakePort(opts: { existing?: string[]; throwOnInsert?: boolean } = {}) {
  const rows: Row[] = [];
  const present = new Set(opts.existing ?? []);
  const port: BookingCalendarPort = {
    async find(source, sourceId) { return present.has(`${source}|${sourceId}`); },
    async insert(row) {
      if (opts.throwOnInsert) throw new Error('relation "calendar_events" does not exist');
      rows.push(row);
      present.add(`${row.source}|${row.sourceId}`);
    },
  };
  return { port, rows };
}

const STAY = {
  reservationId: 'res_1',
  userId: 'u_1',
  hotelName: 'Ibis Phuket Kata',
  checkinDate: '2026-10-23',
  checkoutDate: '2026-10-26',
};

test('a hotel booking writes ONE row spanning the stay, on a source the calendar actually renders', async () => {
  const { port, rows } = fakePort();
  const out = await writeBookingCalendarEvent(port, stayCalendarDecision(STAY));
  assert.equal(out.landed, 'inserted');
  assert.equal(rows.length, 1, 'exactly one row');
  const row = rows[0];
  assert.equal(row.source, BOOKING_CALENDAR_SOURCE);
  assert.equal(row.sourceId, 'res_1', 'keyed on the reservation id, bare');
  assert.equal(row.startDate.toISOString(), '2026-10-23T12:00:00.000Z', 'starts on check-in');
  assert.equal(row.endDate?.toISOString(), '2026-10-26T12:00:00.000Z', 'ends on check-out');
  assert.match(row.title, /Ibis Phuket Kata/);
  // The whole point: a row the grid draws. A source off the allowlist would be invisible.
  assert.ok(isRenderedCalendarSource(row.source), 'the source is on the calendar allowlist');
});

test('a paid booking and a planned trip item are told apart by `source` ALONE', () => {
  // The retro-map's query key. vendor-commit writes 'trip' for what was PLANNED
  // (trips/[id]/vendor-commit/route.ts:596); this writes 'reservation' for what was PAID.
  assert.equal(BOOKING_CALENDAR_SOURCE, 'reservation');
  assert.notEqual(BOOKING_CALENDAR_SOURCE, 'trip', 'NOT the literal vendor-commit uses');
  assert.match(code('src/app/api/trips/[id]/vendor-commit/route.ts'), /'trip', \$\{calSourceId\}/, "vendor-commit still writes 'trip'");
  // And source_id is the reservation id bare, so the retro-map joins straight onto it.
  assert.equal(bookingCalendarSourceId('res_abc'), 'res_abc');
});

test('the new source is on the calendar allowlist, or the row would never be drawn', () => {
  assert.ok(isRenderedCalendarSource(BOOKING_CALENDAR_SOURCE), 'the grid renders it');
  const rule = CALENDAR_SOURCES.find((s) => s.source === BOOKING_CALENDAR_SOURCE);
  assert.ok(rule, 'it has an allowlist entry');
  assert.match(rule!.writtenBy, /\.ts:\d+/, 'citing its writer at file:line');
  assert.ok(rule!.why.length > 20, 'and saying why it belongs on the day');
  // It keeps its own colour, so a paid booking reads differently from a planned one.
  assert.notEqual(rule!.tint.dot, CALENDAR_SOURCES.find((s) => s.source === 'trip')!.tint.dot);
  // DRILL-01's SEVEN entry-source kinds are a different vocabulary and stay closed.
  assert.equal(SOURCE_RULES.length, 7, "DRILL-01's seven entry-source kinds are untouched");
});

test('a flight writes ZERO rows and names why — the landed payload carries no date of travel', async () => {
  const { port, rows } = fakePort();
  // The keys the repo's own documented fixture puts on data[0].booking.
  const landedFields = ['bookingId', 'bookingRef', 'status', 'paymentStatus', 'pricing', 'payment', 'order', 'passengers'];
  const out = await writeBookingCalendarEvent(port, flightCalendarDecision({ reservationId: 'res_f', landedFields }));
  assert.equal(rows.length, 0, 'no row');
  assert.equal(out.landed, 'no_row');
  assert.ok(out.landed === 'no_row' && /no date of travel/.test(out.reason), 'the reason is named');
  assert.ok(out.landed === 'no_row' && /NOT FOUND/.test(out.reason), 'and it cites the finding');
  // The reason lists what was actually looked at, so a future payload change shows up.
  for (const f of landedFields) assert.ok(out.landed === 'no_row' && out.reason.includes(f), `${f} is named in the reason`);
});

test('a stay missing either date writes ZERO rows and names which one — no date is ever invented', async () => {
  for (const [missing, input] of [
    ['check-in', { ...STAY, checkinDate: null }],
    ['check-out', { ...STAY, checkoutDate: null }],
  ] as const) {
    const { port, rows } = fakePort();
    const out = await writeBookingCalendarEvent(port, stayCalendarDecision(input));
    assert.equal(rows.length, 0, `${missing}: no row`);
    assert.ok(out.landed === 'no_row' && out.reason.includes(missing), `${missing} is named`);
  }
});

test('a GUEST booking (userId null) still gets its row — calendar_events.user_id is nullable', async () => {
  const { port, rows } = fakePort();
  const out = await writeBookingCalendarEvent(port, stayCalendarDecision({ ...STAY, userId: null }));
  assert.equal(out.landed, 'inserted');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, null, 'the row carries a null user, and is written all the same');
});

test('a repeated book call finds the row and writes no second one', async () => {
  const { port, rows } = fakePort();
  const first = await writeBookingCalendarEvent(port, stayCalendarDecision(STAY));
  const second = await writeBookingCalendarEvent(port, stayCalendarDecision(STAY));
  const third = await writeBookingCalendarEvent(port, stayCalendarDecision(STAY));
  assert.equal(first.landed, 'inserted');
  assert.equal(second.landed, 'already_there');
  assert.equal(third.landed, 'already_there');
  assert.equal(rows.length, 1, 'still exactly one row after three calls');
});

test('a row already present from an earlier landing is found by (source, source_id), not re-inserted', async () => {
  const { port, rows } = fakePort({ existing: [`${BOOKING_CALENDAR_SOURCE}|${bookingCalendarSourceId('res_1')}`] });
  const out = await writeBookingCalendarEvent(port, stayCalendarDecision(STAY));
  assert.equal(out.landed, 'already_there');
  assert.equal(rows.length, 0);
});

test('THE ORDERING PROOF: a calendar-write failure leaves the reservation committed and the booking answering 200', async () => {
  const { port } = fakePort({ throwOnInsert: true });
  await assert.rejects(() => writeBookingCalendarEvent(port, stayCalendarDecision(STAY)), /calendar_events/);
  // The routes' side of that contract, read from the source: the call sits in its
  // own try/catch AFTER the transaction, and the catch only logs.
  for (const route of [
    'src/app/api/travel/liteapi/book/route.ts',
    'src/app/api/travel/liteapi/flights/book/route.ts',
  ]) {
    const src = code(route);
    const at = src.indexOf('writeBookingCalendarEvent(');
    assert.ok(at > 0, `${route} calls the writer`);
    const after = src.slice(at, at + 1400);
    assert.match(after, /catch \(calErr\)/, `${route} catches its own calendar failure`);
    assert.match(after, /console\.error/, `${route} declares it loudly`);
    // Nothing in the catch fails the request.
    const block = after.slice(after.indexOf('catch (calErr)'));
    assert.doesNotMatch(block.slice(0, 400), /return NextResponse|throw /, `${route}'s calendar catch never fails the booking`);
    // ── THE ORDERING, read from the source ──────────────────────────────────
    // The transaction OPENS and CLOSES before the calendar is touched, so the
    // reservation row is committed and cannot be rolled back by anything here.
    const txAt = src.indexOf('prisma.$transaction');
    assert.ok(txAt > 0 && txAt < at, `${route}: the reservation transaction comes first`);
    // The writer is not lexically inside the transaction callback: the landed
    // result is already destructured before it.
    const between = src.slice(txAt, at);
    assert.match(between, /landed\.reservation|const result =/, `${route}: the transaction has produced its reservation before the calendar is written`);
    // The calendar call must not be passed the transaction client — it takes the
    // top-level prisma, which is how it cannot enlist in that transaction.
    assert.match(after, /prismaBookingCalendar\(prisma\)/, `${route}: the calendar write uses the top-level client, never tx`);
    assert.doesNotMatch(after.slice(0, 200), /prismaBookingCalendar\(tx\)/, `${route}: never the transaction client`);
  }
});

test('neither book route can roll a reservation back for a calendar row — no throw escapes the calendar block', () => {
  for (const route of [
    'src/app/api/travel/liteapi/book/route.ts',
    'src/app/api/travel/liteapi/flights/book/route.ts',
  ]) {
    const src = code(route);
    const at = src.indexOf('writeBookingCalendarEvent(');
    const block = src.slice(at, at + 1400);
    const catchAt = block.indexOf('catch (calErr)');
    assert.ok(catchAt > 0, `${route} has the calendar catch`);
    // Everything between the call and its catch is inside the try — and the catch
    // body only logs. A rethrow here would reach the outer catch and fail a PAID booking.
    const catchBody = block.slice(catchAt, block.indexOf('}', block.indexOf('});', catchAt)) + 1);
    assert.doesNotMatch(catchBody, /throw|return NextResponse|process\.exit/, `${route}: the calendar catch swallows nothing but also fails nothing`);
    assert.match(catchBody, /console\.error/, `${route}: and it is loud`);
  }
});

test('the ruling\'s fixed scope holds: no budget, no journal entry, no new source kind', () => {
  const leaf = code('src/lib/calendar/bookingEvent.ts') + code('src/lib/calendar/prismaBookingCalendar.ts');
  for (const banned of ['budget_line_items', 'budgetLineItem', 'journal_entries', 'journalEntry', 'budgets']) {
    assert.ok(!leaf.includes(banned), `CAL-01 does not touch ${banned}`);
  }
  // The row carries no coa_code and no budget_amount — budget mapping is deferred.
  const insert = code('src/lib/calendar/prismaBookingCalendar.ts');
  assert.ok(!insert.includes('coa_code'), 'no coa_code on the row');
  assert.ok(!insert.includes('budget_amount'), 'no budget_amount on the row');
  // The finding is written down where the next reader will meet it.
  assert.match(comments('src/lib/calendar/bookingEvent.ts'), /NOT FOUND/, 'STEP 1.5 is recorded in the leaf');
});
