/**
 * RECEIPT-01 (2026-09-26) — the receipt is the vendor's landed words, and the
 * export carries the ledger shape.
 *
 * One test per proof the ruling names. The leaf is pure and driven over fixtures
 * shaped by the documented answers (docs.liteapi.travel/reference/post_rates-book,
 * get_bookings-bookingid, get_flights-bookings-bookingid — the documented example
 * responses, verbatim where quoted); the CSV leaf over the receipts it makes; the
 * route, the page, the export, the lists, the middleware and the law are read from
 * source the way this repo proves what it cannot execute without a database. No
 * live call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, rejoin } from '../sourceText';
import {
  NOT_MATCHED, NOT_POSTED, NOT_STATED, NOT_YET_STATED_CODE, NOT_YET_TICKETED, NO_BOOK_ANSWER, NO_READ_YET, NO_REFUNDS, STATED_NOT_IN_BANK,
  receiptOf, type ReceiptArrival, type ReceiptReservation,
} from '../receipts/bookingReceipt';
import { BOOKINGS_LEDGER_COLUMNS, bookingsLedgerCsv, bookingsLedgerRow } from '../receipts/bookingsLedgerCsv';
import { BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';

const LEAF = 'src/lib/receipts/bookingReceipt.ts';
const CSV_LEAF = 'src/lib/receipts/bookingsLedgerCsv.ts';
const ROUTE = 'src/app/api/reservations/[id]/receipt/route.ts';
const PAGE = 'src/app/booking/[id]/receipt/page.tsx';
const EXPORT_ROUTE = 'src/app/api/export/route.ts';
const LISTS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx'];
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';

// ── fixtures shaped by the documented answers ────────────────────────────────

const HOTEL: ReceiptReservation = { id: 'res_h', lane: 'hotel', displayName: 'Sample Hotel', providerBookingId: 'ABC123', providerConfirmationCode: 'HOTEL123', status: 'confirmed', createdAt: '2026-09-20T10:00:00.000Z', checkinDate: '2026-10-01', checkoutDate: '2026-10-02' };
const FLIGHT: ReceiptReservation = { id: 'res_f', lane: 'flight', displayName: 'JetBlue Airways JFK → LAX', providerBookingId: '1297abe4', providerConfirmationCode: null, status: 'confirmed', createdAt: '2026-02-09T14:20:32.416Z', checkinDate: null, checkoutDate: null };

/** The documented example of POST /rates/book, data.* (verbatim fields). */
const HOTEL_BOOK: ReceiptArrival = {
  id: 'arr_book_h', arrived: '2026-09-20T10:00:01.000Z',
  payload: {
    bookingId: 'ABC123', status: 'CONFIRMED', hotelConfirmationCode: 'HOTEL123', checkin: '2025-01-01', checkout: '2025-01-02',
    hotel: { hotelId: 'lp1897', name: 'Sample Hotel' },
    bookedRooms: [{ roomType: { roomTypeId: 'RT123', name: 'Standard Room' }, boardType: 'RO', boardName: 'Room Only', adults: 2, children: 0, amount: 100, currency: 'USD' }],
    holder: { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phone: '+1234567890' },
    cancellationPolicies: { cancelPolicyInfos: [{ cancelTime: '2025-01-01 00:00:00', amount: 100, type: 'amount', timezone: 'GMT', currency: 'USD' }], hotelRemarks: ['No pets'], refundableTag: 'RFN' },
    price: 100, commission: 10, currency: 'USD', sellingPrice: '100', createdAt: '2025-01-01T00:00:00Z',
  },
};
/** A GET /bookings/{id} read: the documented checkinInstructions object and payment fields. */
const HOTEL_READ: ReceiptArrival = {
  id: 'arr_read_h', arrived: '2026-09-25T08:00:00.000Z',
  payload: {
    bookingId: 'ABC123', status: 'CONFIRMED', hotelConfirmationCode: 'HOTEL123', price: 100, currency: 'USD', paymentStatus: 'succeeded',
    checkinInstructions: { instructions: 'Front desk open 24h', idRequired: true, arrivalTimeRequested: false, propertyContact: { email: 'desk@sample.test', phone: '+1 555 0100' } },
    mandatoryFees: [{ amount: 12 }],
  },
};
/** The documented example of GET /flights/bookings/{id}, data[0].booking (verbatim), plus ticketData. */
const FLIGHT_READ: ReceiptArrival = {
  id: 'arr_read_f', arrived: '2026-02-10T09:00:00.000Z',
  payload: {
    bookingId: '1297abe4-57c5-4605-b8e7-5caad983c4a7', status: 'CONFIRMED', timestamp: '2026-02-09T14:20:32.416Z',
    journey: {
      journeyKey: 'a3bbe883fe3a4f6b',
      segments: [{ arrivalTime: '2026-04-10T18:40:00', carrier: { marketingCode: 'B6', marketingName: 'JetBlue Airways' }, departureTime: '2026-04-10T15:30:00', destinationCode: 'LAX', direction: 'OUTBOUND', duration: { minutes: 370 }, flight: { marketingNumber: '723' }, originCode: 'JFK', segmentKey: 'c52f4148', stopCount: 0 }],
      price: { base: 238.32, currency: 'USD', taxes: 48.7, total: 287.02 },
    },
    pricing: { subtotal: 287.02, totalAmount: 287.02, currency: 'USD' },
    passengers: [{ firstName: 'TEST', lastName: 'COLUMNS', gender: 'M', type: 'ADT' }],
    contact: { firstName: 'TEST', email: 'test.json@example.com' },
    order: { reference: { orderId: 'ORD1', airlineBookings: [{ pnr: 'QSVHH9' }] } },
    ticketData: { ticketedAt: '2026-02-09T15:00:00Z', confirmationId: 'TKT-1' },
  },
};
const FLIGHT_BOOK: ReceiptArrival = { id: 'arr_book_f', arrived: '2026-02-09T14:20:33.000Z', payload: { bookingId: '1297abe4-57c5-4605-b8e7-5caad983c4a7', status: 'PENDING_CONFIRMATION', pricing: { totalAmount: 287.02, currency: 'USD' }, contact: { firstName: 'TEST', email: 'test.json@example.com' } } };

