/**
 * BOOKINGS-01 (2026-09-27) — one list shows every booking's truth, and a guest
 * flight keeps its contact.
 *
 * guestEmailOf and bookingRowOf are pure and driven over fixtures; the flight
 * route's use of the stored contact, the list route's scope and read-only-ness, the
 * travel tab's section and the absence of a retro are read from source
 * (TEST-TRUTH-01) — a route cannot run outside a Next request scope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { code, comments, rejoin } from '../sourceText';
import { guestEmailOf } from '../reservations/guestContact';
import { BOOKING_WORDS, STATUS_WORDS, bookingRowOf, type BookingRowFacts, type BookingRowReservation } from '../reservations/bookingRow';
import { BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';

const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const LIST_ROUTE = 'src/app/api/reservations/route.ts';
const LIST_VIEW = 'src/components/trips/AllBookings.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const RETRO = 'scripts/bookings-01-retro-guest-email.ts';
const LAW = 'scripts/assert-tool-registry.ts';

// ── the guest flight's contact ───────────────────────────────────────────────

test('a guest flight book → guestEmail = the prebook contact; an account flight book → null', () => {
  const contact = { contactEmail: 'traveller@example.com' };
  assert.equal(guestEmailOf(false, contact), 'traveller@example.com');
  assert.equal(guestEmailOf(true, contact), null);
  // The route: the contact is the prebook_contacts row read by prebookId, refused when absent, BEFORE the row is written.
  const fb = code(FLIGHT_BOOK);
  const read = fb.indexOf('const contact = await prisma.prebook_contacts.findUnique({ where: { prebookId } });');
  const refused = fb.indexOf("if (!contact || contact.lane !== 'flight') {");
  const written = fb.indexOf('guestEmail: guestEmailOf(isAccount, contact),');
  assert.ok(read > 0 && refused > read && written > refused, 'read → refused when absent → written');
  assert.match(fb, /bookingType: isAccount \? 'account' : 'guest',\s*guestEmail: guestEmailOf\(isAccount, contact\),/, 'the row writes it beside its booking type');
  assert.ok(!/guestEmail: null,/.test(fb), 'the old null is gone');
  // The stored contact always has an address: NOT NULL, validated by the prebook route before it is stored.
  assert.match(code('prisma/schema.prisma'), /model prebook_contacts \{[\s\S]*?contactEmail\s+String\s+@db\.VarChar\(255\)/);
  assert.match(code('src/app/api/travel/liteapi/flights/prebook/route.ts'), /if \(!\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/\.test\(email\)\) \{\s*return NextResponse\.json\(\{ error: 'contact\.email must be a valid email address' \}, \{ status: 400 \}\);/);
});

test('the retro: reservations stores no prebook id, so no row can be joined to its contact by id — no script, the count reported instead', () => {
  const model = /model reservations \{([\s\S]*?)\n\}/.exec(code('prisma/schema.prisma'))?.[1] ?? '';
  assert.ok(model.length > 0);
  assert.ok(!/\bprebook/i.test(model), 'no prebook id column on reservations');
  assert.equal(existsSync(RETRO), false, 'no retro that could only guess by name or time');
  assert.match(comments('src/lib/reservations/cancellation.ts'), /A\s*\n?\s*\*?\s*guest flight booked BEFORE that carries guestEmail null and CANNOT be reached/);
});

// ── the row ──────────────────────────────────────────────────────────────────

const HOTEL: BookingRowReservation = {
  id: 'r_h', lane: 'hotel', displayName: 'Hotel Temple', providerConfirmationCode: 'HCC-4421', providerBookingId: 'bk_h',
  status: 'confirmed', tripId: 't1', checkinDate: '2026-10-01', checkoutDate: '2026-10-03',
  ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: '2026-09-26T08:00:00.000Z',
  finalPriceCents: 18000, currency: 'USD', createdAt: '2026-09-20T10:00:00.000Z',
};
const FLIGHT: BookingRowReservation = {
  ...HOTEL, id: 'r_f', lane: 'flight', displayName: 'JetBlue Airways JFK → LAX', providerConfirmationCode: 'PNR123', providerBookingId: 'bk_f',
  checkinDate: null, checkoutDate: null, finalPriceCents: 28702, tripId: null,
};
const facts = (reservation: BookingRowReservation, more: Partial<Omit<BookingRowFacts, 'reservation'>> = {}): BookingRowFacts => ({
  reservation, calendarDay: null, chargeMatched: false, chargePosted: false, budgetLine: null, ...more,
});

test('a confirmed hotel, with and without its code: every word exact', () => {
  assert.deepEqual(bookingRowOf(facts(HOTEL)), {
    id: 'r_h', laneWord: 'Hotel', name: 'Hotel Temple', dates: '2026-10-01 → 2026-10-03', status: 'confirmed', cancellation: null,
    confirmation: 'HCC-4421', ticketing: null, vendorRead: 'vendor state read at 2026-09-26T08:00:00.000Z',
    bank: 'not matched', ledger: 'not posted', budgetLine: 'no budget line', price: '180.00 USD',
    // TRIPS-01 (2026-09-29): the Trip button opens the trip on the Travel tab, never the legacy planner.
    receiptHref: '/booking/r_h/receipt', tripHref: '/travel?trip=t1',
    // CAL-02 (2026-09-27): the booking's calendar file.
    icsHref: '/api/reservations/r_h/ics',
  });
  const noCode = bookingRowOf(facts({ ...HOTEL, providerConfirmationCode: null, displayName: null, lastVendorReadAt: null }));
  assert.equal(noCode.confirmation, 'not yet stated');
  assert.equal(noCode.name, 'Hotel booking bk_h', 'the one reader names it by lane and reference');
  assert.equal(noCode.vendorRead, 'not yet read from the vendor');
});

test('a ticketed flight; an unticketed one with a deadline; one with neither; its day from the calendar', () => {
  const ticketed = bookingRowOf(facts({ ...FLIGHT, ticketedAt: '2026-09-25T12:00:00.000Z', ticketLimitTime: '2026-09-27T00:00:00.000Z' }, { calendarDay: '2026-10-10' }));
  assert.equal(ticketed.ticketing, 'ticketed at 2026-09-25T12:00:00.000Z');
  assert.equal(ticketed.dates, 'departs 2026-10-10');
  assert.equal(ticketed.laneWord, 'Flight');
  assert.equal(ticketed.tripHref, null, 'a booking on no trip links to none');
  assert.equal(bookingRowOf(facts({ ...FLIGHT, ticketLimitTime: '2026-09-27T00:00:00.000Z' })).ticketing, 'ticket by 2026-09-27T00:00:00.000Z');
  const bare = bookingRowOf(facts(FLIGHT));
  assert.equal(bare.ticketing, 'not yet ticketed');
  assert.equal(bare.dates, 'no service dates stated');
  assert.equal(bare.price, '287.02 USD');
});

test('cancel_pending with the vendor\'s instant, and without; cancelled; an unknown status as itself', () => {
  const pending = bookingRowOf(facts({ ...FLIGHT, status: 'cancel_pending', cancelIntentAt: '2026-09-26T09:30:00.000Z' }));
  assert.equal(pending.status, 'cancellation requested — awaiting the airline');
  assert.equal(pending.cancellation, 'cancellation requested — the vendor stated it at 2026-09-26T09:30:00.000Z');
  assert.equal(bookingRowOf(facts({ ...FLIGHT, status: 'cancel_pending' })).cancellation, 'cancellation requested — the vendor stated no time');
  const cancelled = bookingRowOf(facts({ ...HOTEL, status: 'cancelled' }));
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellation, null);
  assert.equal(bookingRowOf(facts({ ...HOTEL, status: 'pending' })).status, 'pending with the vendor');
  assert.equal(bookingRowOf(facts({ ...HOTEL, status: 'something_new' })).status, 'something_new', 'never a guess');
  assert.deepEqual(Object.keys(STATUS_WORDS).sort(), ['cancel_pending', 'cancelled', 'confirmed', 'failed', 'pending']);
});

test('matched, posted and linked; the budget line without a description; none of the three', () => {
  const all = bookingRowOf(facts(HOTEL, { chargeMatched: true, chargePosted: true, budgetLine: { description: 'Lodging' } }));
  assert.deepEqual([all.bank, all.ledger, all.budgetLine], ['matched', 'posted', 'Lodging']);
  assert.equal(bookingRowOf(facts(HOTEL, { budgetLine: { description: null } })).budgetLine, '(no description)');
  const none = bookingRowOf(facts(HOTEL));
  assert.deepEqual([none.bank, none.ledger, none.budgetLine], ['not matched', 'not posted', 'no budget line']);
});

test('the price as recorded, the point placed by string: none stated, under a unit, a large one, another currency', () => {
  assert.equal(bookingRowOf(facts({ ...HOTEL, finalPriceCents: null })).price, 'price not stated by the vendor');
  assert.equal(bookingRowOf(facts({ ...HOTEL, finalPriceCents: 5 })).price, '0.05 USD');
  assert.equal(bookingRowOf(facts({ ...HOTEL, finalPriceCents: 0 })).price, '0.00 USD');
  assert.equal(bookingRowOf(facts({ ...HOTEL, finalPriceCents: 123456789 })).price, '1234567.89 USD');
  assert.equal(bookingRowOf(facts({ ...HOTEL, finalPriceCents: 1800000, currency: 'JPY' })).price, '18000.00 JPY', 'the column is hundredths in every currency; never converted');
  const leaf = code('src/lib/reservations/bookingRow.ts');
  assert.ok(!/\/\s*100|\*\s*100|toFixed|Number\(|Math\./.test(leaf), 'no arithmetic on money');
});

// ── the list ─────────────────────────────────────────────────────────────────

test("the list route: 401 / 404; exactly the caller's reservations, newest first (guests and other users never); every read scoped; no vendor client; zero writes", () => {
  const s = code(LIST_ROUTE);
  assert.match(s, /if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(s, /if \(!user\) return NextResponse\.json\(\{ error: 'User not found' \}, \{ status: 404 \}\);/);
  assert.match(s, /prisma\.reservations\.findMany\(\{\s*where: \{ userId: user\.id \},\s*orderBy: \{ createdAt: 'desc' \},/, 'a guest row has userId null; another user\'s has theirs — neither matches');
  assert.match(s, /where: \{ userId: user\.id, status: 'accepted', moneyEventId: null, reservationId: \{ in: ids \} \},/);
  assert.match(s, /where: \{ userId: user\.id, document_money_event_id: null, status: 'posted', document_reservation_id: \{ in: ids \} \},/);
  assert.match(s, /where: \{ userId: user\.id, reservationId: \{ in: ids \} \},/);
  // CAL-02 (2026-09-27): every calendar row of each booking — the bare key and each segment key — folded back to ONE day per booking.
  assert.match(s, /where: \{ user_id: user\.id, \.\.\.bookingCalendarRowsWhere\(ids\) \},/);
  assert.match(s, /const rid = reservationIdOfCalendarSourceId\(c\.source_id\);\s*if \(!dayOf\.has\(rid\)\) dayOf\.set\(rid, c\.start_date\);/);
  assert.ok(!/liteapiClient|liteapiFlightsClient|viatorClient|\bfetch\s*\(|reserveTravelSearch/.test(s), 'no vendor client');
  assert.ok(!/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/.test(s), 'zero writes');
  assert.ok(!/commission/i.test(s));
  assert.match(s, /bookingRowOf\(\{\s*reservation: r,/);
});

test('the travel tab: a Bookings section mounts the one list between the ledger and the unattached; the view types no word and writes nothing', () => {
  const launcher = code(LAUNCHER);
  const sections = [...launcher.matchAll(/data-travel-section="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sections.slice(-3), ['ledger', 'bookings', 'unattached']);
  const from = launcher.indexOf('data-travel-section="bookings"');
  const section = launcher.slice(from, launcher.indexOf('</section>', from));
  assert.match(section, /<TravelHeading>\{BOOKING_WORDS\.heading\}<\/TravelHeading>/);
  assert.match(section, /<AllBookings key=\{`all-\$\{tripsRefresh\}`\} \/>/);
  assert.match(launcher, /<TripBookings\b/);
  assert.match(launcher, /<UnattachedBookings\b/);
  const view = code(LIST_VIEW);
  assert.match(view, /fetch\('\/api\/reservations'\)/);
  assert.ok(!/>\s*[A-Za-z][^<{]*</.test(view), 'no typed word');
  assert.ok(!/method:\s*'(POST|PUT|PATCH|DELETE)'/.test(view), 'read-only');
  for (const w of ['{b.status}', '{b.bank}', '{b.ledger}', '{b.budgetLine}', '{b.price}', '{b.ticketing ?? BOOKING_WORDS.notApplicable}', '{BOOKING_WORDS.receipt}']) assert.ok(view.includes(w), w);
  assert.equal(BOOKING_WORDS.heading, 'Bookings');
});

test('the flight route is re-pinned, dated, the old hash stacked; the law carries the bookings law', () => {
  const pin = BOOKING_FLOW_FILES.find((p) => p.file === FLIGHT_BOOK);
  assert.ok(pin);
  assert.equal(bookingFlowSha256(rejoin(code(FLIGHT_BOOK), comments(FLIGHT_BOOK))), pin.sha256);
  const pins = code('src/lib/travelBookingFlow.ts') + comments('src/lib/travelBookingFlow.ts');
  assert.match(pins, /BOOKINGS-01 \(2026-09-27\): re-pinned/);
  assert.ok(pins.includes('Was ac3d2ef9fe7e38d561734664e46916a7ed96a90ae1165d072a5173e1e200a462 at main 486be479.'));
  assert.match(code(LAW), /lawGuard\('The bookings law', \(\) => \{/);
});
