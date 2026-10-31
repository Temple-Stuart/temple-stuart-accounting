/**
 * GUEST-01 (2026-09-29) — a guest manages a booking: the Manage reference and the Manage
 * code from the guest's own booking email open that ONE booking on /booking/manage — the
 * vendor's side, read-only.
 *
 * One test group per proof the ruling names:
 *   T1 the leaf — the code, its parse, the constant-time compare, the session, and the
 *      one key it is all made under (re-derived here independently, not read back);
 *   T2 the lookup's decision over fake ports — every branch, in order, and what it
 *      never touches;
 *   T3 the booking — the session first, that reservation alone, and the routes read
 *      from source the way this repo proves what it cannot run without a database;
 *   T4 the three templates and the sender's one decision — a guest row's block, none
 *      for an account;
 *   T5 the guest projection — the receipt's own vendor side, no settlement, no bank;
 *   T6 both pages mounting the one renderer, rendered; the one lookup box — the door —
 *      on the home page and on /booking/manage (Alex's ruling 17:04), rendered.
 * No live call, no database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, functionBody } from '../sourceText';
import {
  GUEST_COOKIE, GUEST_COOKIE_PATH, GUEST_SESSION_SECONDS, MANAGE_CODE_ALPHABET, REFERENCE_SHAPE,
  codesMatch, displayManageCode, manageCode, parseManageCode, signGuestSession, verifyGuestSession,
} from '../guest/guestAccess';
import {
  DUMMY_RESERVATION_ID, GUEST_LIMITS, GUEST_WORDS, guestBooking, openGuestSession,
  type GuestBookingPorts, type GuestLookupPorts, type GuestReservationRow,
} from '../guest/guestSession';
import { GUEST_NOTES, RECEIPT_NOTES, guestReceiptOf, receiptOf, type GuestMoneyEvent, type ReceiptArrival, type ReceiptReservation } from '../receipts/bookingReceipt';
import { bookingConfirmation } from '../emailTemplates/bookingConfirmation';
import { flightConfirmation } from '../emailTemplates/flightConfirmation';
import { lifecycleEmail } from '../emailTemplates/lifecycle';

// The one renderer is JSX compiled for the automatic runtime's absence here: React goes on
// the global before the component module loads (the trips01 test's convention).
Object.assign(globalThis, { React });

const LEAF = 'src/lib/guest/guestAccess.ts';
const DECISION = 'src/lib/guest/guestSession.ts';
const KEY_FILE = 'src/lib/cookie-auth.ts';
const OPEN = 'src/app/api/guest/session/route.ts';
const END = 'src/app/api/guest/session/end/route.ts';
const BOOKING = 'src/app/api/guest/booking/route.ts';
const PAGE = 'src/app/booking/manage/page.tsx';
const OWNER_PAGE = 'src/app/booking/[id]/receipt/page.tsx';
const RENDERER = 'src/components/receipts/ReceiptBody.tsx';
const SENDER = 'src/lib/reservations/lifecycleSend.ts';
const RECEIPT_LEAF = 'src/lib/receipts/bookingReceipt.ts';
const MIDDLEWARE = 'src/middleware.ts';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const BOOK_ROUTES = ['src/app/api/travel/liteapi/book/route.ts', 'src/app/api/travel/liteapi/flights/book/route.ts'];

const KEY = createHmac('sha256', 'guest01-test').update('probe').digest();
const OTHER_KEY = createHmac('sha256', 'guest01-test').update('other').digest();
const ID_A = '4f6c2d1a-9b3e-4c7d-8a2f-1e5b6c7d8e9f';
const ID_B = '0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9';

/** The ruling's derivation, re-done independently: the first 40 bits, 5 at a time. */
function derivedCode(key: Buffer, id: string): string {
  const digest = createHmac('sha256', key).update(`code:${id}`).digest();
  const bits = Array.from(digest.subarray(0, 5), (b) => b.toString(2).padStart(8, '0')).join('');
  return (bits.match(/.{5}/g) ?? []).map((chunk) => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[parseInt(chunk, 2)]).join('');
}

// ── fixtures shaped by the documented answers (the receipt01 fixtures' fields) ──

const HOTEL_RES: ReceiptReservation = { id: 'res_h', lane: 'hotel', displayName: 'Sample Hotel', providerBookingId: 'ABC123', providerConfirmationCode: 'HOTEL123', status: 'confirmed', createdAt: '2026-09-20T10:00:00.000Z', checkinDate: '2025-01-01', checkoutDate: '2025-01-02' };
const FLIGHT_RES: ReceiptReservation = { id: 'res_f', lane: 'flight', displayName: 'JetBlue Airways JFK → LAX', providerBookingId: '1297abe4', providerConfirmationCode: null, status: 'confirmed', createdAt: '2026-02-09T14:20:32.416Z', checkinDate: null, checkoutDate: null };
/** The documented example of POST /rates/book, data.*. */
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
const FLIGHT_BOOK: ReceiptArrival = {
  id: 'arr_book_f', arrived: '2026-02-09T14:20:33.000Z',
  payload: {
    bookingId: '1297abe4', status: 'CONFIRMED',
    journey: { segments: [{ arrivalTime: '2026-04-10T18:40:00', carrier: { marketingCode: 'B6', marketingName: 'JetBlue Airways' }, departureTime: '2026-04-10T15:30:00', destinationCode: 'LAX', flight: { marketingNumber: '723' }, originCode: 'JFK' }], price: { base: 238.32, currency: 'USD', taxes: 48.7, total: 287.02 } },
    pricing: { totalAmount: 287.02, currency: 'USD' },
    passengers: [{ firstName: 'TEST', lastName: 'COLUMNS', type: 'ADT' }],
  },
};
const STATED_REFUND: GuestMoneyEvent = { id: 'me_r1', kind: 'refund', amountCents: 25000, currency: 'USD', statedAt: '2026-09-22T10:00:00.000Z' };
const UNSTATED_FEE: GuestMoneyEvent = { id: 'me_fee', kind: 'cancellation_fee', amountCents: null, currency: null, statedAt: '2026-09-22T10:00:00.000Z' };