const CHARGE_LINK = { id: 'link_1', transaction: { id: 't_charge', name: 'NUITEE*SAMPLE HOTEL', merchantName: 'Nuitee', amount: 100, date: '2026-09-21' } };
const ENTRY = { id: 'je_1', date: '2026-09-21', status: 'posted', ledger_entries: [
  { id: 'l_d', entry_type: 'D', amount: BigInt(10000), account: { code: 'P-9200', name: 'Accommodation' } },
  { id: 'l_c', entry_type: 'C', amount: BigInt(10000), account: { code: 'P-1000', name: 'Checking' } },
] };
const REFUND_STATED = { id: 'me_r1', kind: 'refund', amountCents: 25000, currency: 'USD', status: 'stated', statedAt: '2026-09-22T10:00:00.000Z', settledTransactionId: null, settledAt: null, settledTransaction: null };
const REFUND_SETTLED = { ...REFUND_STATED, id: 'me_r2', status: 'settled', settledTransactionId: 't_in', settledAt: '2026-09-27T09:00:00.000Z', settledTransaction: { name: 'NUITEE*SAMPLE HOTEL REFUND', date: '2026-09-26' } };
const FEE = { id: 'me_fee', kind: 'cancellation_fee', amountCents: null, currency: null, status: 'stated', statedAt: '2026-09-22T10:00:00.000Z', settledTransactionId: null, settledAt: null };

const empty = (reservation: ReceiptReservation) => ({ reservation, bookArrival: null, latestReadArrival: null, chargeLink: null, journalEntry: null, moneyEvents: [] });

// ── the leaf ─────────────────────────────────────────────────────────────────

