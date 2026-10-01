/**
 * GUEST-02 (2026-09-30) — a guest cancels their booking: /booking/manage offers Cancel on the
 * one booking the guest's session opened, and the cancel runs the SAME code the account
 * holder's does — one cancel flow (src/lib/reservations/cancelFlow.ts), two gates.
 *
 * One test group per proof the ruling names:
 *   G1 the guest's gate over fake ports — every branch, the calls in order;
 *   G2 the offer — exactly a confirmed LiteAPI hotel or flight;
 *   G3 the booking answer — the offer beside the unchanged receipt;
 *   G4 the cancellation landing names its owner — both owners, over the shared fake store;
 *   G5 the email — the manage block for a guest and none for an account, through the template;
 *   G6 the two gates and the page, read from source the way this repo proves what it cannot
 *      run without a database and a vendor (R2, R5, R7, R8).
 *   G7 GUEST-02b (2026-09-30): what only the pin held — no cancel answer names commission (the
 *      count goes to the server log), both lanes land with the row's owner and email the caller's
 *      address, and the page reads the booking again before its line.
 * No live call, no database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { code, comments, functionBody } from '../sourceText';
import { signGuestSession } from '../guest/guestAccess';
import {
  GUEST_CANCEL_LIMITS, GUEST_LIMITS, GUEST_WORDS, guestBooking, guestCancelGate, guestCancelOffer,
  type GuestBookingPorts, type GuestCancelPorts, type GuestReservationRow, type LimitOutcome,
} from '../guest/guestSession';
import { guestReceiptOf, type GuestMoneyEvent, type ReceiptArrival } from '../receipts/bookingReceipt';
import { lifecycleEmail } from '../emailTemplates/lifecycle';
import { bookingGuestRef, landLiteApiCancellation, type LiteApiAnswer } from '../arrivals/liteapiBooking';
import { flightCancellationObjectOf, parseFlightCancellationResult } from '../liteapiFlightsClient';
import { FakeLanding } from './fakeLanding';
import { closingOf, splitArgs } from '../security/ownershipLaw';

const DECISION = 'src/lib/guest/guestSession.ts';
const ACCOUNT_ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const GUEST_ROUTE = 'src/app/api/guest/booking/cancel/route.ts';
const BOOKING_ROUTE = 'src/app/api/guest/booking/route.ts';
const FLOW = 'src/lib/reservations/cancelFlow.ts';
const PAGE = 'src/app/booking/manage/page.tsx';
const DIALOG = 'src/components/trips/CancelBookingDialog.tsx';
const LISTS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx'];
const LANDING = 'src/lib/arrivals/liteapiBooking.ts';

const KEY = createHmac('sha256', 'guest02-test').update('probe').digest();
const OTHER_KEY = createHmac('sha256', 'guest02-test').update('other').digest();
const ID = '4f6c2d1a-9b3e-4c7d-8a2f-1e5b6c7d8e9f';
const NOW = 1_900_000_000;
const IP = '203.0.113.7';

// ── G1. the guest's gate ─────────────────────────────────────────────────────

type Row = { id: string; marker: string };
const ROW: Row = { id: ID, marker: 'the gate’s row' };

function gatePorts(opts: { overAt?: 'ip' | 'reservation'; row?: Row | null } = {}) {
  const calls: string[] = [];
  const ports: GuestCancelPorts<Row> = {
    limit: async (key, limit, windowSeconds): Promise<LimitOutcome> => {
      calls.push(`limit ${key} ${limit}/${windowSeconds}`);
      const over = (opts.overAt === 'ip' && key.startsWith('guest-cancel-ip:')) || (opts.overAt === 'reservation' && key.startsWith('guest-cancel:'));
      return over ? { ok: false, retryAfterSeconds: 321 } : { ok: true };
    },
    reservation: async (id) => { calls.push(`reservation ${id}`); return opts.row === undefined ? ROW : opts.row; },
  };
  return { ports, calls };
}

const SESSION = () => signGuestSession(KEY, ID, NOW + 60);
const IP_LIMIT = `limit guest-cancel-ip:${IP} 10/900`;
const RES_LIMIT = `limit guest-cancel:${ID} 5/900`;

test('G1 the session first: none, tampered, foreign-key or expired is 401 — nothing counted, nothing read', async () => {
  for (const cookie of [null, '', 'v1.garbage', signGuestSession(OTHER_KEY, ID, NOW + 60), signGuestSession(KEY, ID, NOW)]) {
    const { ports, calls } = gatePorts();
    assert.deepEqual(await guestCancelGate(ports, { cookie, ip: IP, key: KEY, now: NOW }), { status: 401, error: GUEST_WORDS.sessionEnded });
    assert.deepEqual(calls, []);
  }
});

test('G1 no IP is the one 404 — nothing counted, nothing read (there is no unknown bucket)', async () => {
  for (const ip of [null, '']) {
    const { ports, calls } = gatePorts();
    assert.deepEqual(await guestCancelGate(ports, { cookie: SESSION(), ip, key: KEY, now: NOW }), { status: 404, error: GUEST_WORDS.notOpened });
    assert.deepEqual(calls, []);
  }
});

test('G1 the IP limit, then the reservation limit — both before the read; over either is 429 with the wait', async () => {
  const byIp = gatePorts({ overAt: 'ip' });
  assert.deepEqual(await guestCancelGate(byIp.ports, { cookie: SESSION(), ip: IP, key: KEY, now: NOW }), { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: 321 });
  assert.deepEqual(byIp.calls, [IP_LIMIT], 'over the IP limit: the reservation is neither counted nor read');
  const byReservation = gatePorts({ overAt: 'reservation' });
  assert.deepEqual(await guestCancelGate(byReservation.ports, { cookie: SESSION(), ip: IP, key: KEY, now: NOW }), { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: 321 });
  assert.deepEqual(byReservation.calls, [IP_LIMIT, RES_LIMIT], 'over the reservation limit: nothing read');
});

test('G1 a row that is no longer a guest’s (or is gone) is the one 404, after both limits', async () => {
  const { ports, calls } = gatePorts({ row: null });
  assert.deepEqual(await guestCancelGate(ports, { cookie: SESSION(), ip: IP, key: KEY, now: NOW }), { status: 404, error: GUEST_WORDS.notOpened });
  assert.deepEqual(calls, [IP_LIMIT, RES_LIMIT, `reservation ${ID}`]);
});

test('G1 a match answers the IP and the row the port read — the session’s reservation, in order: IP limit, reservation limit, read', async () => {
  const { ports, calls } = gatePorts();
  const answer = await guestCancelGate(ports, { cookie: SESSION(), ip: IP, key: KEY, now: NOW });
  assert.deepEqual(answer, { status: 200, ip: IP, row: ROW });
  assert.deepEqual(calls, [IP_LIMIT, RES_LIMIT, `reservation ${ID}`], 'the reservation read is the session’s own id');
});

test('G1 the cancel’s own buckets and limits — never the lookup’s; the decision knows no flow and writes nothing', () => {
  assert.deepEqual(GUEST_CANCEL_LIMITS, { ip: { limit: 10, windowSeconds: 900 }, reservation: { limit: 5, windowSeconds: 900 } });
  assert.deepEqual(GUEST_LIMITS, { ip: { limit: 10, windowSeconds: 900 }, reference: { limit: 5, windowSeconds: 900 } }, 'the lookup’s limits unchanged');
  const src = code(DECISION);
  assert.ok(!/cancelFlow|CANCEL_ROW_SELECT/.test(src), 'the row type is the caller’s');
  assert.ok(!/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|console\.|fetch\(/.test(src), 'no write, no log, no call');
  assert.ok(src.includes('ports.limit(`guest-cancel-ip:${input.ip}`') && src.includes('ports.limit(`guest-cancel:${reservationId}`'));
});

// ── G2. the offer ────────────────────────────────────────────────────────────

const OFFER_ROW: GuestReservationRow = { id: ID, lane: 'hotel', displayName: 'Sample Hotel', providerBookingId: 'G1', providerConfirmationCode: null, status: 'confirmed', createdAt: '2026-09-20T10:00:00.000Z', checkinDate: '2026-10-01', checkoutDate: '2026-10-03', arrival_id: null, provider: 'liteapi', cancellationPolicyJson: { refundableTag: 'RFN' } };

test('G2 the offer: a confirmed LiteAPI hotel or flight — its lane, its stored terms verbatim, its dates as YYYY-MM-DD', () => {
  assert.deepEqual(guestCancelOffer(OFFER_ROW), { lane: 'hotel', policy: { refundableTag: 'RFN' }, checkIn: '2026-10-01', checkOut: '2026-10-03' });
  assert.deepEqual(guestCancelOffer({ ...OFFER_ROW, lane: 'flight', displayName: 'JetBlue Airways JFK → LAX', checkinDate: null, checkoutDate: null, cancellationPolicyJson: null }), { lane: 'flight', policy: null, checkIn: null, checkOut: null });
});

test('G2 no offer on anything the flow would refuse: cancelled, cancel_pending, pending, an activity, Duffel, Viator', () => {
  const table: Array<[string, GuestReservationRow]> = [
    ['cancelled', { ...OFFER_ROW, status: 'cancelled' }],
    ['cancel_pending', { ...OFFER_ROW, status: 'cancel_pending' }],
    ['pending', { ...OFFER_ROW, status: 'pending' }],
    ['an activity', { ...OFFER_ROW, lane: 'activity' }],
    ['Duffel', { ...OFFER_ROW, provider: 'duffel' }],
    ['Duffel flight', { ...OFFER_ROW, provider: 'duffel', lane: 'flight' }],
    ['Viator', { ...OFFER_ROW, provider: 'viator', lane: 'activity' }],
  ];
  for (const [what, row] of table) assert.equal(guestCancelOffer(row), null, what);
});

// ── G3. the booking answer ───────────────────────────────────────────────────

const HOTEL_BOOK: ReceiptArrival = { id: 'arr_book_h', arrived: '2026-09-20T10:00:01.000Z', payload: { bookingId: 'G1', status: 'CONFIRMED', price: 100, currency: 'USD', sellingPrice: '100', holder: { firstName: 'Ada', lastName: 'Guest' }, bookedRooms: [{ roomType: { name: 'Standard Room' }, adults: 2, children: 0 }], checkin: '2026-10-01', checkout: '2026-10-03' } };
const REFUND: GuestMoneyEvent = { id: 'me_1', kind: 'refund', amountCents: 5000, currency: 'USD', statedAt: '2026-09-21T10:00:00.000Z' };

function bookingPorts(row: GuestReservationRow): GuestBookingPorts {
  return {
    reservation: async () => row,
    bookArrival: async () => HOTEL_BOOK,
    latestRead: async () => null,
    moneyEvents: async () => [REFUND],
  };
}

test('G3 the booking answer carries the offer beside the receipt, which is unchanged — guestReceiptOf’s own', async () => {
  const row = { ...OFFER_ROW, arrival_id: 'arr_book_h' };
  const answer = await guestBooking(bookingPorts(row), { cookie: SESSION(), key: KEY, now: NOW });
  assert.equal(answer.status, 200);
  if (answer.status !== 200) return;
  assert.deepEqual(Object.keys(answer), ['status', 'receipt', 'cancel']);
  assert.deepEqual(answer.receipt, guestReceiptOf({ reservation: row, bookArrival: HOTEL_BOOK, latestReadArrival: null, moneyEvents: [REFUND] }));
  assert.deepEqual(answer.cancel, guestCancelOffer(row));
  assert.equal(answer.cancel?.lane, 'hotel');
  const cancelled = await guestBooking(bookingPorts({ ...row, status: 'cancelled' }), { cookie: SESSION(), key: KEY, now: NOW });
  assert.ok(cancelled.status === 200 && cancelled.cancel === null, 'a cancelled booking is offered nothing — its receipt still reads');
});

test('G3 the booking route reads the two fields the offer needs and answers { receipt, cancel }, never cached', () => {
  const src = code(BOOKING_ROUTE);
  assert.ok(src.includes('provider: true, cancellationPolicyJson: true,'));
  assert.ok(src.includes("where: { id, bookingType: 'guest', userId: null },"), 'still the guest’s row only');
  assert.ok(src.includes('return NextResponse.json({ receipt: answer.receipt, cancel: answer.cancel }, { headers: NO_STORE });'));
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)/, 'still GET only');
});

// ── G4. the cancellation landing names its owner ─────────────────────────────

const FINAL_ANSWER = { data: { bookingId: 'fb_G2', status: 'CANCELLED', cancellation_fee: 0, refund_amount: 120, currency: 'USD', destination: 'original_payment', vouchers: null } };
const answerOf = (json: unknown): LiteApiAnswer => {
  const text = JSON.stringify(json, null, 1);
  return { httpStatus: 200, body: Buffer.from(text, 'utf8'), asked: new Date('2026-09-30T09:04:58Z'), arrived: new Date('2026-09-30T09:05:00Z'), json: JSON.parse(text) };
};

async function landAs(userId: string | null) {
  const landing = new FakeLanding();
  const answer = answerOf(FINAL_ANSWER);
  await landLiteApiCancellation({ landing, now: () => new Date('2026-09-30T09:05:01Z'), writeStatus: async () => ({ status: 'cancelled' }) },
    { answer, bookingId: 'fb_G2', payload: flightCancellationObjectOf(answer.json), parse: parseFlightCancellationResult, userId });
  return landing;
}

test('G4 a guest row’s cancel lands under guest_ref booking:<id> with no user — as its booking landed; an account’s exactly as before', async () => {
  const guest = await landAs(null);
  assert.equal(bookingGuestRef('fb_G2'), 'booking:fb_G2');
  assert.deepEqual(guest.responses.map((r) => [r.user_id, r.guest_ref]), [[null, 'booking:fb_G2']], 'the response');
  assert.deepEqual(guest.rowsOf('cancellation').map((a) => [a.row.user_id, a.row.guest_ref]), [[null, 'booking:fb_G2']], 'the arrival');
  const account = await landAs('u_alex');
  assert.deepEqual(account.responses.map((r) => [r.user_id, r.guest_ref]), [['u_alex', null]]);
  assert.deepEqual(account.rowsOf('cancellation').map((a) => [a.row.user_id, a.row.guest_ref]), [['u_alex', null]]);
  const src = code(LANDING);
  assert.ok(src.includes('const guestRef = input.userId === null ? bookingGuestRef(input.bookingId) : null;'));
  assert.ok(src.includes('userId: string | null;'), 'the landing’s owner may be null');
});

// ── G5. the email ────────────────────────────────────────────────────────────

test('G5 the cancellation email: a guest row gets its manage block in place of "See this booking" — cancelled and cancel_pending; an account row gets none', async () => {
  process.env.JWT_SECRET = 'guest02-test-secret';
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const { guestManageFor } = await import('../reservations/lifecycleSend');
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.templestuart.com';
    const travel = 'https://www.templestuart.com/travel';
    const common = { name: 'Hotel Temple', lane: 'hotel' as const, reference: 'bk_G2', checkinDate: '2026-10-01', checkoutDate: '2026-10-03' };
    const facts = { refund: { amountCents: 12000, currency: 'USD' }, fee: { amountCents: null, currency: null }, destination: 'original_payment', vouchers: [], providerStatus: 'CANCELLED' };
    // The flow's own rule, over the two rows (sendCancellationEmail: guestManageFor(owned), manageUrl null when it answers).
    const guestRow = { id: ID, userId: null, bookingType: 'guest', providerBookingId: 'bk_G2' };
    const accountRow = { id: ID, userId: 'u_alex', bookingType: 'account', providerBookingId: 'bk_G2' };
    for (const row of [guestRow, accountRow]) {
      const guestManage = guestManageFor(row);
      const isGuest = row.userId === null;
      assert.equal(guestManage !== undefined, isGuest, 'the block for a guest row only');
      const rendered = [
        lifecycleEmail({ kind: 'cancelled', ...common, ...facts, manageUrl: guestManage ? null : travel, guestManage }),
        lifecycleEmail({ kind: 'cancel_pending', ...common, lane: 'flight', manageUrl: guestManage ? null : travel, guestManage }),
      ];
      for (const r of rendered) {
        assert.equal(r.text.includes('Manage this booking without an account'), isGuest);
        assert.equal(r.text.includes('Manage reference: bk_G2'), isGuest);
        assert.equal(/Manage code: [0-9A-Z]{4}-[0-9A-Z]{4}/.test(r.text), isGuest);
        assert.equal(r.html.includes('data-guest-manage'), isGuest);
        assert.equal(r.text.includes('https://www.templestuart.com/booking/manage?ref=bk_G2'), isGuest);
        assert.equal(r.text.includes('See this booking'), !isGuest, '"See this booking" gives way to the block');
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
  const flow = code(FLOW);
  const sender = flow.slice(flow.indexOf('async function sendCancellationEmail('), flow.indexOf('function statusRefusal('));
  assert.ok(sender.includes('const guestManage = guestManageFor(owned);'));
  assert.ok(sender.includes('manageUrl: guestManage ? null : manageUrl(owned.id),'));
  assert.match(sender, /\n      guestManage,\n/);
  assert.ok(sender.includes('const recipient = cancelRecipient(owned, accountEmail);'), 'the recipient rule unchanged: a guest row’s stated guestEmail');
});

// ── G6. the gates and the page, read from source ─────────────────────────────

test('G6 R2 the account’s route is its gate: URL, auth chain and answers unchanged; the one select; the account’s caller; the flow awaited inside each try', () => {
  const src = code(ACCOUNT_ROUTE);
  assert.ok(src.includes('const userEmail = await getVerifiedEmail();'));
  assert.ok(src.includes("where: { email: { equals: userEmail, mode: 'insensitive' } },"));
  assert.ok(src.includes('select: { id: true, email: true },'));
  assert.match(src, /where: \{ id, userId: user\.id, provider: \{ in: \['liteapi', 'duffel'\] \} \},\s*select: CANCEL_ROW_SELECT,/);
  for (const [answer, status] of [["'Unauthorized'", 401], ["'User not found'", 404], ["'Reservation not found'", 404]] as const) assert.ok(src.includes(`NextResponse.json({ error: ${answer} }, { status: ${status} })`), answer);
  for (const [verb, entry, fail] of [['GET', 'quoteCancellation', "'Failed to quote the cancellation'"], ['POST', 'cancelReservation', "'Failed to cancel the reservation'"]] as const) {
    const body = functionBody(src, verb) ?? '';
    const gate = body.indexOf('const g = await gate(id);\n    if (!g.ok) return g.response;');
    const caller = body.indexOf('const caller: CancelCaller = { actor: humanActor({ id: g.userId, email: g.accountEmail }), accountEmail: g.accountEmail };');
    const call = body.indexOf(`return await ${entry}(g.owned, caller);`);
    assert.ok(body.indexOf('try {') < gate && gate < caller && caller < call && call < body.indexOf('} catch (error) {'), `${verb}: gate → caller → the flow, awaited, inside the try`);
    assert.ok(body.includes(`{ error: ${fail} }, { status: 500 }`), `${verb}: its named 500`);
  }
  assert.ok(!/prisma\.\$transaction|cancelBooking\(|cancelFlightBooking\(|recordBookingEvent/.test(src), 'no vendor call, landing or record of its own');
  assert.match(comments(ACCOUNT_ROUTE), /src\/app\/api\/guest\/booking\/cancel\/route\.ts/, 'the header names the guest’s gate');
});

test('G6 R5 the guest’s route: the IP as the lookup reads it, the gate before every flow call, the guest’s caller, never cached, the cookie never logged', () => {
  const src = code(GUEST_ROUTE);
  assert.ok(src.includes("const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;"));
  assert.doesNotMatch(src, /'unknown'/);
  assert.ok(src.includes('cookie: request.cookies.get(GUEST_COOKIE)?.value ?? null,'));
  assert.ok(src.includes('key: guestKey(),'));
  assert.ok(src.includes('now: Math.floor(Date.now() / 1000),'));
  assert.ok(src.includes("where: { id, bookingType: 'guest', userId: null, provider: { in: ['liteapi', 'duffel'] } },"));
  assert.ok(src.includes('await rateLimit(key, { limit, windowSeconds });'), 'the limiter, as the lookup’s');
  assert.ok(src.includes("headers: { ...NO_STORE, 'Retry-After': String(answer.retryAfterSeconds) }"), 'a 429 carries its wait');
  for (const [verb, entry] of [['GET', 'quoteCancellation'], ['POST', 'cancelReservation']] as const) {
    const body = functionBody(src, verb) ?? '';
    const gate = body.indexOf('const g = await guestGate(request);\n    if (!g.ok) return g.response;');
    const caller = body.indexOf('const caller: CancelCaller = { actor: humanActor(null, g.ip), accountEmail: null };');
    const call = body.indexOf(`return noStore(await ${entry}(g.row, caller));`);
    assert.ok(body.indexOf('try {') < gate && gate < caller && caller < call && call < body.indexOf('} catch (error) {'), `${verb}: gate → the guest’s caller → the flow, awaited, never cached`);
  }
  const answers = (src.match(/NextResponse\.json\(/g) ?? []).length;
  const noStore = (src.match(/headers: NO_STORE \}|headers: \{ \.\.\.NO_STORE, 'Retry-After'/g) ?? []).length;
  assert.equal(answers, noStore, 'every answer of its own is no-store');
  assert.ok(src.includes("res.headers.set('Cache-Control', 'no-store');"), 'and the flow’s through noStore');
  assert.deepEqual([...src.matchAll(/console\.\w+\(([^;]*)\);/g)].map((m) => m[1]), ["'[Guest cancel quote] request error:', error", "'[Guest cancel] request error:', error"]);
  assert.deepEqual([...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]), ['GET', 'POST']);
  assert.match(comments(GUEST_ROUTE).split('\n').slice(0, 8).join('\n'), /PUBLIC[\s\S]*why that\n\/\/ is safe to be/);
});

test('G6 R7 the page: Cancel only from the offer; the one dialog with the guest’s URL; the guest’s POST; the lines as ruled; no money word, no owner route, no storage', () => {
  const src = code(PAGE);
  assert.match(src, /\{view\.cancel && \(\s*<button type="button" onClick=\{\(\) => setCancelOpen\(true\)\}[^>]*data-guest-cancel>\s*Cancel booking\s*<\/button>/);
  assert.ok(src.indexOf('data-guest-print') < src.indexOf('data-guest-cancel>') && src.indexOf('data-guest-cancel>') < src.indexOf('data-guest-close'), 'beside Print and Close');
  assert.ok(src.includes('{cancelOpen && view.cancel && ('));
  assert.equal((src.match(/<CancelBookingDialog\b/g) ?? []).length, 1);
  for (const prop of ['quoteUrl="/api/guest/booking/cancel"', 'lane={view.cancel.lane}', 'bookingName={view.receipt.header.name}', 'checkIn={view.cancel.checkIn}', 'checkOut={view.cancel.checkOut}', 'policy={view.cancel.policy}', 'onConfirm={doCancel}']) assert.ok(src.includes(prop), prop);
  const cancel = src.slice(src.indexOf('const doCancel = async () => {'), src.indexOf('return (\n    <main'));
  assert.equal((cancel.match(/fetch\('\/api\/guest\/booking\/cancel', \{ method: 'POST' \}\)/g) ?? []).length, 1);
  assert.ok(cancel.indexOf('setCancelOpen(false);') < cancel.indexOf('if (!res.ok) {'), 'the dialog closes when the route answers');
  assert.ok(cancel.includes("setFailure(typeof data.error === 'string' ? data.error : `the cancel answered ${res.status}`);"), 'the answer’s error, verbatim, on the failure line');
  assert.ok(cancel.indexOf('const read = await readBooking();') < cancel.indexOf('setCancelOutcome(`${what} ${told}`);'), 'read again, then the one line');
  for (const line of ['Your booking is cancelled.', 'Your cancellation request is with the airline — the booking stays confirmed until it answers.', 'We emailed the confirmation to the address on this booking.', 'No confirmation email was sent — print or save this page as your record.']) assert.ok(cancel.includes(`'${line}'`), line);
  assert.ok(cancel.includes("status === 'cancelled'") && cancel.includes("status === 'cancel_pending'") && cancel.includes('data.email?.sent === true'));
  assert.doesNotMatch(src, /\/api\/reservations|localStorage|sessionStorage|console\.|router\.|location\.href\s*=/);
  for (const word of ['not stated', 'stated by the vendor', 'recorded by your bank', 'not posted', 'not yet matched', 'no refund', 'USD', 'cents', 'commission', 'settlement']) {
    assert.ok(!new RegExp(`['"\`][^'"\`\\n]*${word}[^'"\`\\n]*['"\`]`, 'i').test(src), `the page types "${word}"`);
  }
});

test('G6 R8 the dialog reads its quote from its caller’s quoteUrl — required, no default; the lists pass the account’s', () => {
  const src = code(DIALOG);
  assert.match(src, /\n  quoteUrl: string;\n/);
  assert.ok(!/quoteUrl\?:|quoteUrl = /.test(src), 'no default');
  assert.ok(src.includes('const res = await fetch(quoteUrl);'));
  assert.ok(!/\/api\/reservations\/|\/api\/guest\//.test(src), 'no route of its own');
  for (const f of LISTS) assert.ok(code(f).includes('quoteUrl={`/api/reservations/${cancelTarget.id}/cancel`}'), f);
});

// ── G7. GUEST-02b (2026-09-30): what only the pin held ───────────────────────

/** Every call of `name(` in the code (a definition is not a call), with its arguments trimmed. */
function callsOf(src: string, name: string): Array<{ at: number; args: string[] }> {
  return [...src.matchAll(new RegExp(`\\b${name}\\(`, 'g'))]
    .filter((m) => !/function\s+$/.test(src.slice(Math.max(0, m.index! - 24), m.index!)))
    .map((m) => {
      const open = src.indexOf('(', m.index!);
      const close = closingOf(src, open);
      return { at: m.index!, args: close < 0 ? [] : splitArgs(src.slice(open + 1, close)).map((a) => a.trim()) };
    });
}
const laneOf = (src: string, lane: 'hotel' | 'flight') => lane === 'hotel'
  ? src.slice(src.indexOf('async function cancelHotel('), src.indexOf('async function cancelFlight('))
  : src.slice(src.indexOf('async function cancelFlight('));