/** sha256 of receiptOf's comment-stripped body on main 37909b85 — GUEST-01 leaves it untouched. */
const RECEIPT_OF_AT_MAIN = 'c98014dd1df09fdf35a0fec28967a5a9057960266931607869161722f6023e66';

// ── T1. the leaf ─────────────────────────────────────────────────────────────

test('T1 the code: HMAC-SHA256(key, code:<id>), its first 40 bits as 8 characters of the ruled alphabet — the same for the same id and key, another for another', () => {
  assert.equal(MANAGE_CODE_ALPHABET, '0123456789ABCDEFGHJKMNPQRSTVWXYZ');
  assert.equal(MANAGE_CODE_ALPHABET.length, 32);
  for (const letter of ['I', 'L', 'O', 'U']) assert.ok(!MANAGE_CODE_ALPHABET.includes(letter), `${letter} is not in the alphabet`);
  for (const id of [ID_A, ID_B, DUMMY_RESERVATION_ID]) {
    const c = manageCode(KEY, id);
    assert.equal(c, derivedCode(KEY, id), 'the code is the derivation the ruling names');
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal(manageCode(KEY, id), c, 'the same id and key give the same code');
  }
  assert.notEqual(manageCode(KEY, ID_A), manageCode(KEY, ID_B));
  assert.notEqual(manageCode(KEY, ID_A), manageCode(OTHER_KEY, ID_A), 'the code is the key’s');
  assert.equal(displayManageCode('ABCD2345'), 'ABCD-2345');
});

test('T1 parse: uppercase, spaces and hyphens gone, exactly 8 alphabet characters — no letter is read as another', () => {
  assert.equal(parseManageCode('abcd-2345'), 'ABCD2345');
  assert.equal(parseManageCode('  ab cd - 23 45 '), 'ABCD2345');
  const c = manageCode(KEY, ID_A);
  assert.equal(parseManageCode(displayManageCode(c)), c);
  assert.equal(parseManageCode(displayManageCode(c).toLowerCase()), c);
  for (const bad of ['ABCD234O', 'ABCD234I', 'ABCD234L', 'ABCD234U', 'abcd234o', 'ABCD234', 'ABCD23456', 'ABCD_2345', 'ABCD.2345', '', '--------']) {
    assert.equal(parseManageCode(bad), null, `${JSON.stringify(bad)} is not a code`);
  }
  for (const notText of [null, undefined, 12345678, { code: 'ABCD2345' }, ['ABCD2345']]) assert.equal(parseManageCode(notText), null);
});

test('T1 codesMatch compares in constant time and answers only an exact match', () => {
  assert.equal(codesMatch('ABCD2345', 'ABCD2345'), true);
  assert.equal(codesMatch('ABCD2345', 'ABCD2346'), false);
  assert.equal(codesMatch('ABCD2345', 'ABCD234'), false);
  assert.equal(codesMatch('', ''), true);
  assert.match(code(LEAF), /timingSafeEqual\(x, y\)/);
});

test('T1 the session: v1.<id>.<expiresAt>.<base64url HMAC-SHA256(key, session:v1:<id>:<expiresAt>)> — the id while fresh; null expired, tampered, re-versioned, malformed or under another key', () => {
  const now = 1_900_000_000;
  const exp = now + GUEST_SESSION_SECONDS;
  const value = signGuestSession(KEY, ID_A, exp);
  const sig = createHmac('sha256', KEY).update(`session:v1:${ID_A}:${exp}`).digest('base64url');
  assert.equal(value, `v1.${ID_A}.${exp}.${sig}`);
  assert.equal(verifyGuestSession(KEY, value, now), ID_A);
  assert.equal(verifyGuestSession(KEY, value, exp - 1), ID_A);
  assert.equal(verifyGuestSession(KEY, value, exp), null, 'expired at its instant');
  assert.equal(verifyGuestSession(OTHER_KEY, value, now), null);
  const flip = (s: string) => s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A');
  for (const tampered of [
    `v2.${ID_A}.${exp}.${sig}`, `V1.${ID_A}.${exp}.${sig}`, `v1.${ID_B}.${exp}.${sig}`, `v1.${ID_A}.${exp + 3600}.${sig}`,
    `v1.${ID_A}.${exp}.${flip(sig)}`, `v1.not-a-uuid.${exp}.${sig}`, `v1.${ID_A}.-5.${sig}`, `v1.${ID_A}.${exp}.${sig}.x`, `v1.${ID_A}.${exp}`, '', 'v1...',
  ]) assert.equal(verifyGuestSession(KEY, tampered, now), null, tampered.slice(0, 48));
  for (const notText of [null, undefined, 42, {}]) assert.equal(verifyGuestSession(KEY, notText, now), null);
});