test('hotel fixture (book answer + read with mandatoryFees) → every line present with its source and arrival id; taxes → not stated; mandatoryFees never read (not documented)', () => {
  const r = receiptOf({ reservation: HOTEL, bookArrival: HOTEL_BOOK, latestReadArrival: HOTEL_READ, chargeLink: CHARGE_LINK, journalEntry: ENTRY, moneyEvents: [] });
  assert.equal(r.header.laneWord, 'Hotel');
  assert.equal(r.header.name, 'Sample Hotel');
  assert.equal(r.header.vendorBookingId, 'ABC123');
  assert.equal(r.header.confirmationCode, 'HOTEL123');
  assert.equal(r.header.statusWord, 'confirmed');
  assert.equal(r.header.vendorStatus, 'CONFIRMED — as the vendor last stated on 2026-09-25T08:00:00.000Z');
  assert.equal(r.header.bookedAt, '2026-09-20T10:00:00.000Z');
  assert.equal(r.header.holder, 'John Doe · john.doe@example.com', 'the holder as the arrival states it');
  assert.ok(r.hotel && !r.flight);
  assert.deepEqual(r.hotel!.rooms, ['Standard Room · Room Only · 2 adult(s), 0 child(ren)']);
  assert.equal(r.hotel!.checkin, '2025-01-01');
  assert.equal(r.hotel!.checkout, '2025-01-02');
  assert.deepEqual(r.hotel!.checkinInstructions, ['Front desk open 24h', 'ID required at check-in: yes', 'arrival time requested by the property: no', 'property contact: desk@sample.test · +1 555 0100']);
  assert.deepEqual(r.hotel!.cancellationPolicy, ['refundable tag: RFN', 'cancel by 2025-01-01 00:00:00 GMT: 100 USD (amount)', 'hotel remark: No pets']);
  // VENDOR: the price IS the total line, stated on the book arrival.
  assert.deepEqual(r.vendor.total, { label: 'Total (the vendor’s price)', value: '100 USD', note: 'stated by the vendor on 2026-09-20T10:00:01.000Z', figure: { source: 'vendor', evidence: 'arr_book_h' } });
  assert.deepEqual(r.vendor.raw, { amount: '100', currency: 'USD', arrivalId: 'arr_book_h' });
  const byLabel = Object.fromEntries(r.vendor.lines.map((l) => [l.label, l]));
  assert.equal(byLabel['Selling price (as the vendor states it)'].value, '100 USD');
  assert.equal(byLabel['Taxes and fees'].value, `${NOT_STATED} (not a documented field of the hotel book answer or the booking read)`);
  assert.equal(byLabel['Taxes and fees'].figure, null);
  assert.deepEqual(byLabel['Payment status (vendor)'], { label: 'Payment status (vendor)', value: 'succeeded', note: 'stated by the vendor on 2026-09-25T08:00:00.000Z', figure: { source: 'vendor', evidence: 'arr_read_h' } });
  assert.ok(!JSON.stringify(r).includes('mandatory'), 'mandatoryFees is not a documented field and is never read');
  assert.ok(!/ommission/.test(JSON.stringify(r)), 'commission appears nowhere');
  // BANK and LEDGER lines carry their own sources.
  assert.deepEqual(r.bank.line, { label: 'Bank row', value: 'NUITEE*SAMPLE HOTEL (Nuitee) · 100 · 2026-09-21', note: 'recorded by your bank', figure: { source: 'bank', evidence: 't_charge' } });
  assert.deepEqual(r.ledger.entry, { label: 'Journal entry', value: 'je_1 · 2026-09-21 · posted', note: 'posted to the ledger', figure: { source: 'ledger', evidence: 'je_1' } });
  assert.deepEqual(r.ledger.lines.map((l) => [l.label, l.value]), [['Debit', 'P-9200 Accommodation · 10000 cents'], ['Credit', 'P-1000 Checking · 10000 cents']]);
  assert.deepEqual(r.ledger.raw, { entryId: 'je_1', date: '2026-09-21', accountCode: 'P-9200', accountName: 'Accommodation', debitCents: '10000', creditCents: '10000' });
  assert.equal(r.refundsWords, NO_REFUNDS);
});