test('G7 (a) no cancel answer names commission — not the flow’s, not either gate’s (Temple Stuart’s books, never the customer’s)', () => {
  let answers = 0;
  for (const f of [FLOW, ACCOUNT_ROUTE, GUEST_ROUTE]) {
    for (const call of callsOf(code(f), 'NextResponse\\.json')) {
      answers += 1;
      assert.doesNotMatch(call.args[0] ?? '', /commission/i, `${f}: ${(call.args[0] ?? '').slice(0, 80)}`);
    }
  }
  assert.ok(answers > 10, `every answer was read (${answers})`);
  for (const lane of ['hotel', 'flight'] as const) {
    const success = callsOf(laneOf(code(FLOW), lane), 'NextResponse\\.json').at(-1)!;
    assert.match(success.args[0], /moneyEvents: [^\n]*\.length,\s*calendar,/, `${lane}: the success answer keeps its other fields, commissionMoved gone`);
  }
});

test('G7 the commission count reaches the server log after the transaction, never an answer — every hotel cancel; a flight’s when final', () => {
  const flow = code(FLOW);
  for (const lane of ['hotel', 'flight'] as const) {
    const text = laneOf(flow, lane);
    const committed = text.indexOf('commissionMoved } = landed.reservation;');
    const logged = text.indexOf('commission rows moved ${commissionMoved}`);');
    const why = text.indexOf("if (commissionMoved === 0) console.log(`[Reservation cancel] reservation ${owned.id}: no 'estimated' commission row to move — a commission already locked ('confirmed') is left as is (COMM-01)`);");
    assert.ok(committed > 0 && logged > committed && why > logged, `${lane}: the count logged after the transaction, and a none-moved line saying why by name`);
    assert.match(text.slice(logged - 120, logged), /console\.log\(`\[Reservation cancel\] reservation \$\{owned\.id\}: /, `${lane}: to the server log, with the reservation id`);
  }
  assert.match(laneOf(flow, 'flight'), /if \(decision\.commission === 'cancel'\) \{\s*console\.log\(`\[Reservation cancel\] reservation \$\{owned\.id\}: final flight cancel committed — commission rows moved \$\{commissionMoved\}`\);/, 'a flight logs it when final — a 202 moves none');
  const reads = flow.split('\n').filter((l) => /\bcommissionMoved\b/.test(l));
  assert.equal(reads.length, 8, 'the two returns from the transaction, the two destructures, and the two log lines with their two none-moved guards');
  for (const l of reads) assert.match(l, /commissionMoved: commission\.count|commissionMoved \} = landed\.reservation|console\.log\(/, l.trim());
  // The apply leaf keeps its own count, as it did — logged, never shown (its caller is no customer).
  assert.ok(code('src/lib/reservations/applyVendorState.ts').includes('commission rows moved ${commissionMoved}'));
});

test('G7 (b) both lanes land their cancellation with the row’s owner — userId: owned.userId, never null', () => {
  const landings = callsOf(code(FLOW), 'landLiteApiCancellation');
  assert.equal(landings.length, 2, 'the hotel lane and the flight lane');
  for (const l of landings) {
    assert.match(l.args[1], /(^|[{,\s])userId: owned\.userId,/);
    assert.doesNotMatch(l.args[1], /\buserId:\s*null\b/);
  }
});

test('G7 (c) both lanes email the caller’s address — an account holder’s hotel and flight cancel alike', () => {
  for (const lane of ['hotel', 'flight'] as const) {
    const sends = callsOf(laneOf(code(FLOW), lane), 'sendCancellationEmail');
    assert.equal(sends.length, 1, lane);
    assert.deepEqual(sends[0].args.slice(0, 2), ['owned', 'caller.accountEmail'], lane);
  }
});

test('G7 (d) the page reads the booking again after a successful cancel, before it writes its line', () => {
  const page = code(PAGE);
  const doCancel = page.slice(page.indexOf('const doCancel = async () => {'), page.indexOf('return (\n    <main'));
  const refused = doCancel.indexOf('if (!res.ok) {');
  const reread = doCancel.indexOf('const read = await readBooking();');
  const shown = doCancel.indexOf("setView({ state: 'open', receipt: read.receipt, cancel: read.cancel });");
  const line = doCancel.indexOf('setCancelOutcome(`${what} ${told}`);');
  assert.ok(refused > 0 && reread > refused && shown > reread && line > shown, `refused ${refused} → re-read ${reread} → shown ${shown} → line ${line}`);
});