test('T1 the leaf is pure — crypto its only import; no env, no clock, no fetch, no prisma', () => {
  const src = code(LEAF);
  assert.deepEqual(src.split('\n').filter((l) => /^\s*import\b/.test(l)).map((l) => l.trim()), ["import { createHmac, timingSafeEqual } from 'crypto';"]);
  assert.doesNotMatch(src, /process\.env|Date\.now|new Date\(|\bfetch\(|prisma/);
  assert.equal(GUEST_COOKIE, 'guestBooking');
  assert.equal(GUEST_COOKIE_PATH, '/api/guest');
  assert.equal(GUEST_SESSION_SECONDS, 3600);
  assert.ok(REFERENCE_SHAPE.test('ABC123_x-9') && !REFERENCE_SHAPE.test('') && !REFERENCE_SHAPE.test('a'.repeat(121)) && !REFERENCE_SHAPE.test('bad ref'));
});

test('T1 the one key: guestKey() = HMAC-SHA256(JWT_SECRET, ts-guest:v1) — a userEmail cookie never verifies as a session, and a session never passes verifyCookie', async () => {
  process.env.JWT_SECRET = 'guest01-test-secret';
  const { guestKey, signCookie, verifyCookie } = await import('../cookie-auth');
  const key = guestKey();
  assert.deepEqual(key, createHmac('sha256', 'guest01-test-secret').update('ts-guest:v1').digest());
  assert.notDeepEqual(key, Buffer.from('guest01-test-secret'));
  const session = signGuestSession(key, ID_A, 1_900_003_600);
  assert.equal(verifyCookie(session), null, 'a guest session is not a userEmail cookie');
  assert.equal(verifyGuestSession(key, signCookie('guest@example.com'), 1_900_000_000), null, 'a userEmail cookie is not a guest session');
  assert.match(code(KEY_FILE), /export function guestKey\(\): Buffer \{\n {2}return crypto\.createHmac\('sha256', getSecret\(\)\)\.update\('ts-guest:v1'\)\.digest\(\);\n\}/);
  assert.match(comments(KEY_FILE), /GUEST-01 \(2026-09-29\)/);
});

// ── T2. the lookup's decision ────────────────────────────────────────────────

function lookup(opts: { rows?: Array<{ id: string }>; overIp?: number; overReference?: number } = {}) {
  const calls: string[] = [];
  const ports: GuestLookupPorts = {
    limit: async (key, limit, windowSeconds) => {
      calls.push(`limit ${key} ${limit}/${windowSeconds}`);
      if (key.startsWith('guest-ip:') && opts.overIp !== undefined) return { ok: false, retryAfterSeconds: opts.overIp };
      if (key.startsWith('guest-ref:') && opts.overReference !== undefined) return { ok: false, retryAfterSeconds: opts.overReference };
      return { ok: true };
    },
    guestRowsByReference: async (reference) => { calls.push(`read ${reference}`); return opts.rows ?? []; },
  };
  return { ports, calls };
}
const NOT_OPENED = { status: 404, error: "We couldn't open a booking with that reference and code." };

test('T2 no IP is the one failure — before the shapes, before any limit or read', async () => {
  for (const ip of [null, '']) {
    const { ports, calls } = lookup({ rows: [{ id: ID_A }] });
    assert.deepEqual(await openGuestSession(ports, { ip, body: { reference: 'bk_1', code: manageCode(KEY, ID_A) }, key: KEY }), NOT_OPENED);
    assert.deepEqual(calls, []);
  }
});

test('T2 a wrong shape is 400 by one line — nothing counted, nothing read', async () => {
  const good = manageCode(KEY, ID_A);
  for (const body of [null, 'bk_1', {}, { reference: 'bk_1' }, { code: good }, { reference: '', code: good }, { reference: 'a'.repeat(121), code: good }, { reference: 'bk 1', code: good }, { reference: 'bk_1', code: 'ABCD234O' }, { reference: 'bk_1', code: 'ABC' }, { reference: 42, code: good }]) {
    const { ports, calls } = lookup({ rows: [{ id: ID_A }] });
    assert.deepEqual(await openGuestSession(ports, { ip: '203.0.113.9', body, key: KEY }), { status: 400, error: 'Enter the reference and code from your email.' }, JSON.stringify(body));
    assert.deepEqual(calls, []);
  }
});

test('T2 the IP limit, then the reference limit, both before any read — over either is 429 with its wait', async () => {
  const body = { reference: 'bk_1', code: manageCode(KEY, ID_A) };
  const ipOver = lookup({ rows: [{ id: ID_A }], overIp: 600 });
  assert.deepEqual(await openGuestSession(ipOver.ports, { ip: '203.0.113.9', body, key: KEY }), { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: 600 });
  assert.deepEqual(ipOver.calls, ['limit guest-ip:203.0.113.9 10/900'], 'over the IP limit: the reference is not counted and nothing is read');
  const refOver = lookup({ rows: [{ id: ID_A }], overReference: 300 });
  assert.deepEqual(await openGuestSession(refOver.ports, { ip: '203.0.113.9', body, key: KEY }), { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: 300 });
  assert.deepEqual(refOver.calls, ['limit guest-ip:203.0.113.9 10/900', 'limit guest-ref:bk_1 5/900'], 'over the reference limit: nothing is read');
  assert.deepEqual(GUEST_LIMITS, { ip: { limit: 10, windowSeconds: 900 }, reference: { limit: 5, windowSeconds: 900 } });
});

test('T2 exactly one match opens that reservation — the typed code read as the email shows it', async () => {
  const { ports, calls } = lookup({ rows: [{ id: ID_B }, { id: ID_A }] });
  const typed = ` ${displayManageCode(manageCode(KEY, ID_A)).toLowerCase()} `;
  assert.deepEqual(await openGuestSession(ports, { ip: '203.0.113.9', body: { reference: 'bk_1', code: typed }, key: KEY }), { status: 200, reservationId: ID_A });
  assert.deepEqual(calls, ['limit guest-ip:203.0.113.9 10/900', 'limit guest-ref:bk_1 5/900', 'read bk_1']);
});

test('T2 every other outcome is the same 404 and the same line — unknown reference, wrong code, an account row (the port reads guests only), two matches', async () => {
  const ip = '203.0.113.9';
  const answers = [
    await openGuestSession(lookup({ rows: [] }).ports, { ip, body: { reference: 'bk_unknown', code: manageCode(KEY, ID_A) }, key: KEY }),
    await openGuestSession(lookup({ rows: [{ id: ID_A }] }).ports, { ip, body: { reference: 'bk_1', code: manageCode(KEY, ID_B) }, key: KEY }),
    await openGuestSession(lookup({ rows: [] }).ports, { ip, body: { reference: 'bk_account', code: manageCode(KEY, ID_A) }, key: KEY }),
    await openGuestSession(lookup({ rows: [{ id: ID_A }, { id: ID_A }] }).ports, { ip, body: { reference: 'bk_1', code: manageCode(KEY, ID_A) }, key: KEY }),
    await openGuestSession(lookup({ rows: [{ id: ID_A }] }).ports, { ip, body: { reference: 'bk_1', code: manageCode(OTHER_KEY, ID_A) }, key: KEY }),
  ];
  for (const a of answers) assert.deepEqual(a, NOT_OPENED);
  // Every row is compared with no early exit, and one dummy compare runs when no row came back.
  const open = functionBody(code(DECISION), 'openGuestSession') ?? '';
  assert.match(open, /for \(const row of rows\) \{\s*if \(codesMatch\(manageCode\(input\.key, row\.id\), code\)\) matched\.push\(row\.id\);\s*\}/);
  assert.ok(open.includes('if (rows.length === 0) codesMatch(manageCode(input.key, DUMMY_RESERVATION_ID), code);'));
  assert.doesNotMatch(open, /\bbreak\b|console\.|redirect/);
});

test('T2 the lookup route: the IP as signup reads it with no unknown bucket; the guest rows, ids only; the one cookie with its flags; a 429 with Retry-After; the comment saying why it is safe to be public', () => {
  const src = code(OPEN);
  assert.ok(src.includes("const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;"));
  assert.doesNotMatch(src, /'unknown'/);
  assert.ok(src.includes("prisma.reservations.findMany({ where: { providerBookingId: reference, bookingType: 'guest', userId: null }, select: { id: true } })"));
  assert.ok(src.includes("headers: { 'Retry-After': String(answer.retryAfterSeconds) }"));
  assert.ok(src.includes("res.cookies.set(GUEST_COOKIE, signGuestSession(key, answer.reservationId, expiresAt), {\n      httpOnly: true,\n      secure: true,\n      sameSite: 'strict',\n      path: GUEST_COOKIE_PATH,\n      maxAge: GUEST_SESSION_SECONDS,\n    });"));
  assert.ok(src.includes('const res = NextResponse.json({ ok: true });'));
  assert.doesNotMatch(src, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|console\.|redirect\(|sendTransactionalEmail|liteapi/);
  assert.match(comments(OPEN).split('\n').slice(0, 4).join('\n'), /PUBLIC, and why that is safe to be/);
  const end = code(END);
  assert.ok(end.includes("res.cookies.set(GUEST_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: GUEST_COOKIE_PATH, maxAge: 0 });"));
  assert.doesNotMatch(end, /prisma|fetch\(|DELETE|PATCH|PUT/);
});

// ── T3. the booking ──────────────────────────────────────────────────────────

// GUEST-02 (2026-09-30): the row also carries the two reads the cancel offer makes.
const GUEST_ROW: GuestReservationRow = { id: ID_A, lane: 'hotel', displayName: 'Sample Hotel', providerBookingId: 'ABC123', providerConfirmationCode: 'HOTEL123', status: 'confirmed', createdAt: '2026-09-20T10:00:00.000Z', checkinDate: '2025-01-01', checkoutDate: '2025-01-02', arrival_id: 'arr_book_h', provider: 'liteapi', cancellationPolicyJson: null };

function booking(row: GuestReservationRow | null) {
  const calls: string[] = [];
  const ports: GuestBookingPorts = {
    reservation: async (id) => { calls.push(`reservation ${id}`); return row; },
    bookArrival: async (arrivalId, ref) => { calls.push(`book ${arrivalId} ${ref}`); return HOTEL_BOOK; },
    latestRead: async (ref) => { calls.push(`read ${ref}`); return null; },
    moneyEvents: async (id) => { calls.push(`money ${id}`); return [STATED_REFUND]; },
  };
  return { ports, calls };
}

test('T3 the session first: none, tampered or expired is 401 before any read', async () => {
  const now = 1_900_000_000;
  for (const cookie of [null, '', 'v1.garbage', signGuestSession(OTHER_KEY, ID_A, now + 60), signGuestSession(KEY, ID_A, now)]) {
    const { ports, calls } = booking(GUEST_ROW);
    assert.deepEqual(await guestBooking(ports, { cookie, key: KEY, now }), { status: 401, error: 'Your booking session has ended. Enter your reference and code again.' });
    assert.deepEqual(calls, []);
  }
});

test('T3 a reservation that is no longer a guest’s (or is gone) is the lookup’s 404 — nothing else read', async () => {
  const now = 1_900_000_000;
  const { ports, calls } = booking(null);
  assert.deepEqual(await guestBooking(ports, { cookie: signGuestSession(KEY, ID_A, now + 60), key: KEY, now }), NOT_OPENED);
  assert.deepEqual(calls, [`reservation ${ID_A}`]);
});

test('T3 an open session reads that ONE reservation, its landed answers and its stated money, and answers the guest projection', async () => {
  const now = 1_900_000_000;
  const { ports, calls } = booking(GUEST_ROW);
  const answer = await guestBooking(ports, { cookie: signGuestSession(KEY, ID_A, now + 60), key: KEY, now });
  assert.equal(answer.status, 200);
  assert.deepEqual(calls, [`reservation ${ID_A}`, 'book arr_book_h ABC123', 'read ABC123', `money ${ID_A}`]);
  if (answer.status !== 200) return;
  assert.deepEqual(answer.receipt, guestReceiptOf({ reservation: GUEST_ROW, bookArrival: HOTEL_BOOK, latestReadArrival: null, moneyEvents: [STATED_REFUND] }));
  // No landed book answer → none is read.
  const noArrival = booking({ ...GUEST_ROW, arrival_id: null });
  await guestBooking(noArrival.ports, { cookie: signGuestSession(KEY, ID_A, now + 60), key: KEY, now });
  assert.deepEqual(noArrival.calls, [`reservation ${ID_A}`, 'read ABC123', `money ${ID_A}`]);
});

test('T3 the booking route: GET only; every read fenced to the guest and the session’s reservation; no settlement column; never cached; no write', () => {
  const src = code(BOOKING);
  assert.ok(src.includes('export async function GET(request: NextRequest)'));
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)/);
  assert.ok(src.includes("where: { id, bookingType: 'guest', userId: null },"));
  assert.ok(src.includes('where: { id: arrivalId, user_id: null, guest_ref: bookingGuestRef(providerBookingId) },'));
  assert.ok(src.includes('where: { provider: LITEAPI, resource: BOOKING_READ, their_id: bookingReadTheirId(providerBookingId), user_id: null, guest_ref: bookingGuestRef(providerBookingId) },'));
  assert.ok(src.includes('select: { id: true, kind: true, amountCents: true, currency: true, statedAt: true },'));
  assert.ok(src.includes('cookie: request.cookies.get(GUEST_COOKIE)?.value ?? null,'));
  assert.ok(src.includes('key: guestKey(),'));
  assert.ok(src.includes("const NO_STORE = { 'Cache-Control': 'no-store' };"));
  // GUEST-02 (2026-09-30): beside the receipt, unchanged, the cancel offer.
  assert.ok(src.includes('return NextResponse.json({ receipt: answer.receipt, cancel: answer.cancel }, { headers: NO_STORE });'));
  assert.ok(src.includes('status: answer.status, headers: NO_STORE'));
  assert.doesNotMatch(src, /settle|transaction|journal|ledger|commission|timeline|\.(create|update|upsert|delete)\w*\s*\(/i);
});

test('T3 the public surface: exactly the page and the two guest routes in PUBLIC_PATHS, each with its reason; no header link (the door is the home page’s lookup)', () => {
  const mw = code(MIDDLEWARE);
  const list = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(mw)?.[1] ?? '';
  const paths = Array.from(list.matchAll(/'([^']+)'/g), (m) => m[1]);
  assert.deepEqual(paths.filter((p) => p.startsWith('/api/guest') || p === '/booking/manage').sort(), ['/api/guest/booking', '/api/guest/session', '/booking/manage']);
  assert.equal((comments(MIDDLEWARE).match(/GUEST-01/g) ?? []).length, 3, 'three entries, three reasons');
  assert.doesNotMatch(code(HEADER), /booking\/manage/, 'Alex’s ruling 17:04: no header link');
});

// ── T4. the templates and the sender ─────────────────────────────────────────

const GM = { reference: 'bk_G1', code: 'ABCD2345', url: 'https://www.templestuart.com/booking/manage?ref=bk_G1' };
const BLOCK = ['Manage this booking without an account', 'Manage reference: bk_G1', 'Manage code: ABCD-2345', 'https://www.templestuart.com/booking/manage?ref=bk_G1', 'Keep this code private — with the reference, it opens this booking.'];
const HOTEL_EMAIL = { guestName: 'Ada Guest', hotelName: 'Hotel Temple', checkinDate: '2026-10-01', checkoutDate: '2026-10-02', confirmationCode: null, bookingId: 'bk_G1', totalAmountCents: 18000, currency: 'USD' };
const FLIGHT_EMAIL = { passengerName: 'ADA GUEST', passengerCount: 1, bookingId: 'bk_G1', bookingRef: null, pnr: null, totalAmountCents: 28702, currency: 'USD', status: 'CONFIRMED' };
const LIFE = { kind: 'cancel_pending' as const, name: 'Flight booking bk_G1', lane: 'flight' as const, reference: 'bk_G1', checkinDate: null, checkoutDate: null };

test('T4 the three templates: a guest gets the five-line block (the url as a link); an account gets none; a null url omits the link line; the code is never in the url', () => {
  const renders = [
    ['hotel', bookingConfirmation({ ...HOTEL_EMAIL, guestManage: GM }), bookingConfirmation(HOTEL_EMAIL), bookingConfirmation({ ...HOTEL_EMAIL, guestManage: { ...GM, url: null } })],
    ['flight', flightConfirmation({ ...FLIGHT_EMAIL, guestManage: GM }), flightConfirmation(FLIGHT_EMAIL), flightConfirmation({ ...FLIGHT_EMAIL, guestManage: { ...GM, url: null } })],
    ['lifecycle', lifecycleEmail({ ...LIFE, manageUrl: null, guestManage: GM }), lifecycleEmail({ ...LIFE, manageUrl: 'https://www.templestuart.com/travel' }), lifecycleEmail({ ...LIFE, manageUrl: null, guestManage: { ...GM, url: null } })],
  ] as const;
  for (const [what, guest, account, noUrl] of renders) {
    assert.ok(guest.text.includes(BLOCK.join('\n')), `${what}: the five lines, in order`);
    assert.ok(guest.html.includes('data-guest-manage'), what);
    assert.ok(guest.html.includes('<a href="https://www.templestuart.com/booking/manage?ref=bk_G1">https://www.templestuart.com/booking/manage?ref=bk_G1</a>'), `${what}: the url as a link`);
    assert.ok(guest.html.includes('Manage code: <strong>ABCD-2345</strong>'), what);
    assert.doesNotMatch(account.text + account.html, /Manage code|Manage reference|data-guest-manage|booking\/manage/, `${what}: an account gets no block`);
    assert.ok(noUrl.text.includes([BLOCK[0], BLOCK[1], BLOCK[2], BLOCK[4]].join('\n')), `${what}: no url → the block without its link line`);
    assert.doesNotMatch(noUrl.text + noUrl.html, /booking\/manage/);
    for (const line of guest.text.split('\n').filter((l) => l.includes('http'))) assert.doesNotMatch(line, /ABCD-?2345|code=/, `${what}: the code is never in a url`);
    assert.doesNotMatch(guest.html, /href="[^"]*ABCD/, what);
  }
  // Lifecycle: "See this booking" is the account's; the guest's block holds the link instead.
  assert.ok(renders[2][2].text.includes('See this booking: https://www.templestuart.com/travel'));
  assert.ok(!renders[2][1].text.includes('See this booking'));
});

test('T4 the sender: guestManageFor is the one decision — a guest row (bookingType guest, userId null) gets its reference, its code under guestKey() and the manage link; an account row none', async () => {
  process.env.JWT_SECRET = 'guest01-test-secret';
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  const { guestKey } = await import('../cookie-auth');
  const { guestManageFor, guestManageUrl } = await import('../reservations/lifecycleSend');
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.templestuart.com/';
    const guestRow = { id: ID_A, userId: null, bookingType: 'guest', providerBookingId: 'bk G1/&' };
    assert.deepEqual(guestManageFor(guestRow), { reference: 'bk G1/&', code: manageCode(guestKey(), ID_A), url: 'https://www.templestuart.com/booking/manage?ref=bk%20G1%2F%26' });
    assert.equal(guestManageFor({ ...guestRow, userId: 'u1' }), undefined, 'an account’s row');
    assert.equal(guestManageFor({ ...guestRow, bookingType: 'user' }), undefined, 'not a guest booking');
    assert.equal(guestManageFor({ ...guestRow, bookingType: 'user', userId: 'u1' }), undefined);
    delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(guestManageUrl('bk_G1'), null, 'no origin → no link line (said in the log, by reference)');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
  const sender = code(SENDER);
  assert.ok(sender.includes('const guestManage = guestManageFor(row);'));
  assert.ok(sender.includes('manageUrl: guestManage ? null : bookingManageUrl(row.id),'));
  for (const f of BOOK_ROUTES) assert.equal((code(f).match(/guestManage: guestManageFor\(result\),/g) ?? []).length, 1, f);
});

// ── T5. the guest projection ─────────────────────────────────────────────────

test('T5 the guest projection is the receipt’s own vendor side — header, stay or flight, vendor money — and the refunds by kind, amount and instant, with no settlement word', () => {
  for (const [what, reservation, bookArrival] of [['hotel', HOTEL_RES, HOTEL_BOOK], ['flight', FLIGHT_RES, FLIGHT_BOOK]] as const) {
    const g = guestReceiptOf({ reservation, bookArrival, latestReadArrival: null, moneyEvents: [STATED_REFUND, UNSTATED_FEE] });
    const owner = receiptOf({ reservation, bookArrival, latestReadArrival: null, chargeLink: null, journalEntry: null, moneyEvents: [] });
    assert.deepEqual(Object.keys(g), ['header', 'hotel', 'flight', 'vendor', 'refunds', 'refundsWords', 'notes'], what);
    assert.deepEqual([g.header, g.hotel, g.flight, g.vendor], [owner.header, owner.hotel, owner.flight, owner.vendor], `${what}: the receipt’s own vendor side, unchanged`);
    assert.deepEqual(g.refunds, [
      { kind: 'refund', amount: '25000 cents USD', statedAt: '2026-09-22T10:00:00.000Z', figure: { source: 'vendor', evidence: 'me_r1' }, raw: { id: 'me_r1', kind: 'refund', amountCents: '25000', currency: 'USD' } },
      { kind: 'cancellation_fee', amount: 'not stated by the vendor', statedAt: '2026-09-22T10:00:00.000Z', figure: { source: 'vendor', evidence: 'me_fee' }, raw: { id: 'me_fee', kind: 'cancellation_fee', amountCents: null, currency: null } },
    ]);
    assert.doesNotMatch(JSON.stringify(g), /bank|ledger|settle|ommission|journal|history/i, `${what}: no bank, books, settlement, margin or history word`);
    assert.deepEqual(g.notes, [...GUEST_NOTES]);
  }
  assert.equal(guestReceiptOf({ reservation: HOTEL_RES, bookArrival: HOTEL_BOOK, latestReadArrival: null, moneyEvents: [] }).refundsWords, receiptOf({ reservation: HOTEL_RES, bookArrival: HOTEL_BOOK, latestReadArrival: null, chargeLink: null, journalEntry: null, moneyEvents: [] }).refundsWords);
});

test('T5 GUEST_NOTES name no bank and no ledger; the owner’s RECEIPT_NOTES and receiptOf are unchanged word for word', () => {
  assert.equal(GUEST_NOTES.length, 3);
  for (const n of GUEST_NOTES) assert.doesNotMatch(n, /bank|ledger/i);
  assert.ok(GUEST_NOTES.some((n) => n.includes('Nothing on this page is computed')));
  assert.ok(GUEST_NOTES.some((n) => n.includes('Print / Save as PDF')));
  assert.ok(RECEIPT_NOTES.length > 0);
  // receiptOf's body as it stood on main 37909b85 (sha256 of the comment-stripped function).
  const body = functionBody(code(RECEIPT_LEAF), 'receiptOf') ?? '';
  assert.equal(createHash('sha256').update(body).digest('hex'), RECEIPT_OF_AT_MAIN);
});

// ── T6. the one renderer, mounted by both pages ──────────────────────────────

test('T6 both pages mount the one renderer; the owner keeps Add to calendar, Print, Bank, Ledger and History; the guest page has none of the owner’s sections and keeps the code out of URLs and storage', () => {
  const owner = code(OWNER_PAGE);
  const page = code(PAGE);
  const renderer = code(RENDERER);
  assert.ok(owner.includes("import ReceiptBody, { Line } from '@/components/receipts/ReceiptBody';"));
  assert.ok(page.includes("import ReceiptBody from '@/components/receipts/ReceiptBody';"));
  for (const kept of ['data-receipt-ics', 'window.print()', 'data-receipt-section="bank"', 'data-receipt-section="ledger"', '<HistorySection history={history} />', '/api/reservations/${encodeURIComponent(id)}/receipt']) assert.ok(owner.includes(kept), `the owner page keeps ${kept}`);
  for (const section of ['hotel', 'flight', 'vendor', 'refunds']) {
    assert.ok(renderer.includes(`data-receipt-section="${section}"`), `the renderer draws ${section}`);
    assert.ok(!owner.includes(`data-receipt-section="${section}"`), `the owner page no longer draws its own ${section}`);
  }
  for (const section of ['bank', 'ledger', 'history']) assert.ok(!renderer.includes(`data-receipt-section="${section}"`));
  assert.doesNotMatch(page, /data-receipt-section|HistorySection|\/api\/reservations|settlement|localStorage|sessionStorage|[?&]code=/);
  assert.ok(page.includes("new URLSearchParams(window.location.search).get('ref')"));
  assert.ok(page.includes('<GuestBookingLookup initialReference={prefill} initialFailure={failure} onOpened={showOpened} />'), 'the page mounts the one lookup box');
  assert.doesNotMatch(page, /<input\b|fetch\('\/api\/guest\/session',/, 'the page keeps no form of its own');
  assert.ok(page.includes("fetch('/api/guest/session/end', { method: 'POST' })"));
  assert.ok(page.includes('text-brand-red'));
  assert.doesNotMatch(page, /AppLayout/);
});

test('T6 the door: ONE lookup box, mounted by /booking/manage and by the home page directly under the booking section — it asks nothing on load, posts the code in the body, and a match on the home page goes to /booking/manage', () => {
  const lookup = code(LOOKUP);
  const landing = code(LANDING);
  assert.ok(lookup.includes('body: JSON.stringify({ reference, code }),'));
  assert.equal((lookup.match(/\bfetch\(/g) ?? []).length, 1, 'its one call is the submitted lookup');
  assert.ok(lookup.includes("fetch('/api/guest/session', {"));
  assert.doesNotMatch(lookup, /useEffect|useLayoutEffect|localStorage|sessionStorage|[?&]code=|console\./);
  assert.ok(lookup.includes('className="flex flex-col gap-3 sm:flex-row sm:items-end"'), 'the fields stack on a phone');
  assert.ok(lookup.includes('<fieldset className="space-y-3" disabled={!live}>'), 'disabled until live — a native submit would be a GET with the code in the URL');
  const section = landing.indexOf('<LandingBookingSection onRequireAuth={onRequireAuth} />');
  const box = landing.indexOf("<GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />");
  const footer = landing.indexOf('One trip holds everything — plans, bookings, budget.');
  assert.ok(section > 0 && section < box && box < footer, 'under the booking section, above the demo’s footer row');
  assert.match(landing.slice(section + '<LandingBookingSection onRequireAuth={onRequireAuth} />'.length, box), /^\s*(\{\s*\})?\s*<div className="[^"]*" data-guest-lookup-home>\s*$/, 'directly under it');
  assert.equal((landing.match(/<GuestBookingLookup\b/g) ?? []).length, 1);
});

test('T6 the lookup box, rendered: the label, the two fields, "Look up" and the hint; a reference handed in is prefilled; a failure the page hands in is the one brand-red line', async () => {
  const { default: GuestBookingLookup } = await import('../../components/guest/GuestBookingLookup');
  const html = renderToStaticMarkup(React.createElement(GuestBookingLookup, { onOpened: () => {} }));
  assert.ok(html.includes('<fieldset class="space-y-3" disabled="">'), 'the server’s HTML cannot be submitted — the fields wait for the page to be live');
  assert.ok(html.includes('<legend class="text-sm font-semibold text-text-primary">Booked without an account? Look up your booking</legend>'));
  assert.ok(html.includes('Manage reference') && html.includes('Manage code'));
  assert.match(html, /<button type="submit"[^>]*data-guest-open="true">Look up<\/button>/);
  assert.ok(html.includes('Your reference and manage code are in your booking email.'));
  assert.doesNotMatch(html, /data-guest-failure/, 'no failure line until there is one');
  const prefilled = renderToStaticMarkup(React.createElement(GuestBookingLookup, { initialReference: 'GBK-1', initialFailure: 'the booking read answered 500', onOpened: () => {} }));
  assert.match(prefilled, /name="reference"[^>]*value="GBK-1"/);
  assert.match(prefilled, /name="code"[^>]*value=""/);
  assert.match(prefilled, /<p class="text-sm text-brand-red" role="alert" data-guest-failure="true">the booking read answered 500<\/p>/);
});

test('T6 rendered: the guest receipt draws the header, stay, vendor and refunds with its actions — no Bank, Ledger, History or settlement; the owner’s sections sit where they did', async () => {
  const { default: ReceiptBody } = await import('../../components/receipts/ReceiptBody');
  const g = guestReceiptOf({ reservation: HOTEL_RES, bookArrival: HOTEL_BOOK, latestReadArrival: null, moneyEvents: [STATED_REFUND] });
  const guestHtml = renderToStaticMarkup(React.createElement(ReceiptBody, { receipt: g, actions: React.createElement('button', { 'data-guest-close': '' }, 'Close this booking') }));
  const sections = Array.from(guestHtml.matchAll(/data-receipt-section="([a-z]+)"/g), (m) => m[1]);
  assert.deepEqual(sections, ['hotel', 'vendor', 'refunds']);
  assert.ok(guestHtml.includes('Hotel receipt · Sample Hotel'));
  assert.ok(guestHtml.includes('Close this booking'));
  assert.ok(guestHtml.includes('refund</span> · 25000 cents USD · 2026-09-22T10:00:00.000Z</li>'), 'kind · amount · instant — nothing after');
  assert.doesNotMatch(guestHtml, /Bank|Ledger|History|settle/);

  const r = receiptOf({ reservation: HOTEL_RES, bookArrival: HOTEL_BOOK, latestReadArrival: null, chargeLink: null, journalEntry: null, moneyEvents: [{ ...STATED_REFUND, status: 'stated', settledTransactionId: null, settledAt: null }] });
  const ownerHtml = renderToStaticMarkup(React.createElement(ReceiptBody, {
    receipt: r,
    actions: null,
    afterVendor: React.createElement(React.Fragment, null, React.createElement('section', { 'data-receipt-section': 'bank' }), React.createElement('section', { 'data-receipt-section': 'ledger' })),
  }, React.createElement('section', { 'data-receipt-section': 'history' })));
  assert.deepEqual(Array.from(ownerHtml.matchAll(/data-receipt-section="([a-z]+)"/g), (m) => m[1]), ['hotel', 'vendor', 'bank', 'ledger', 'refunds', 'history']);
  assert.ok(ownerHtml.includes(`· ${r.refunds[0].settlement}</li>`), 'the owner’s refund line keeps its settlement words');
});