test('flight fixture with ticketData → segments, PNR, ticketing with the issue instant and confirmation; without ticketData → "not yet ticketed"; the journey price lines each their own', () => {
  const r = receiptOf({ reservation: FLIGHT, bookArrival: FLIGHT_BOOK, latestReadArrival: FLIGHT_READ, chargeLink: null, journalEntry: null, moneyEvents: [] });
  assert.ok(r.flight && !r.hotel);
  assert.deepEqual(r.flight!.segments, ['JetBlue Airways 723 · JFK → LAX · departs 2026-04-10T15:30:00 · arrives 2026-04-10T18:40:00']);
  assert.deepEqual(r.flight!.passengers, ['TEST COLUMNS (ADT)']);
  assert.equal(r.flight!.pnr, 'QSVHH9', 'the first airlineBookings[].pnr when provider.pnr is absent');
  assert.equal(r.flight!.ticketing, 'ticketed at 2026-02-09T15:00:00Z · confirmation TKT-1');
  assert.equal(r.header.holder, 'TEST · test.json@example.com', 'the flight answer states contact, not holder');
  assert.equal(r.header.confirmationCode, NOT_YET_STATED_CODE);
  assert.deepEqual(r.vendor.total, { label: 'Total (the vendor’s price)', value: '287.02 USD', note: 'stated by the vendor on 2026-02-09T14:20:33.000Z', figure: { source: 'vendor', evidence: 'arr_book_f' } });
  assert.deepEqual(r.vendor.lines.map((l) => [l.label, l.value]), [['Base fare', NOT_STATED], ['Taxes', NOT_STATED], ['Fees', NOT_STATED], ['Journey total', NOT_STATED], ['Subtotal before ancillaries', NOT_STATED]], 'the book arrival states only pricing.totalAmount — the journey price is not invented from the read');
  const { ticketData: _t, ...noTickets } = FLIGHT_READ.payload as Record<string, unknown>;
  void _t;
  const u = receiptOf({ reservation: FLIGHT, bookArrival: FLIGHT_BOOK, latestReadArrival: { ...FLIGHT_READ, payload: noTickets }, chargeLink: null, journalEntry: null, moneyEvents: [] });
  assert.equal(u.flight!.ticketing, NOT_YET_TICKETED);
  // A book arrival that states the journey price: base / taxes / fees / total as separate lines, no sum.
  const priced = receiptOf({ reservation: FLIGHT, bookArrival: { ...FLIGHT_BOOK, payload: FLIGHT_READ.payload }, latestReadArrival: null, chargeLink: null, journalEntry: null, moneyEvents: [] });
  assert.deepEqual(priced.vendor.lines.map((l) => [l.label, l.value]), [['Base fare', '238.32 USD'], ['Taxes', '48.7 USD'], ['Fees', NOT_STATED], ['Journey total', '287.02 USD'], ['Subtotal before ancillaries', '287.02 USD']]);
  assert.equal(priced.header.vendorStatus, NO_READ_YET);
});

test('no charge link → "not yet matched to a bank row"; accepted link → the bank line; posted entry → the D/C lines; none → "not posted"', () => {
  const none = receiptOf(empty(HOTEL));
  assert.equal(none.bank.line, null);
  assert.equal(none.bank.words, NOT_MATCHED);
  assert.deepEqual(none.bank.raw, { transactionId: null, descriptor: null, amount: null, date: null });
  assert.equal(none.ledger.entry, null);
  assert.equal(none.ledger.words, NOT_POSTED);
  assert.equal(none.vendor.total.value, NO_BOOK_ANSWER, 'a row landed before its book answer was kept says so');
  assert.equal(none.hotel!.checkinInstructions[0], NO_READ_YET);
  const some = receiptOf({ ...empty(HOTEL), chargeLink: CHARGE_LINK, journalEntry: ENTRY });
  assert.equal(some.bank.line!.figure!.evidence, 't_charge');
  assert.deepEqual(some.bank.raw, { transactionId: 't_charge', descriptor: 'NUITEE*SAMPLE HOTEL', amount: '100', date: '2026-09-21' });
  assert.equal(some.ledger.lines.length, 2);
});

test('a settled refund → the settling bank row and date; a stated one → "stated, not yet in the bank"; an unquantified fee → not stated; each with its evidence', () => {
  const r = receiptOf({ ...empty(HOTEL), moneyEvents: [REFUND_STATED, REFUND_SETTLED, FEE] });
  assert.equal(r.refunds.length, 3);
  assert.deepEqual(r.refunds[0], { kind: 'refund', amount: '25000 cents USD', statedAt: '2026-09-22T10:00:00.000Z', settlement: STATED_NOT_IN_BANK, figure: { source: 'vendor', evidence: 'me_r1' }, raw: { id: 'me_r1', kind: 'refund', status: 'stated', amountCents: '25000', currency: 'USD', settledTransactionId: null } });
  assert.equal(r.refunds[1].settlement, 'settled by bank row t_in (NUITEE*SAMPLE HOTEL REFUND · 2026-09-26) on 2026-09-27T09:00:00.000Z');
  assert.equal(r.refunds[2].amount, NOT_STATED);
  assert.equal(r.refundsWords, 'as the vendor stated them');
});

test('the leaf never computes: lines that would sum differently from the price still show the vendor’s price alone; a fixture with no price says not stated, never a sum of its rooms', () => {
  const payload = { ...(HOTEL_BOOK.payload as Record<string, unknown>), price: 100, bookedRooms: [{ roomType: { name: 'A' }, amount: 70, currency: 'USD' }, { roomType: { name: 'B' }, amount: 70, currency: 'USD' }] };
  const r = receiptOf({ ...empty(HOTEL), bookArrival: { ...HOTEL_BOOK, payload } });
  assert.equal(r.vendor.total.value, '100 USD', 'the vendor’s price, not 140');
  assert.ok(!JSON.stringify(r.vendor).includes('140'));
  const { price: _p, ...noPrice } = payload;
  void _p;
  const n = receiptOf({ ...empty(HOTEL), bookArrival: { ...HOTEL_BOOK, payload: noPrice } });
  assert.equal(n.vendor.total.value, NOT_STATED);
  assert.deepEqual(n.vendor.raw, { amount: null, currency: 'USD', arrivalId: 'arr_book_h' });
  // The law's rule, on the source: no conversion, rounding, formatting or fold; no * or / on a money line.
  for (const f of [LEAF, CSV_LEAF]) {
    const src = code(f);
    assert.ok(!/\b(reduce|Number|parseFloat|parseInt|toFixed)\s*\(|[+\-*\/]=|Math\./.test(src), `${f} computes nothing`);
    for (const line of src.split('\n')) {
      if (/\b(amount|price|cents|total|fee|fees|taxes|refund)\w*/i.test(line)) assert.ok(!/(?<![*\/])[*\/](?![*\/])/.test(line), `${f}: ${line.trim()}`);
    }
    for (const impure of [/\bfetch\s*\(/, /process\.env/, /new Date\s*\(\s*\)|Date\.now\s*\(/, /prisma|PrismaClient/, /from 'react'/]) assert.ok(!impure.test(src), `${f} pure (${impure})`);
    assert.ok(!/commission/i.test(src), `${f}: commission appears nowhere`);
  }
});

// ── the route, the page, the lists, the middleware ──────────────────────────

test('receipt route: another user’s reservation → 404 and a guest row → 404 (findFirst { id, userId }); no vendor client imported; zero writes; no tier gate; the latest read by arrived DESC', () => {
  const r = code(ROUTE);
  assert.ok(r.indexOf("{ status: 401 }") < r.indexOf('prisma.'), '401 before any query');
  assert.ok(r.includes("where: { id, userId: user.id },"));
  assert.ok(r.includes("if (!reservation) return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });"));
  assert.ok(!/liteapiClient|liteapiFlightsClient|\bfetch\s*\(|reserveTravelSearch/.test(r), 'the clients are not imported; nothing fetched');
  assert.ok(!/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$transaction/.test(r), 'zero writes');
  assert.ok(!/requireTier|requireTabAccess/.test(r), 'no tier gate — the export’s bar');
  assert.ok(r.includes("resource: BOOKING_READ, their_id: bookingReadTheirId(reservation.providerBookingId), user_id: user.id") && r.includes("orderBy: { arrived: 'desc' },"));
  assert.ok(r.includes("where: { reservationId: reservation.id, userId: user.id, status: 'accepted', moneyEventId: null },"), 'the accepted charge link, user-scoped');
  assert.ok(r.includes("where: { userId: user.id, document_reservation_id: reservation.id, document_money_event_id: null, status: 'posted' },"), 'the posted charge entry');
  assert.ok(r.includes('receiptOf({ reservation, bookArrival, latestReadArrival, chargeLink, journalEntry, moneyEvents })'));
  assert.ok(!/commission/i.test(r));
});

test('the page: not in PUBLIC_PATHS (the middleware redirect gates it), doored by GUEST_ROUTES, reads the owner route, prints through the browser, types no money words', () => {
  const mw = code(MIDDLEWARE);
  assert.ok(!/'\/booking',|'\/booking\/\[id\]/.test(mw), 'not public');
  assert.ok(mw.includes("'/booking/confirm',") && mw.includes("'/booking/flight-confirm',"), 'the two return pages stay public');
  assert.ok(mw.includes("const loginUrl = new URL('/', request.url);\n    return NextResponse.redirect(loginUrl);"), 'no cookie → the redirect');
  const law = code(LAW);
  assert.ok(law.includes("{ route: '/booking/[id]/receipt', why: 'RECEIPT-01:"), 'the listed door');
  const p = code(PAGE);
  assert.ok(p.includes("'use client'"));
  assert.ok(p.includes('/api/reservations/${encodeURIComponent(id)}/receipt'));
  assert.ok(p.includes('window.print()'));
  assert.ok(p.includes('@media print'));
  for (const typed of ['not stated', 'stated by the vendor', 'recorded by your bank', 'not posted', 'not yet matched', 'not yet ticketed', 'no refund', 'USD', 'cents']) {
    assert.ok(!new RegExp(`['"\`][^'"\`\\n]*${typed}[^'"\`\\n]*['"\`]`, 'i').test(p), `types no "${typed}"`);
  }
  assert.ok(!/pdf-lib|jspdf|puppeteer|@react-pdf/i.test(rejoin(p, comments(PAGE))), 'no PDF library');
  assert.match(comments(PAGE), /browser's Print \/ Save as PDF/);
  assert.ok(!/commission/i.test(p));
});

test('both lists carry the Receipt link beside Cancel and are re-pinned with dated notes, the old hashes stacked', () => {
  for (const f of LISTS) {
    const src = code(f);
    const at = src.indexOf('href={`/booking/${r.id}/receipt`}');
    assert.ok(at > 0 && at < src.indexOf('Cancel booking'), `${f}: the Receipt link before Cancel`);
    assert.ok(src.includes("import Link from 'next/link';"));
    const pin = BOOKING_FLOW_FILES.find((x) => x.file === f)!;
    assert.equal(bookingFlowSha256(rejoin(code(f), comments(f))), pin.sha256, `${f} re-pinned`);
  }
  const notes = comments('src/lib/travelBookingFlow.ts');
  assert.match(notes, /RECEIPT-01 \(2026-09-26\): re-pinned — a "Receipt" link beside Cancel/);
  assert.match(notes, /Was 1d76057906ef2eade1c6ff28b4532e1a66b637bccd4617cf8751281ed6f8996c at main fe50c127/);
  assert.match(notes, /Was cff86c0203191650923d4eb23609098e06e21e97a53794aea6f3956daf4a8f2d at main fe50c127/);
});

// ── the export ───────────────────────────────────────────────────────────────

test('export: bookings_ledger.csv present with exactly the ruled columns in order; an unmatched booking has empty bank and ledger columns, never 0; amounts are the recorded figures; refunds listed, never summed', () => {
  assert.deepEqual([...BOOKINGS_LEDGER_COLUMNS], [
    'booking_id', 'lane', 'provider_booking_id', 'confirmation_code', 'status',
    'traveler', 'booked_at', 'service_start', 'service_end',
    'vendor_amount', 'vendor_currency', 'vendor_arrival_id',
    'bank_transaction_id', 'bank_descriptor', 'bank_amount', 'bank_date',
    'journal_entry_id', 'journal_date', 'account_code', 'account_name',
    'debit_cents', 'credit_cents',
    'refund_count', 'refunds_stated_cents', 'refunds_settled_cents',
    'refund_currency',
  ]);
  const unmatched = bookingsLedgerRow(HOTEL, receiptOf({ ...empty(HOTEL), bookArrival: HOTEL_BOOK }));
  assert.equal(unmatched.vendor_amount, '100');
  assert.equal(unmatched.vendor_currency, 'USD');
  assert.equal(unmatched.vendor_arrival_id, 'arr_book_h');
  assert.equal(unmatched.traveler, 'John Doe · john.doe@example.com');
  for (const c of ['bank_transaction_id', 'bank_descriptor', 'bank_amount', 'bank_date', 'journal_entry_id', 'journal_date', 'account_code', 'account_name', 'debit_cents', 'credit_cents', 'refunds_stated_cents', 'refunds_settled_cents', 'refund_currency'] as const) {
    assert.equal(unmatched[c], '', `${c} is empty, never 0`);
  }
  assert.equal(unmatched.refund_count, '0');
  const full = bookingsLedgerRow(HOTEL, receiptOf({ reservation: HOTEL, bookArrival: HOTEL_BOOK, latestReadArrival: null, chargeLink: CHARGE_LINK, journalEntry: ENTRY, moneyEvents: [REFUND_STATED, REFUND_SETTLED, FEE] }));
  assert.equal(full.bank_amount, '100');
  assert.equal(full.debit_cents, '10000');
  assert.equal(full.credit_cents, '10000');
  assert.equal(full.account_code, 'P-9200');
  assert.equal(full.refund_count, '2', 'refunds only — the fee is not a refund');
  assert.equal(full.refunds_stated_cents, '25000');
  assert.equal(full.refunds_settled_cents, '25000');
  assert.equal(full.refund_currency, 'USD');
  const bare = bookingsLedgerRow({ ...HOTEL, providerConfirmationCode: null }, receiptOf(empty(HOTEL)));
  assert.equal(bare.vendor_amount, '');
  assert.equal(bare.confirmation_code, '');
  assert.equal(bare.traveler, '', 'a holder the vendor did not state is empty, never the absence words');
  const csv = bookingsLedgerCsv([unmatched, full]);
  const [header, ...rows] = csv.trimEnd().split('\n');
  assert.equal(header, BOOKINGS_LEDGER_COLUMNS.join(','));
  assert.equal(rows.length, 2);
  assert.ok(rows[0].startsWith('res_h,hotel,ABC123,HOTEL123,confirmed,'));
  assert.equal(bookingsLedgerCsv([]), BOOKINGS_LEDGER_COLUMNS.join(',') + '\n');
  // The route adds it beside the raw tables, declares it on the manifest, removes nothing and gains no gate.
  const e = code(EXPORT_ROUTE);
  assert.ok(e.includes("zip.addFile('bookings_ledger.csv', Buffer.from(bookingsLedgerCsv(ledgerRows), 'utf8'));"));
  assert.ok(e.includes('manifest.push(`bookings_ledger,${ledgerRows.length},bookings_ledger.csv`);'));
  assert.ok(!/requireTier|requireTabAccess/.test(e));
  for (const table of ['entities', 'chart_of_accounts', 'journal_entries', 'ledger_entries', 'ledger_line_links', 'merchant_coa_mappings', 'closing_periods', 'bank_reconciliations', 'accounts', 'transactions', 'investment_transactions', 'budgets', 'budget_line_items', 'stock_lots', 'lot_dispositions', 'lot_adjustments', 'corporate_actions', 'trade_journal_entries', 'tax_overrides', 'tax_documents', 'home_expenses', 'module_expenses', 'trips', 'trip_expenses', 'expense_splits', 'reservations', 'operations_vendor_directory']) {
    assert.ok(e.includes(`{ name: '${table}', rows:`), `${table} still exported`);
  }
  assert.ok(!e.includes("name: 'commission_ledger'"), 'commission_ledger was not among the tables and is not added — Alex’s ruling');
  assert.ok(e.includes("where: { userId: uid, status: 'accepted', moneyEventId: null },") && e.includes("where: { userId: uid, document_money_event_id: null, status: 'posted' },"), 'the bank and ledger columns come from POST-01’s chain, user-scoped');
});

test('the law suite carries the receipt law with its clauses', () => {
  const c = comments(LAW);
  for (const clause of ['THE LEAF IS PURE AND DOES NO ARITHMETIC ON MONEY', 'COMMISSION APPEARS NOWHERE ON A RECEIPT', 'THE RECEIPT ROUTE IMPORTS NO VENDOR CLIENT AND WRITES NOTHING', 'THE PAGE TYPES NO MONEY WORDS OF ITS OWN', 'BOTH LISTS CARRY THE RECEIPT LINK BESIDE CANCEL', "THE EXPORT'S DERIVED CSV HAS THE FIXED COLUMN LIST"]) {
    assert.ok(c.includes(clause), clause);
  }
  assert.ok(code(LAW).includes("lawGuard('The receipt law', () => {"));
});
